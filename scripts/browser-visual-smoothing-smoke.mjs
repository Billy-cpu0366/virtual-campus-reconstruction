import { writeFileSync } from "node:fs";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const url =
  process.argv[2] ??
  process.env.SMOOTHING_SMOKE_URL ??
  "http://127.0.0.1:4175/";
const receiptPath = process.env.SMOOTHING_RECEIPT;
const sampleDurationMs = Number(
  process.env.SMOOTHING_SAMPLE_MS ?? 2200,
);

const targetResponse = await fetch(
  `${cdpBase}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) {
  throw new Error(`could not create target: ${targetResponse.status}`);
}
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const runtimeEvents = { console: [], exceptions: [] };
let nextId = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result ?? {});
    return;
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    ["error", "warning"].includes(message.params.type)
  ) {
    runtimeEvents.console.push({
      type: message.params.type,
      args: message.params.args?.map((arg) => arg.value ?? arg.description),
    });
  }
  if (message.method === "Runtime.exceptionThrown") {
    runtimeEvents.exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text,
    );
  }
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitForState(expected, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if ((await evaluate("document.body?.dataset.appState")) === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${expected} timeout after ${timeoutMs}ms`);
}

function movementStats(rows, key) {
  const values = rows.map((row) => row[key]);
  const deltas = values.slice(1).map((value, index) => value - values[index]);
  const moving = deltas.filter((value) => Math.abs(value) > 0.000001);
  return {
    start: values[0],
    end: values.at(-1),
    zeroDeltaFrames: deltas.length - moving.length,
    movingFrames: moving.length,
    movingRatio: moving.length / Math.max(1, deltas.length),
    medianMovingDelta: moving.length
      ? [...moving].sort((a, b) => a - b)[Math.floor(moving.length / 2)]
      : 0,
    maximumMovingDelta: moving.length
      ? Math.max(...moving.map((value) => Math.abs(value)))
      : 0,
  };
}

let result;
try {
  await Promise.all([
    command("Page.enable"),
    command("Runtime.enable"),
  ]);
  await waitForState("READY", 30000);
  const hookTypes = {
    debug: await evaluate("typeof window.__campusDebug"),
    entry: await evaluate("typeof window.__campusEntryTest"),
  };
  const entrySamples = [];
  const entryStartedAt = Date.now();
  await evaluate("document.querySelector('#app-play')?.click()");
  while (Date.now() - entryStartedAt < 15000) {
    const sample = await evaluate(`(() => {
      const debug = window.__campusDebug?.();
      return {
        appState: document.body?.dataset.appState,
        cameraStable: debug?.entry?.snapshot?.cameraStable ?? false,
        lock: debug?.entryChunkTargetLock?.length ?? 0,
        targets: debug?.state?.targets?.length ?? 0,
        rendered: debug?.state?.rendered?.length ?? 0,
      };
    })()`);
    entrySamples.push({ elapsedMs: Date.now() - entryStartedAt, ...sample });
    if (sample.appState === "PLAYING") break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (entrySamples.at(-1)?.appState !== "PLAYING") {
    throw new Error("PLAYING timeout after 15000ms");
  }
  const entryMilestones = [];
  for (const sample of entrySamples) {
    const key = [
      sample.appState,
      sample.cameraStable,
      sample.lock,
      sample.targets,
      sample.rendered,
    ].join(":");
    if (entryMilestones.at(-1)?.key !== key) {
      entryMilestones.push({ ...sample, key });
    }
  }
  const cameraStableAtMs = entrySamples.find(
    (sample) => sample.cameraStable,
  )?.elapsedMs;
  const lockReleasedAtMs = entrySamples.find(
    (sample) => sample.cameraStable && sample.lock === 0,
  )?.elapsedMs;
  const chunksSettledAtMs = entrySamples.find(
    (sample) => sample.rendered === 15 && sample.targets === 15,
  )?.elapsedMs;
  const playingAtMs = entrySamples.find(
    (sample) => sample.appState === "PLAYING",
  )?.elapsedMs;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await evaluate(`(() => {
    window.__smoothingRows = [];
    let previous = performance.now();
    const startedAt = previous;
    function sample(now) {
      const debug = window.__campusDebug?.();
      window.__smoothingRows.push({
        deltaMs: now - previous,
        bodyX: debug?.player?.x,
        visualX: debug?.playerVisual?.x,
        cameraX: debug?.camera?.scrollX,
        rendered: debug?.state?.rendered?.length,
      });
      previous = now;
      if (now - startedAt < ${sampleDurationMs}) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  })()`);
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await new Promise((resolve) => setTimeout(resolve, sampleDurationMs + 100));
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  const rows = await evaluate("window.__smoothingRows ?? []");
  const frameDeltas = rows.map((row) => row.deltaMs);
  const body = movementStats(rows, "bodyX");
  const visual = movementStats(rows, "visualX");
  const camera = movementStats(rows, "cameraX");
  const renderedValues = rows.map((row) => row.rendered);
  const receipt = {
    url,
    build: "test-hooks",
    sampleDurationMs,
    hookTypes,
    entryChunkRelease: {
      cameraStableAtMs,
      lockReleasedAtMs,
      chunksSettledAtMs,
      playingAtMs,
      settledBeforePlaying:
        chunksSettledAtMs !== undefined &&
        playingAtMs !== undefined &&
        chunksSettledAtMs <= playingAtMs,
      milestones: entryMilestones,
    },
    frames: rows.length,
    frameTiming: {
      maximumMs: Math.max(...frameDeltas),
      over34Ms: frameDeltas.filter((value) => value > 34).length,
      over50Ms: frameDeltas.filter((value) => value > 50).length,
    },
    body,
    visual,
    camera,
    renderedRange: [
      Math.min(...renderedValues),
      Math.max(...renderedValues),
    ],
    runtimeEvents,
  };
  result = {
    ...receipt,
    passed:
      hookTypes.debug === "function" &&
      receipt.entryChunkRelease.settledBeforePlaying &&
      cameraStableAtMs !== undefined &&
      lockReleasedAtMs !== undefined &&
      lockReleasedAtMs - cameraStableAtMs <= 200 &&
      rows.length >= 100 &&
      body.zeroDeltaFrames >= body.movingFrames * 0.8 &&
      body.medianMovingDelta >= 4 &&
      visual.movingRatio >= 0.9 &&
      visual.maximumMovingDelta < body.maximumMovingDelta &&
      camera.movingRatio >= 0.9 &&
      receipt.frameTiming.over50Ms === 0 &&
      runtimeEvents.console.length === 0 &&
      runtimeEvents.exceptions.length === 0,
  };
  if (receiptPath) {
    writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await command("Target.closeTarget", { targetId: target.id }).catch(
    () => undefined,
  );
  socket.close();
}

if (!result?.passed) process.exitCode = 1;

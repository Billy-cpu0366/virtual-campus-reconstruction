import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const receiptPath = process.env.FACTORY_SMOKE_RECEIPT;
const screenshotDir = process.env.FACTORY_SMOKE_SCREENSHOT_DIR;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keyByDirection = Object.freeze({
  left: { key: "ArrowLeft", keyCode: 37 },
  up: { key: "ArrowUp", keyCode: 38 },
  right: { key: "ArrowRight", keyCode: 39 },
  down: { key: "ArrowDown", keyCode: 40 },
});

const targetResponse = await fetch(
  `${cdpBase}/json/new?${encodeURIComponent("about:blank")}`,
  { method: "PUT" },
);
if (!targetResponse.ok) throw new Error(`create target: ${targetResponse.status}`);
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };
let nextId = 0;
let phaserGamesObjectId;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result ?? {});
    return;
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    events.console.push(
      message.params.args?.map((argument) => argument.value ?? argument.description),
    );
  }
  if (message.method === "Runtime.exceptionThrown") {
    events.exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text,
    );
  }
  if (message.method === "Network.loadingFailed") {
    events.failedRequests.push({
      url: message.params.url,
      errorText: message.params.errorText,
    });
  }
  if (message.method === "Network.responseReceived") {
    const response = message.params.response;
    if (response.status >= 400 && !response.url.endsWith("/favicon.ico")) {
      events.badResponses.push({ url: response.url, status: response.status });
    }
  }
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ?? response.exceptionDetails.text,
    );
  }
  return response.result?.value;
}

async function waitFor(expression, predicate, label, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(expression);
    if (predicate(value)) return value;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function initializeProductionSceneQuery() {
  const prototype = await command("Runtime.evaluate", {
    expression: "Phaser.Game.prototype",
  });
  const prototypeObjectId = prototype.result?.objectId;
  assert.ok(prototypeObjectId, "Phaser.Game.prototype is not inspectable");
  const instances = await command("Runtime.queryObjects", { prototypeObjectId });
  phaserGamesObjectId = instances.objects?.objectId;
  assert.ok(phaserGamesObjectId, "Phaser game instances are not inspectable");
  await command("Runtime.releaseObject", { objectId: prototypeObjectId });
}

async function sceneCall(functionDeclaration) {
  assert.ok(phaserGamesObjectId, "production scene query is not initialized");
  const response = await command("Runtime.callFunctionOn", {
    objectId: phaserGamesObjectId,
    functionDeclaration,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ?? response.exceptionDetails.text,
    );
  }
  return response.result?.value;
}

async function smokeSnapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const runtime = scene?.smokeRuntime;
      const camera = scene?.cameras?.main;
      if (!runtime || !camera || !scene?.player) continue;
      const worldView = camera.worldView;
      const bounds = runtime.visualSnapshot?.bounds ?? null;
      const viewport = {
        left: worldView.x,
        right: worldView.x + worldView.width,
        top: worldView.y,
        bottom: worldView.y + worldView.height,
      };
      const intersects = bounds !== null &&
        bounds.right >= viewport.left && bounds.left <= viewport.right &&
        bounds.bottom >= viewport.top && bounds.top <= viewport.bottom;
      return {
        player: { x: scene.player.x, y: scene.player.y },
        viewport,
        state: runtime.snapshot?.state,
        generation: runtime.snapshot?.generation,
        visible: runtime.snapshot?.visible,
        emitting: runtime.snapshot?.emitting,
        hasEmitter: runtime.hasEmitter,
        aliveParticleCount: runtime.visualSnapshot?.aliveParticleCount ?? 0,
        bounds,
        intersects,
        sideFailures: scene.sideFailures ?? [],
        trainState: scene.trainRuntime?.snapshot?.state ?? null,
      };
    }
    return null;
  }`);
}

async function move(step) {
  const binding = keyByDirection[step.direction];
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: binding.key,
    code: binding.key,
    windowsVirtualKeyCode: binding.keyCode,
  });
  const startedAt = Date.now();
  let previous;
  let stationarySamples = 0;
  try {
    while (Date.now() - startedAt < 15_000) {
      const snapshot = await smokeSnapshot();
      assert.ok(snapshot, "production smoke snapshot is unavailable");
      const value = snapshot.player[step.axis];
      const reached = step.comparison === "lte"
        ? value <= step.target
        : value >= step.target;
      if (reached) {
        return { ...step, durationMs: Date.now() - startedAt, position: snapshot.player };
      }
      if (
        previous &&
        Math.hypot(
          snapshot.player.x - previous.x,
          snapshot.player.y - previous.y,
        ) < 0.1
      ) stationarySamples += 1;
      else stationarySamples = 0;
      if (stationarySamples > 25) {
        throw new Error(
          `route blocked: ${step.direction} ${step.axis}=${step.target} at ` +
            `${snapshot.player.x},${snapshot.player.y}`,
        );
      }
      previous = snapshot.player;
      await sleep(50);
    }
    throw new Error(`route timeout: ${step.direction} ${step.target}`);
  } finally {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: binding.key,
      code: binding.key,
      windowsVirtualKeyCode: binding.keyCode,
    });
  }
}

async function waitForTrainDeparture() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 25_000) {
    const snapshot = await smokeSnapshot();
    if (snapshot?.trainState === "complete") return snapshot;
    await sleep(100);
  }
  throw new Error("train did not complete before the physical smoke route");
}

async function sampleSmoke(durationMs) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const snapshot = await smokeSnapshot();
    assert.ok(snapshot, "production smoke snapshot disappeared");
    samples.push({ elapsedMs: Date.now() - startedAt, ...snapshot });
    await sleep(100);
  }
  return samples;
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
}

let result;
try {
  await Promise.all([
    command("Page.enable"),
    command("Runtime.enable"),
    command("Network.enable"),
  ]);
  await command("Page.navigate", { url });
  await waitFor(
    "document.body?.dataset.appState",
    (state) => state === "READY",
    "READY",
  );
  assert.equal(await evaluate("typeof window.__campusDebug"), "undefined");
  assert.equal(await evaluate("typeof window.__campusCollisionTest"), "undefined");
  assert.equal(await evaluate("typeof window.__campusLifecycleTest"), "undefined");
  await initializeProductionSceneQuery();

  const ready = await smokeSnapshot();
  assert.ok(ready);
  assert.equal(ready.state, "paused");
  assert.equal(ready.generation, 1);
  assert.equal(ready.hasEmitter, true);

  await evaluate("document.querySelector('#app-play')?.click()");
  await waitFor(
    "document.body?.dataset.appState",
    (state) => state === "PLAYING",
    "PLAYING",
    20_000,
  );

  const trainDeparted = await waitForTrainDeparture();
  const route = [];
  route.push(await move({ direction: "right", target: 1_408, axis: "x", comparison: "gte" }));
  route.push(await move({ direction: "down", target: 416, axis: "y", comparison: "gte" }));
  route.push(await move({ direction: "left", target: 808, axis: "x", comparison: "lte" }));
  route.push(await move({ direction: "down", target: 540, axis: "y", comparison: "gte" }));

  const visibleSamples = await sampleSmoke(2_800);
  assert.ok(visibleSamples.every((sample) => sample.generation === 1));
  assert.ok(visibleSamples.every((sample) => sample.hasEmitter === true));
  const visibleEvidence = visibleSamples.filter((sample) =>
    sample.state === "emitting" && sample.emitting && sample.visible &&
    sample.aliveParticleCount > 0 && sample.intersects,
  );
  assert.ok(visibleEvidence.length >= 20, "factory smoke was not visibly emitting for two seconds");
  const visibleScreenshot = await capture("factory-smoke-visible");

  route.push(await move({ direction: "up", target: 416, axis: "y", comparison: "lte" }));
  route.push(await move({ direction: "right", target: 1_280, axis: "x", comparison: "gte" }));
  await sleep(300);
  const away = await smokeSnapshot();
  assert.ok(away);
  assert.equal(away.state, "paused");
  assert.equal(away.visible, false);
  assert.equal(away.emitting, false);
  assert.equal(away.aliveParticleCount, 0);
  assert.equal(away.hasEmitter, true);
  assert.equal(away.generation, 1);

  route.push(await move({ direction: "left", target: 808, axis: "x", comparison: "lte" }));
  route.push(await move({ direction: "down", target: 540, axis: "y", comparison: "gte" }));
  const returnedSamples = await sampleSmoke(1_000);
  assert.ok(returnedSamples.some((sample) =>
    sample.state === "emitting" && sample.aliveParticleCount > 0 && sample.intersects,
  ));
  assert.ok(returnedSamples.every((sample) => sample.generation === 1));
  assert.ok(returnedSamples.every((sample) => sample.hasEmitter === true));
  const returnedScreenshot = await capture("factory-smoke-returned");

  const shutdown = await sceneCall(`async function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.shutdownForGeneration) continue;
      return await scene.shutdownForGeneration();
    }
    return null;
  }`);
  assert.ok(shutdown);
  assert.equal(shutdown.smokeEmitterActive, false);
  assert.deepEqual(shutdown.sideFailures, []);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    ready,
    trainDeparted,
    route,
    visibleSampleCount: visibleSamples.length,
    visibleEvidenceCount: visibleEvidence.length,
    away,
    returnedSampleCount: returnedSamples.length,
    shutdown,
    screenshots: { visible: visibleScreenshot, returned: returnedScreenshot },
    events,
  };
  if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (phaserGamesObjectId) {
    await command("Runtime.releaseObject", { objectId: phaserGamesObjectId }).catch(
      () => undefined,
    );
  }
  await command("Target.closeTarget", { targetId: target.id }).catch(() => undefined);
  socket.close();
}

if (!result?.passed) process.exitCode = 1;

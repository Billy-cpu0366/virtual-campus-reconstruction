import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl = process.argv[2] ?? "http://127.0.0.1:4175/";
const targetUrl = new URL(inputUrl);
targetUrl.searchParams.set("collision-test", "1");
targetUrl.searchParams.set("lifecycle-test", "1");
targetUrl.searchParams.set("roof-footsteps", String(Date.now()));
const url = targetUrl.toString();
const receiptPath = process.env.ROOF_FOOTSTEPS_RECEIPT;
const screenshotDir = process.env.ROOF_FOOTSTEPS_SCREENSHOT_DIR;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const route = Object.freeze([
  { direction: "left", target: 552, axis: "x", comparison: "lte" },
  { direction: "down", target: 556, axis: "y", comparison: "gte" },
  { direction: "right", target: 680, axis: "x", comparison: "gte" },
  { direction: "down", target: 616, axis: "y", comparison: "gte" },
  { direction: "left", target: 668, axis: "x", comparison: "lte" },
  { direction: "down", target: 728, axis: "y", comparison: "gte" },
  { direction: "down", target: 960, axis: "y", comparison: "gte" },
  { direction: "left", target: 640, axis: "x", comparison: "lte" },
  { direction: "down", target: 1080, axis: "y", comparison: "gte" },
  { direction: "right", target: 728, axis: "x", comparison: "gte" },
  { direction: "down", target: 1200, axis: "y", comparison: "gte" },
  { direction: "left", target: 712, axis: "x", comparison: "lte" },
  { direction: "down", target: 1464, axis: "y", comparison: "gte" },
  { direction: "right", target: 760, axis: "x", comparison: "gte" },
  { direction: "down", target: 1560, axis: "y", comparison: "gte" },
  { direction: "left", target: 456, axis: "x", comparison: "lte" },
  { direction: "right", target: 464, axis: "x", comparison: "gte" },
  { direction: "down", target: 1640, axis: "y", comparison: "gte" },
  { direction: "left", target: 236, axis: "x", comparison: "lte" },
  { direction: "down", target: 1704, axis: "y", comparison: "gte" },
  { direction: "left", target: 216, axis: "x", comparison: "lte" },
  { direction: "down", target: 1824, axis: "y", comparison: "gte" },
]);

const keyByDirection = Object.freeze({
  left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
});

const targetResponse = await fetch(
  `${cdpBase}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) throw new Error(`create target: ${targetResponse.status}`);
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };
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
    events.console.push(message.params.args?.map((arg) => arg.value ?? arg.description));
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
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text,
    );
  }
  return response.result?.value;
}

async function debug() {
  return evaluate("window.__campusDebug?.() ?? null");
}

async function waitFor(predicate, label, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await debug();
    if (snapshot && predicate(snapshot)) return snapshot;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
}

async function move(step) {
  const binding = keyByDirection[step.direction];
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: binding.key,
    code: binding.code,
    windowsVirtualKeyCode: binding.keyCode,
  });
  const startedAt = Date.now();
  let previous;
  let stationarySamples = 0;
  try {
    while (Date.now() - startedAt < 15000) {
      const snapshot = await debug();
      const position = snapshot.player;
      const value = position[step.axis];
      const reached =
        step.comparison === "lte" ? value <= step.target : value >= step.target;
      if (reached) {
        return {
          ...step,
          durationMs: Date.now() - startedAt,
          position,
          roofInside: snapshot.roofStates.factoryInside,
          roofState: snapshot.roofStates.factory.state,
          footstepCount: snapshot.footsteps.activeCount,
        };
      }
      if (
        previous &&
        Math.hypot(position.x - previous.x, position.y - previous.y) < 0.1
      ) {
        stationarySamples += 1;
      } else {
        stationarySamples = 0;
      }
      if (stationarySamples > 25) {
        throw new Error(
          `route blocked: ${step.direction} ${step.axis}=${step.target} at ` +
            `${position.x},${position.y}`,
        );
      }
      previous = position;
      await sleep(50);
    }
    throw new Error(`route timeout: ${step.direction} ${step.target}`);
  } finally {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: binding.key,
      code: binding.code,
      windowsVirtualKeyCode: binding.keyCode,
    });
  }
}

let result;
try {
  await Promise.all([
    command("Runtime.enable"),
    command("Network.enable"),
    command("Page.enable"),
  ]);
  await command("Page.navigate", { url });
  await waitFor(
    (snapshot) => snapshot.entry?.sceneReady === true,
    "scene ready",
    30000,
  );
  await evaluate("document.querySelector('#app-play')?.click()");
  const start = await waitFor(
    (snapshot) => snapshot.side?.train?.state === "complete",
    "train completion",
  );
  assert.equal(start.entry.snapshot.status, "playable");
  assert.equal(start.roofStates.factory.state, "visible");
  assert.ok(start.particles3Diagnostics > 0);

  const steps = [];
  let roofInside;
  let roofAfter;
  const screenshots = { outside: null, inside: null, after: null, footsteps: null };
  for (const step of route) {
    const receipt = await move(step);
    steps.push(receipt);
    const snapshot = await debug();
    if (!roofInside && snapshot.roofStates.factoryInside) {
      await sleep(350);
      roofInside = await debug();
      screenshots.inside = await capture("roof-inside");
    }
    if (roofInside && !roofAfter && !snapshot.roofStates.factoryInside) {
      await sleep(350);
      roofAfter = await debug();
      screenshots.after = await capture("roof-after");
    }
    if (
      !screenshots.outside &&
      receipt.position.y >= 720 &&
      !snapshot.roofStates.factoryInside
    ) {
      screenshots.outside = await capture("roof-outside");
    }
  }

  const beforeFootsteps = await debug();
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  let footprintSnapshot;
  try {
    footprintSnapshot = await waitFor(
      (snapshot) => snapshot.footsteps.activeCount >= 5,
      "five visible footprints",
      5000,
    );
  } finally {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowRight",
      code: "ArrowRight",
      windowsVirtualKeyCode: 39,
    });
  }
  screenshots.footsteps = await capture("footsteps-after");

  assert.ok(roofInside, "route never entered factory roof rectangle");
  assert.ok(roofAfter, "route never left factory roof rectangle");
  assert.equal(roofInside.roofStates.factory.state, "faded");
  assert.equal(roofInside.roofStates.factory.alpha, 0);
  assert.equal(roofAfter.roofStates.factory.state, "visible");
  assert.equal(roofAfter.roofStates.factory.alpha, 1);
  assert.equal(roofInside.roofStates.concert.alpha, 1);
  assert.equal(roofAfter.roofStates.concert.alpha, 1);
  assert.equal(footprintSnapshot.footsteps.surfaceMarkerCount, 368);
  assert.ok(footprintSnapshot.footsteps.activeCount >= 5);
  assert.ok(
    footprintSnapshot.footsteps.visuals.every(
      (item) => item.depth === 450 && item.alpha === 0.6,
    ),
  );
  assert.ok(footprintSnapshot.particles3Diagnostics > 0);

  const lifecycle = await evaluate(
    "window.__campusLifecycleTest.shutdown()",
  );
  assert.equal(lifecycle.footstepActiveCount, 0);
  assert.equal(lifecycle.factoryRoofTweenActive, false);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    route: steps,
    beforeFootsteps: beforeFootsteps.footsteps,
    roofInside: roofInside.roofStates,
    roofAfter: roofAfter.roofStates,
    footprints: footprintSnapshot.footsteps,
    particles3Diagnostics: footprintSnapshot.particles3Diagnostics,
    lifecycle,
    screenshots,
    events,
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

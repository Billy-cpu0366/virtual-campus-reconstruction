import assert from "node:assert/strict";

import { clickPlay, waitForAppStatus } from "./browser-app-actions.mjs";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const smokeUrl = new URL(inputUrl);
smokeUrl.searchParams.set("lifecycle-test", "1");
smokeUrl.searchParams.set("side-smoke", String(Date.now()));
const url = smokeUrl.toString();
const timeoutMs = Number(process.env.SIDE_SMOKE_TIMEOUT_MS ?? 55000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) throw new Error(`${endpoint}: ${response.status}`);
  return response.json();
}

const target = await fetchJson(
  `${cdpUrl}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
const events = { exceptions: [], failedRequests: [], badResponses: [] };

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined) {
    const request = pending.get(message.id);
    if (request === undefined) return;
    pending.delete(message.id);
    if (message.error !== undefined) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result ?? {});
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    events.exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        "runtime exception",
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

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== undefined) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime.evaluate failed",
    );
  }
  return result.result?.value;
}

async function debug() {
  return evaluate("window.__campusDebug?.() ?? null");
}

async function waitForDebug(predicate, label, timeout = timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const snapshot = await debug();
    if (snapshot !== null && predicate(snapshot)) return snapshot;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function moveUntil(key, code, keyCode, predicate, label) {
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: keyCode,
  });
  try {
    return await waitForDebug(
      (snapshot) => predicate(snapshot.player),
      label,
      10000,
    );
  } finally {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: keyCode,
    });
  }
}

async function moveToSprayers() {
  await moveUntil(
    "ArrowRight",
    "ArrowRight",
    39,
    (player) => player.x >= 1408,
    "east 20 tiles to track opening",
  );
  await moveUntil(
    "ArrowDown",
    "ArrowDown",
    40,
    (player) => player.y >= 416,
    "south 7 tiles through track opening",
  );
  return moveUntil(
    "ArrowLeft",
    "ArrowLeft",
    37,
    (player) => player.x <= 1280,
    "west 8 tiles into sprayer trigger",
  );
}

try {
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Page.navigate", { url });
  await waitForAppStatus(evaluate, "READY", timeoutMs);
  const ready = await waitForDebug(
    (snapshot) => snapshot.entry?.sceneReady === true,
    "ready side owners",
  );
  assert.equal(ready.side.sprayer.started, true);
  assert.equal(ready.side.sprayerSpriteCount, 4);
  assert.equal(ready.side.smoke.generation, 1);
  assert.equal(ready.side.smoke.state, "paused");
  assert.equal(ready.side.smokeHasEmitter, true);

  const clickedAt = Date.now();
  const clickedPoint = await clickPlay(command, evaluate, timeoutMs);
  const samples = [];
  let holding;
  let complete;
  const routeStartedAt = Date.now();
  while (Date.now() - routeStartedAt < 22000) {
    const snapshot = await debug();
    if (snapshot !== null) {
      samples.push({
        elapsedMs: Date.now() - clickedAt,
        state: snapshot.side.train?.state,
        x: snapshot.side.train?.x,
        collider: snapshot.side.trainColliderActive,
        sprite: snapshot.side.trainHasSprite,
        smokeState: snapshot.side.smoke?.state,
        smokeGeneration: snapshot.side.smoke?.generation,
      });
      if (snapshot.side.train?.state === "holding" && holding === undefined) {
        holding = snapshot;
      }
      if (snapshot.side.train?.state === "complete") {
        complete = snapshot;
        break;
      }
    }
    await sleep(50);
  }
  assert.ok(holding !== undefined, "real train never reached holding");
  assert.ok(complete !== undefined, "real train never completed departure");
  const holdingElapsedMs = samples.find((sample) => sample.state === "holding")?.elapsedMs;
  const completeElapsedMs = samples.find((sample) => sample.state === "complete")?.elapsedMs;
  assert.ok(holdingElapsedMs >= 4800 && holdingElapsedMs < 6500);
  assert.ok(completeElapsedMs >= 16500 && completeElapsedMs < 19500);
  assert.equal(holding.side.trainHasSprite, true);
  assert.equal(holding.side.trainHasCollisionShape, true);
  assert.equal(holding.side.trainColliderActive, true);
  assert.ok(holding.side.trainBlockingCellCount > 0);
  assert.equal(complete.side.trainHasSprite, false);
  assert.equal(complete.side.trainHasCollisionShape, false);
  assert.equal(complete.side.trainColliderActive, false);
  assert.equal(complete.side.trainBlockingCellCount, 0);
  assert.ok(samples.some((sample) => sample.smokeState === "emitting"));
  assert.ok(samples.every((sample) => sample.smokeGeneration === 1));

  await waitForAppStatus(evaluate, "PLAYING", 1000);
  const moved = await moveToSprayers();
  const fleeing = await waitForDebug(
    (snapshot) =>
      snapshot.side.sprayer.triggeredAt !== null &&
      snapshot.side.sprayer.instances.some((instance) => instance.state === "fleeing"),
    "sprayer 300ms cascade trigger",
    5000,
  );
  const gone = await waitForDebug(
    (snapshot) =>
      snapshot.side.sprayer.instances.some((instance) => instance.state === "gone") &&
      snapshot.side.sprayerSpriteCount < 4,
    "one sprayer route completion",
    25000,
  );
  const fleeTimes = fleeing.side.sprayer.instances
    .map((instance) => instance.fleeAt)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  assert.deepEqual(
    fleeTimes.slice(1).map((value, index) => value - fleeTimes[index]),
    [300, 300, 300],
  );
  assert.deepEqual(gone.side.failures, []);

  const lifecycle = await evaluate(`(async () => {
    const receipt = await window.__campusLifecycleTest.shutdown();
    return {
      receipt,
      debugHook: typeof window.__campusDebug,
      lifecycleHook: typeof window.__campusLifecycleTest,
      contentHook: typeof window.__campusContentTest,
    };
  })()`);
  assert.deepEqual(lifecycle.receipt, {
    trainColliderActive: false,
    trainBlockingCellCount: 0,
    trainSpriteActive: false,
    trainCollisionShapeActive: false,
    sprayerSpriteCount: 0,
    smokeEmitterActive: false,
    sideFailures: [],
    physicsColliderCount: 0,
  });
  assert.equal(lifecycle.debugHook, "undefined");
  assert.equal(lifecycle.lifecycleHook, "undefined");
  assert.equal(lifecycle.contentHook, "undefined");
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  console.log(JSON.stringify({
    ok: true,
    url,
    clickedPoint,
    ready,
    holdingElapsedMs,
    completeElapsedMs,
    holding,
    complete,
    moved: moved.player,
    fleeing,
    gone,
    lifecycle,
    events,
  }, null, 2));
} finally {
  socket.close();
  await fetch(`${cdpUrl}/json/close/${target.id}`).catch(() => {});
}

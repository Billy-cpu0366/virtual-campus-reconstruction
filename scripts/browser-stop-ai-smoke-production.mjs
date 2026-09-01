import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const receiptPath = process.env.STOP_AI_SMOKE_RECEIPT;
const screenshotDir = process.env.STOP_AI_SMOKE_SCREENSHOT_DIR;
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
  if (
    message.method === "Runtime.consoleAPICalled" &&
    ["error", "warning"].includes(message.params.type)
  ) {
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
      const stop = scene?.stopAiSmokeRuntime;
      const fog = scene?.fogRuntime;
      const camera = scene?.cameras?.main;
      if (!scene?.player || !stop || !fog || !camera) continue;
      const view = camera.worldView;
      return {
        player: { x: scene.player.x, y: scene.player.y },
        viewport: {
          left: view.x,
          right: view.x + view.width,
          top: view.y,
          bottom: view.y + view.height,
        },
        stop: stop.snapshot,
        stopEmitterCount: stop.emitterCount,
        stopGraphicsCount: stop.graphicsCount,
        fog: fog.snapshot,
        fogEmitterCount: fog.emitterCount,
        fogPresentation: fog.emitters instanceof Map
          ? [...fog.emitters.entries()].map(([id, emitter]) => ({
            id,
            emitting: emitter.emitting,
            visible: emitter.visible,
            aliveParticleCount: emitter.getAliveParticleCount?.() ?? null,
          }))
          : [],
        trainState: scene.trainRuntime?.snapshot?.state ?? null,
      };
    }
    return null;
  }`);
}

async function presentationSnapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const camera = scene?.cameras?.main;
      if (!scene || !camera) continue;
      const view = camera.worldView;
      const probe = globalThis.__crossSystemProbe ??=
        { nextId: 0, identities: new WeakMap() };
      const identify = (object) => {
        if (object === null || typeof object !== "object") return null;
        let id = probe.identities.get(object);
        if (id === undefined) {
          id = "sprite-" + (++probe.nextId);
          probe.identities.set(object, id);
        }
        return id;
      };
      const inView = (x, y) =>
        x + 24 >= view.x && x - 24 <= view.x + view.width &&
        y + 24 >= view.y && y - 24 <= view.y + view.height;
      const capture = (owner, runtime) => {
        const sprites = runtime?.sprites;
        if (!(sprites instanceof Map)) return [];
        return [...sprites.entries()].map(([id, sprite]) => ({
          id: String(id),
          identity: identify(sprite),
          x: sprite.x,
          y: sprite.y,
          alpha: sprite.alpha,
          visible: sprite.visible,
          active: sprite.active,
          inView: inView(sprite.x, sprite.y),
          owner,
        }));
      };
      return {
        viewport: {
          left: view.x,
          right: view.x + view.width,
          top: view.y,
          bottom: view.y + view.height,
        },
        route: capture("route", scene.routeCrowdRuntime),
        venue: capture("venue", scene.venueCrowdRuntime),
        staticCrowd: capture("static", scene.staticCrowdRuntime),
        vehicle: scene.vehicleRuntime?.snapshot ?? null,
      };
    }
    return null;
  }`);
}

async function centerCameraOnWorld(x, y) {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.cameras?.main) continue;
      scene.cameras.main.stopFollow?.();
      scene.cameras.main.centerOn(${x}, ${y});
      return true;
    }
    return false;
  }`);
}

async function vehiclePresentationSnapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const runtime = scene?.vehicleRuntime;
      if (!runtime) continue;
      const objects = runtime.objects instanceof Set
        ? [...runtime.objects]
        : [];
      return {
        snapshot: runtime.snapshot,
        objects: objects.map((object) => ({
          key: object.texture?.key ?? null,
          x: object.x,
          y: object.y,
          visible: object.visible,
          active: object.active,
          alpha: object.alpha,
          depth: object.depth,
        })),
      };
    }
    return null;
  }`);
}

async function samplePresentation(durationMs) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const snapshot = await presentationSnapshot();
    assert.ok(snapshot, "cross-system presentation snapshot is unavailable");
    samples.push({ elapsedMs: Date.now() - startedAt, ...snapshot });
    await sleep(100);
  }
  return samples;
}

function assertPresentationContinuity(samples) {
  const previous = new Map();
  for (const [sampleIndex, sample] of samples.entries()) {
    const current = new Map();
    for (const group of ["route", "venue", "staticCrowd"]) {
      for (const item of sample[group] ?? []) {
        const key = `${group}:${item.id}`;
        current.set(key, item);
        if (item.inView) {
          assert.equal(item.visible, true,
            `${key} became invisible inside the viewport at sample ${sampleIndex}`);
          assert.ok((item.alpha ?? 1) > 0,
            `${key} reached zero alpha inside the viewport at sample ${sampleIndex}`);
        }
        const prior = previous.get(key);
        if (prior?.inView) {
          assert.equal(item.identity, prior.identity,
            `${key} was recreated while inside the viewport`);
          assert.ok(item.inView || !item.visible || item.alpha > 0,
            `${key} left the viewport with an invalid presentation state`);
        } else if (sampleIndex > 0 && prior === undefined && item.inView) {
          throw new Error(`${key} first appeared inside the viewport at sample ${sampleIndex}`);
        }
      }
    }
    for (const [key, prior] of previous) {
      if (prior.inView && !current.has(key)) {
        throw new Error(`${key} disappeared while inside the viewport at sample ${sampleIndex}`);
      }
    }
    previous.clear();
    for (const [key, item] of current) previous.set(key, item);
  }
}

const fogClearSamples = [];

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
    while (Date.now() - startedAt < 20_000) {
      const snapshot = await smokeSnapshot();
      assert.ok(snapshot, "production S1 smoke snapshot is unavailable");
      if (snapshot.fog.cells.some((cell) => cell.cleared)) {
        fogClearSamples.push({
          elapsedMs: Date.now() - startedAt,
          fog: snapshot.fog,
          fogPresentation: snapshot.fogPresentation,
        });
      }
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
      await sleep(10);
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
  while (Date.now() - startedAt < 30_000) {
    const snapshot = await smokeSnapshot();
    if (snapshot?.trainState === "complete") return snapshot;
    await sleep(100);
  }
  throw new Error("train did not complete before the physical Stop AI route");
}

async function sampleSmoke(durationMs) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const snapshot = await smokeSnapshot();
    assert.ok(snapshot, "production S1 smoke snapshot disappeared");
    samples.push({ elapsedMs: Date.now() - startedAt, ...snapshot });
    await sleep(100);
  }
  return samples;
}

async function sampleStopAiFrameBudget(durationMs = 10_000) {
  const sampleDurationMs = Math.max(1, Math.floor(durationMs));
  return evaluate(`(async () => {
    const durationMs = ${sampleDurationMs};
    const intervals = [];
    let longtaskCount = 0;
    let longtaskSupported = false;
    let previousTimestamp;
    let frameCount = 0;
    let timedOut = false;
    let finish;
    const startedAt = performance.now();
    const completed = new Promise((resolve) => { finish = resolve; });
    const timeoutId = setTimeout(() => {
      timedOut = true;
      finish();
    }, durationMs + 2_000);
    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        longtaskCount += list.getEntries().length;
      });
      observer.observe({ type: "longtask" });
      longtaskSupported = true;
    } catch {
      longtaskSupported = false;
    }
    const frame = (timestamp) => {
      if (previousTimestamp !== undefined) {
        intervals.push(timestamp - previousTimestamp);
      }
      previousTimestamp = timestamp;
      frameCount += 1;
      if (performance.now() - startedAt >= durationMs) finish();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    await completed;
    clearTimeout(timeoutId);
    if (observer !== undefined) {
      longtaskCount += observer.takeRecords().length;
      observer.disconnect();
    }
    const sorted = intervals.slice().sort((a, b) => a - b);
    const percentileIndex = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
    );
    return {
      durationMs: performance.now() - startedAt,
      frameCount,
      p95Ms: sorted.length === 0 ? null : sorted[percentileIndex],
      maxMs: sorted.length === 0 ? null : sorted[sorted.length - 1],
      over20Ms: intervals.filter((interval) => interval > 20).length,
      over34Ms: intervals.filter((interval) => interval > 34).length,
      longtaskCount,
      longtaskSupported,
      timedOut,
    };
  })()`);
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
}

const toStopAi = Object.freeze([
  { direction: "right", target: 1408, axis: "x", comparison: "gte" },
  { direction: "down", target: 416, axis: "y", comparison: "gte" },
  { direction: "left", target: 1280, axis: "x", comparison: "lte" },
  { direction: "down", target: 560, axis: "y", comparison: "gte" },
  { direction: "right", target: 1460, axis: "x", comparison: "gte" },
  { direction: "down", target: 656, axis: "y", comparison: "gte" },
  { direction: "right", target: 1632, axis: "x", comparison: "gte" },
  { direction: "down", target: 848, axis: "y", comparison: "gte" },
  { direction: "right", target: 2048, axis: "x", comparison: "gte" },
  { direction: "down", target: 1008, axis: "y", comparison: "gte" },
  { direction: "left", target: 1960, axis: "x", comparison: "lte" },
  { direction: "down", target: 1040, axis: "y", comparison: "gte" },
  { direction: "left", target: 1808, axis: "x", comparison: "lte" },
  { direction: "down", target: 1152, axis: "y", comparison: "gte" },
  { direction: "left", target: 1632, axis: "x", comparison: "lte" },
  { direction: "down", target: 1296, axis: "y", comparison: "gte" },
  { direction: "left", target: 1600, axis: "x", comparison: "lte" },
  { direction: "down", target: 1312, axis: "y", comparison: "gte" },
]);

const awayFromStopAi = Object.freeze([
  { direction: "up", target: 1296, axis: "y", comparison: "lte" },
  { direction: "right", target: 1632, axis: "x", comparison: "gte" },
  { direction: "up", target: 1152, axis: "y", comparison: "lte" },
  { direction: "right", target: 1820, axis: "x", comparison: "gte" },
  { direction: "up", target: 1040, axis: "y", comparison: "lte" },
  { direction: "right", target: 1960, axis: "x", comparison: "gte" },
  { direction: "up", target: 1008, axis: "y", comparison: "lte" },
]);

const backToStopAi = Object.freeze([
  { direction: "down", target: 1040, axis: "y", comparison: "gte" },
  { direction: "left", target: 1820, axis: "x", comparison: "lte" },
  { direction: "down", target: 1152, axis: "y", comparison: "gte" },
  { direction: "left", target: 1632, axis: "x", comparison: "lte" },
  { direction: "down", target: 1296, axis: "y", comparison: "gte" },
  { direction: "left", target: 1600, axis: "x", comparison: "lte" },
  { direction: "down", target: 1312, axis: "y", comparison: "gte" },
]);

function allCanisters(snapshot) {
  return snapshot.stop.canisters.length === 9 &&
    snapshot.stop.canisters.every((item) => item.active);
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
  assert.equal(await evaluate("typeof window.__campusContentTest"), "undefined");
  await initializeProductionSceneQuery();

  const ready = await smokeSnapshot();
  assert.ok(ready);
  assert.equal(ready.stop.canisters.length, 9);
  assert.equal(ready.stopGraphicsCount, 3);
  assert.equal(ready.stopEmitterCount, 0);
  assert.equal(ready.fog.cells.length, 13);
  assert.equal(ready.fogEmitterCount, 13);
  assert.equal(ready.fog.carsInputIntegrated, false);

  await evaluate("document.querySelector('#app-play')?.click()");
  await waitFor(
    "document.body?.dataset.appState",
    (state) => state === "PLAYING",
    "PLAYING",
    20_000,
  );
  await waitForTrainDeparture();

  const route = [];
  for (const step of toStopAi) route.push(await move(step));
  await sleep(700);
  const atStopAi = await smokeSnapshot();
  assert.ok(atStopAi);
  assert.ok(allCanisters(atStopAi), "Stop AI canisters are not all active");
  assert.equal(atStopAi.stopEmitterCount, 9);
  assert.equal(atStopAi.stopGraphicsCount, 3);
  assert.equal(atStopAi.fogEmitterCount, 13);
  assert.ok(
    atStopAi.fog.cells.every((cell) => cell.active),
    "orange_smoke cells are not all active at Stop AI",
  );
  assert.ok(fogClearSamples.length > 0, "player did not clear an orange_smoke cell");
  assert.ok(
    fogClearSamples.some((sample) => sample.fogPresentation.some((emitter) =>
      emitter.emitting === false && emitter.visible === true)),
    "cleared fog particles were hidden instead of naturally draining",
  );
  const atStopAiPresentation = await presentationSnapshot();
  assert.ok(atStopAiPresentation, "presentation snapshot is unavailable at Stop AI");
  assert.equal(atStopAiPresentation.vehicle?.state, "running");
  assert.equal(atStopAiPresentation.vehicle?.police?.length, 3);
  assert.ok(atStopAiPresentation.vehicle?.helicopter !== null);
  const stopAiContinuitySamples = await samplePresentation(5_000);
  assertPresentationContinuity(stopAiContinuitySamples);
  const stopAiPerformance = await sampleStopAiFrameBudget();
  assert.equal(stopAiPerformance.timedOut, false);
  assert.ok(stopAiPerformance.durationMs >= 10_000);
  assert.ok(stopAiPerformance.frameCount > 1);
  assert.equal(stopAiPerformance.longtaskSupported, true);
  assert.equal(stopAiPerformance.longtaskCount, 0);
  assert.ok(stopAiPerformance.p95Ms !== null && stopAiPerformance.p95Ms <= 20);
  assert.ok(stopAiPerformance.maxMs !== null && stopAiPerformance.maxMs <= 34);
  const stopAiScreenshot = await capture("stop-ai-smoke-visible");

  const awayRoute = [];
  for (const step of awayFromStopAi) awayRoute.push(await move(step));
  await sleep(700);
  const away = await smokeSnapshot();
  assert.ok(away);
  assert.equal(away.stopEmitterCount, 0);
  assert.ok(away.stop.canisters.every((item) => !item.active));
  assert.ok(away.stop.canisters.every((item) => item.destroyed));
  assert.equal(away.stopGraphicsCount, 3);
  assert.ok(away.fog.cells.every((cell) => !cell.active));
  assert.equal(away.fogEmitterCount, 13);

  const returnRoute = [];
  for (const step of backToStopAi) returnRoute.push(await move(step));
  await sleep(700);
  const returned = await smokeSnapshot();
  assert.ok(returned);
  assert.ok(allCanisters(returned), "Stop AI canisters did not return");
  assert.equal(returned.stopEmitterCount, 9);
  assert.ok(returned.stop.canisters.every((item) => item.generation === 2));
  assert.ok(returned.fog.cells.every((cell) => cell.active));
  const windSamples = await sampleSmoke(7_500);
  assert.ok(
    windSamples.some((sample) =>
      sample.stop.canisters.some((item) => item.windActive),
    ),
    "recreated Stop AI emitters never received a wind loop",
  );
  const returnedScreenshot = await capture("stop-ai-smoke-returned");

  assert.equal(await centerCameraOnWorld(504, 1288), true);
  await sleep(500);
  const helicopterPresentation = await vehiclePresentationSnapshot();
  assert.ok(helicopterPresentation, "vehicle presentation snapshot is unavailable");
  assert.equal(helicopterPresentation.snapshot.state, "running");
  assert.ok(helicopterPresentation.snapshot.helicopter !== null);
  assert.equal(helicopterPresentation.snapshot.police.length, 3);
  const visibleVehicleKeys = new Set(
    helicopterPresentation.objects
      .filter((object) => object.visible && object.alpha > 0)
      .map((object) => object.key),
  );
  assert.ok(visibleVehicleKeys.has("npc-helicopter-high-resolution"));
  assert.ok(visibleVehicleKeys.has("npc-helicopter-rotor-main"));
  assert.ok(visibleVehicleKeys.has("npc-helicopter-rotor-back"));
  const helicopterScreenshot = await capture("helicopter-visible");

  const shutdown = await sceneCall(`async function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const stop = scene?.stopAiSmokeRuntime;
      const fog = scene?.fogRuntime;
      if (!scene?.shutdownForGeneration || !stop || !fog) continue;
      const receipt = await scene.shutdownForGeneration();
      return {
        receipt,
        stop: stop.snapshot,
        stopEmitterCount: stop.emitterCount,
        stopGraphicsCount: stop.graphicsCount,
        fog: fog.snapshot,
        fogEmitterCount: fog.emitterCount,
        vehicle: scene.vehicleRuntime?.snapshot ?? null,
      };
    }
    return null;
  }`);
  assert.ok(shutdown);
  assert.equal(shutdown.stop.state, "shutdown");
  assert.equal(shutdown.stopEmitterCount, 0);
  assert.equal(shutdown.stopGraphicsCount, 0);
  assert.equal(shutdown.fog.state, "shutdown");
  assert.equal(shutdown.fogEmitterCount, 0);
  assert.equal(shutdown.receipt.smokeEmitterActive, false);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    ready,
    route,
    atStopAi,
    fogClearSamples,
    atStopAiPresentation,
    stopAiContinuitySamples,
    stopAiScreenshot,
    helicopterPresentation,
    helicopterScreenshot,
    stopAiPerformance,
    awayRoute,
    away,
    returnRoute,
    returned,
    windSampleCount: windSamples.length,
    returnedScreenshot,
    shutdown,
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

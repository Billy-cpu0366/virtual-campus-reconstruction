import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const receiptPath = process.env.ROUTE_CROWD_PRODUCTION_RECEIPT;
const screenshotDir = process.env.ROUTE_CROWD_PRODUCTION_SCREENSHOT_DIR;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
let routeCrowdDiagnostics = {};

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
  });
  return response.result?.value;
}

async function crowdSnapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const runtime = scene?.routeCrowdRuntime;
      if (!runtime) continue;
      const instances = runtime.snapshot?.instances ?? [];
      return {
        started: runtime.started ?? false,
        trainStarted: runtime.trainStarted ?? false,
        pausedGroups: runtime.pausedGroups ?? [],
        spriteCount: runtime.spriteCount ?? 0,
        configIds: runtime.configIds ?? [],
        materializedByGroup: Object.fromEntries((runtime.configIds ?? []).map((id) => [
          id,
          instances.filter((item) =>
            item.id.startsWith(id + ":") && item.materialized,
          ).length,
        ])),
        instanceCount: instances.length,
        materializedCount: instances.filter((item) => item.materialized).length,
        visibleCount: instances.filter((item) => item.visible).length,
        destroyedCount: instances.filter((item) => item.destroyed).length,
        trainActiveCount: instances.filter((item) =>
          item.id.startsWith("crowd-train:") && !item.destroyed,
        ).length,
        instances,
      };
    }
    return null;
  }`);
}

async function staticNpcSnapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const runtime = scene?.staticNpcRuntime;
      if (!runtime) continue;
      return {
        spriteCount: runtime.spriteCount ?? 0,
        instances: runtime.snapshot?.instances ?? [],
        configs: runtime.configs ?? [],
      };
    }
    return null;
  }`);
}

async function venueCrowdSnapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const runtime = scene?.venueCrowdRuntime;
      if (!runtime) continue;
      return {
        spriteCount: runtime.spriteCount ?? 0,
        protestStates: runtime.protestActionSnapshot ?? [],
      };
    }
    return null;
  }`);
}

async function centerCameraOn(tile) {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.routeCrowdRuntime) continue;
      scene.cameras.main.centerOn(${tile.x}, ${tile.y});
      scene.routeCrowdRuntime.update(scene.time.now);
      return true;
    }
    return false;
  }`);
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
  assert.equal(await evaluate("typeof window.__campusEntryTest"), "undefined");

  await initializeProductionSceneQuery();
  const started = await waitFor(
    "document.body?.dataset.appState",
    (state) => state === "READY",
    "stable READY",
  );
  assert.equal(started, "READY");
  const startup = await waitFor(
    "Boolean([...document.querySelectorAll('#app canvas')].length)",
    Boolean,
    "production canvas",
  );
  assert.equal(startup, true);
  const routeCrowdStartDeadline = Date.now() + 60_000;
  let afterStart;
  while (Date.now() < routeCrowdStartDeadline) {
    afterStart = await crowdSnapshot();
    if (afterStart?.started === true) break;
    await sleep(50);
  }
  assert.ok(afterStart?.started, "route crowd runtime did not start");
  routeCrowdDiagnostics = { afterStart };

  const probes = [];
  for (const groupId of ["main-crowd", "concert_crowd"]) {
    const instance = afterStart.instances.find((item) =>
      item.id.startsWith(`${groupId}:`),
    );
    assert.ok(instance, `${groupId} did not create a logical route`);
    const tile = instance.position;
    assert.equal(await centerCameraOn(tile), true, "production camera probe failed");
    await sleep(250);
    probes.push({
      groupId,
      tile,
      snapshot: await crowdSnapshot(),
      screenshot: await capture(`crowd-${groupId}`),
    });
  }

  const movementDeadline = Date.now() + 10_000;
  let movingSnapshot;
  while (Date.now() < movementDeadline) {
    movingSnapshot = await crowdSnapshot();
    if (movingSnapshot?.instances?.some((item) => item.visible && item.state === "moving")) break;
    await sleep(50);
  }
  const moving = movingSnapshot?.instances?.find(
    (item) => item.visible && item.state === "moving",
  );
  assert.ok(moving, "no visible moving crowd instance available for movement probe");
  const movingBefore = { id: moving.id, position: moving.position, facing: moving.facing };
  await centerCameraOn(moving.position);
  await sleep(500);
  const movingAfter = await crowdSnapshot();
  const movedItem = movingAfter.instances.find((item) => item.id === movingBefore.id);
  assert.ok(movedItem, "visible crowd instance disappeared during movement probe");
  assert.ok(
    movedItem.position.x !== movingBefore.position.x || movedItem.position.y !== movingBefore.position.y,
    "visible crowd logical position did not advance",
  );
  assert.notEqual(movedItem.facing, undefined, "visible crowd facing was not updated");

  await centerCameraOn({ x: 2_000, y: 2_000 });
  await sleep(500);
  const afterLeavingViewport = await crowdSnapshot();
  const continued = afterLeavingViewport.instances.find((item) => item.id === movingBefore.id);
  assert.ok(continued, "crowd instance disappeared from logical runtime");
  assert.ok(
    continued.position.x !== movedItem.position.x ||
      continued.position.y !== movedItem.position.y ||
      continued.state !== movedItem.state ||
      continued.generation !== movedItem.generation,
    "crowd did not continue its route state after leaving viewport",
  );

  const staticProbes = [];
  for (const [id, tile] of [
    ["special-reading", { x: 72 * 16, y: 53 * 16 }],
    ["special-eating", { x: 54 * 16, y: 63 * 16 }],
    ["cat-licking", { x: 12 * 16, y: 106 * 16 }],
  ]) {
    assert.equal(await centerCameraOn(tile), true, "static NPC camera probe failed");
    await sleep(100);
    const snapshot = await staticNpcSnapshot();
    staticProbes.push({ id, tile, snapshot });
    assert.ok(
      snapshot?.instances.find((item) => item.id === id)?.materialized,
      `${id} did not materialize near its viewport`,
    );
  }
  assert.deepEqual(
    staticProbes[0].snapshot.configs.map((config) => ({
      id: config.id,
      spriteKey: config.spriteKey,
      tileX: config.tileX,
      tileY: config.tileY,
      scale: config.scale,
      frameRate: config.frameRate,
      frameDurations: config.frameDurations ?? [],
    })),
    [
      {
        id: "special-reading",
        spriteKey: "npc-special-reading",
        tileX: 72,
        tileY: 53,
        scale: 0.9,
        frameRate: 3,
        frameDurations: [{ frame: 1, duration: 2_000 }, { frame: 9, duration: 3_000 }],
      },
      {
        id: "special-eating",
        spriteKey: "npc-special-eating",
        tileX: 54,
        tileY: 63,
        scale: 0.73,
        frameRate: 4,
        frameDurations: [],
      },
      {
        id: "cat-licking",
        spriteKey: "npc-cat-licking",
        tileX: 12,
        tileY: 106,
        scale: 1,
        frameRate: 6,
        frameDurations: [{ frame: 0, duration: 3_000 }],
      },
    ],
    "static NPC contract drifted",
  );

  await centerCameraOn({ x: 2_000, y: 2_000 });
  await sleep(100);
  const staticAfterLeaving = await staticNpcSnapshot();
  assert.equal(staticAfterLeaving?.spriteCount, 0, "static NPC sprites leaked outside viewport");

  await centerCameraOn({ x: 1_800, y: 1_200 });
  await sleep(1_000);
  const protestSamples = [];
  for (let sample = 0; sample < 20; sample += 1) {
    await sleep(250);
    protestSamples.push(await venueCrowdSnapshot());
  }
  const protestStates = protestSamples.at(-1)?.protestStates ?? [];
  const capableProtesters = protestStates.filter((state) => state.capable);
  const fixedProtesters = protestStates.filter((state) => !state.capable);
  assert.ok(capableProtesters.length > 0 && capableProtesters.length < protestStates.length,
    "protest action subset is not bounded");
  assert.ok(protestSamples.every((sample) =>
    sample.protestStates.filter((state) => state.phase === "acting").length <= 2),
  "more than two protesters acted concurrently");
  assert.ok(protestSamples.some((sample) =>
    sample.protestStates.some((state) => state.actionCount > 0)),
  "no finite protest action occurred during the production sample");
  assert.ok(fixedProtesters.every((state) => state.actionCount === 0),
    "fixed protesters unexpectedly animated");

  await centerCameraOn({ x: 480, y: 310 });
  await evaluate("document.querySelector('#app-play')?.click()");
  await waitFor(
    "document.body?.dataset.appState",
    (state) => state === "PLAYING",
    "PLAYING",
    15_000,
  );
  const departureDeadline = Date.now() + 30_000;
  let duringDeparture;
  while (Date.now() < departureDeadline) {
    duringDeparture = await crowdSnapshot();
    if (
      duringDeparture?.trainStarted === true &&
      duringDeparture.trainActiveCount === 10 &&
      duringDeparture.pausedGroups.includes("loop-crowd")
    ) break;
    await sleep(50);
  }
  assert.equal(duringDeparture?.trainActiveCount, 10, "crowd-train did not complete ten-passenger startup");
  assert.ok(duringDeparture.pausedGroups.includes("loop-crowd"), "loop-crowd was not paused during departure");
  const trainAtDeparture = duringDeparture.instances.filter((item) =>
    item.id.startsWith("crowd-train:") && !item.destroyed,
  );
  assert.equal(trainAtDeparture.length, 10, "crowd-train must assign ten passengers");
  assert.equal(new Set(trainAtDeparture.map((item) => item.pathId)).size, 10,
    "crowd-train passengers must own unique path ids");
  const trainTrajectories = new Map(trainAtDeparture.map((item) => [item.id, []]));
  for (let sample = 0; sample < 10; sample += 1) {
    await sleep(400);
    const snapshot = await crowdSnapshot();
    for (const item of snapshot.instances.filter((candidate) =>
      candidate.id.startsWith("crowd-train:") && !candidate.destroyed,
    )) {
      trainTrajectories.get(item.id)?.push(`${Math.round(item.position.x)}:${Math.round(item.position.y)}`);
    }
  }
  assert.ok(new Set([...trainTrajectories.values()].map((points) => points.join("|"))).size >= 6,
    "crowd-train trajectories collapsed into a single queue");
  const recoveryDeadline = Date.now() + 30_000;
  let recovered;
  while (Date.now() < recoveryDeadline) {
    recovered = await crowdSnapshot();
    if (!recovered.pausedGroups.includes("loop-crowd")) break;
    await sleep(50);
  }
  assert.ok(recovered && !recovered.pausedGroups.includes("loop-crowd"), "loop-crowd did not resume after train left viewport");

  const maxActiveByGroup = {
    "main-crowd": 25,
    "loop-crowd": 10,
    drinkers: 5,
    concert_crowd: 40,
    beach_crowd_walk: 4,
    "vertical-crowd": 20,
    "vertical-crowd-reverse": 20,
    "crowd-train": 10,
  };
  for (const [groupId, cap] of Object.entries(maxActiveByGroup)) {
    assert.ok(
      (afterStart.materializedByGroup[groupId] ?? 0) <= cap,
      `${groupId} exceeded maxActiveInViewport`,
    );
  }
  const hasDispersedGroup = ["main-crowd", "loop-crowd", "concert_crowd", "beach_crowd_walk"]
    .some((groupId) => new Set(afterStart.instances
      .filter((item) => item.id.startsWith(`${groupId}:`))
      .map((item) => `${item.position.x}:${item.position.y}`)).size > 1);
  assert.ok(hasDispersedGroup, "no public random-position group dispersed starts");
  routeCrowdDiagnostics = { afterStart, probes, movingBefore, movingAfter, afterLeavingViewport, staticProbes, staticAfterLeaving, protestSamples, duringDeparture, trainTrajectories: Object.fromEntries(trainTrajectories), recovered, maxActiveByGroup };
  assert.equal(afterStart.configIds.length, 11, "exactly eleven normal and train route groups are required");
  assert.equal(new Set(afterStart.configIds).size, 11, "route group ids must be unique");
  assert.ok(afterStart.instanceCount > 0, "no route crowd path could start");
  assert.equal(afterStart.trainActiveCount, 0, "crowd-train must not exist before departure");
  assert.ok(
    probes.every((probe) => probe.snapshot?.materializedByGroup?.[probe.groupId] > 0),
    "each required visible route group must materialize in production",
  );
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = { passed: true, url, afterStart, probes, events };
  if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result = {
    passed: false,
    url,
    error: error instanceof Error ? error.message : String(error),
    ...routeCrowdDiagnostics,
    events,
  };
  if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`);
  console.error(JSON.stringify(result, null, 2));
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

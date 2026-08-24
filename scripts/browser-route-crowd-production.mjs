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
      const configs = runtime.core?.options?.configs ?? [];
      return {
        started: runtime.core?.started ?? false,
        spriteCount: runtime.spriteCount ?? 0,
        configIds: configs.map((config) => config.id),
        configs: configs.map((config) => ({
          id: config.id,
          count: config.count,
          startTiles: config.startTiles,
          endTiles: config.endTiles,
          delay: config.delay,
          afterDelay: config.afterDelay,
          movementSpeed: config.movementSpeed,
          speedVariation: config.speedVariation,
          goBack: config.goBack,
          deleteAfterComplete: config.deleteAfterComplete,
        })),
        materializedByGroup: Object.fromEntries(configs.map((config) => [
          config.id,
          instances.filter((item) =>
            item.id.startsWith(config.id + ":") && item.materialized,
          ).length,
        ])),
        instanceCount: instances.length,
        materializedCount: instances.filter((item) => item.materialized).length,
        visibleCount: instances.filter((item) => item.visible).length,
        destroyedCount: instances.filter((item) => item.destroyed).length,
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
  for (const groupId of ["main-crowd", "concert_crowd", "crowd-train"]) {
    const config = afterStart.configs.find((candidate) => candidate.id === groupId);
    assert.ok(config, `missing required route group: ${groupId}`);
    const tile = {
      x: config.startTiles[0].x * 16 + 8,
      y: config.startTiles[0].y * 16 + 8,
    };
    assert.equal(await centerCameraOn(tile), true, "production camera probe failed");
    await sleep(250);
    probes.push({
      groupId,
      tile,
      snapshot: await crowdSnapshot(),
      screenshot: await capture(`crowd-${groupId}`),
    });
  }

  routeCrowdDiagnostics = { afterStart, probes };
  assert.equal(afterStart.configIds.length, 9, "exactly nine route groups are required");
  assert.equal(new Set(afterStart.configIds).size, 9, "route group ids must be unique");
  assert.ok(afterStart.instanceCount > 0, "no route crowd path could start");
  assert.ok(
    probes.every((probe) => probe.snapshot?.materializedByGroup?.[probe.groupId] > 0),
    "each required public route group must materialize in production",
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

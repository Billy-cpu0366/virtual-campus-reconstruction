import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const screenshotDir = process.env.COMPLETE_PRODUCTION_SCREENSHOT_DIR;
const receiptPath = process.env.COMPLETE_PRODUCTION_RECEIPT;
const width = Number(process.env.COMPLETE_PRODUCTION_WIDTH ?? 0);
const height = Number(process.env.COMPLETE_PRODUCTION_HEIGHT ?? 0);
const label = process.env.COMPLETE_PRODUCTION_LABEL ?? "desktop";
const slowNetwork = process.env.COMPLETE_PRODUCTION_SLOW_NETWORK === "true";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const roofRoute = Object.freeze([
  { direction: "left", target: 552, axis: "x", comparison: "lte" },
  { direction: "down", target: 556, axis: "y", comparison: "gte" },
  { direction: "right", target: 680, axis: "x", comparison: "gte" },
  { direction: "down", target: 616, axis: "y", comparison: "gte" },
  { direction: "left", target: 668, axis: "x", comparison: "lte" },
  { direction: "down", target: 728, axis: "y", comparison: "gte", capture: "roof-outside" },
  { direction: "down", target: 960, axis: "y", comparison: "gte" },
  { direction: "left", target: 640, axis: "x", comparison: "lte", capture: "roof-inside" },
  { direction: "down", target: 1080, axis: "y", comparison: "gte" },
  { direction: "right", target: 728, axis: "x", comparison: "gte", capture: "roof-after" },
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
  up: { key: "ArrowUp", keyCode: 38 },
  down: { key: "ArrowDown", keyCode: 40 },
  left: { key: "ArrowLeft", keyCode: 37 },
  right: { key: "ArrowRight", keyCode: 39 },
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

async function waitFor(expression, predicate, name, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(expression);
    if (predicate(value)) return value;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${name}`);
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${label}-${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
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

async function productionPosition() {
  assert.ok(phaserGamesObjectId, "production scene query is not initialized");
  const response = await command("Runtime.callFunctionOn", {
    objectId: phaserGamesObjectId,
    functionDeclaration: `function () {
      for (const game of this) {
        const scene = game?.scene?.getScene?.("campus");
        if (scene?.player) return { x: scene.player.x, y: scene.player.y };
      }
      return null;
    }`,
    returnByValue: true,
  });
  const position = response.result?.value;
  assert.ok(position, "production CampusScene player is unavailable");
  return position;
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
    while (Date.now() - startedAt < 15000) {
      const position = await productionPosition();
      const value = position[step.axis];
      const reached =
        step.comparison === "lte" ? value <= step.target : value >= step.target;
      if (reached) {
        return { ...step, durationMs: Date.now() - startedAt, position };
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
      code: binding.key,
      windowsVirtualKeyCode: binding.keyCode,
    });
  }
}

async function domSnapshot() {
  return evaluate(`(() => ({
    appState: document.body?.dataset.appState ?? 'BOOT',
    progress: Number.parseInt(document.getElementById('app-progress-text')?.textContent ?? '0', 10),
    guideHidden: document.getElementById('content-guide')?.hidden,
    guideText: document.getElementById('content-guide')?.textContent ?? '',
    contentHidden: document.getElementById('content-modal')?.hidden,
    contentTitle: document.getElementById('content-title')?.textContent ?? '',
    hudHidden: document.getElementById('campus-map-hud')?.hidden,
    mapHidden: document.getElementById('campus-map-root')?.hidden,
    visitedMemo6: document.querySelector('[data-big-map-marker="memo6"]')?.classList.contains('visited') ?? false,
    hooks: {
      debug: typeof window.__campusDebug,
      entry: typeof window.__campusEntryTest,
      collision: typeof window.__campusCollisionTest,
      lifecycle: typeof window.__campusLifecycleTest,
      content: typeof window.__campusContentTest,
    },
  }))()`);
}

async function sampleLoading(screenshots) {
  const startedAt = Date.now();
  const samples = [];
  let lastProgress = -1;
  let capturedMid = false;
  let capturedLate = false;
  while (Date.now() - startedAt < 90000) {
    const snapshot = await domSnapshot();
    if (snapshot.progress !== lastProgress) {
      samples.push({ elapsedMs: Date.now() - startedAt, ...snapshot });
      lastProgress = snapshot.progress;
    }
    if (!capturedMid && snapshot.progress >= 20 && snapshot.progress < 70) {
      screenshots.loadingMid = await capture("loading-mid");
      capturedMid = true;
    }
    if (!capturedLate && snapshot.progress >= 70 && snapshot.progress < 100) {
      screenshots.loadingLate = await capture("loading-late");
      capturedLate = true;
    }
    if (snapshot.appState === "READY") {
      screenshots.ready = await capture("ready");
      return samples;
    }
    await sleep(50);
  }
  throw new Error("READY timeout during loading samples");
}

async function captureEntryMilestones(screenshots) {
  const milestones = [0, 1000, 3000, 5000, 8000, 17000];
  const startedAt = Date.now();
  const receipts = [];
  for (const elapsedMs of milestones) {
    const remaining = startedAt + elapsedMs - Date.now();
    if (remaining > 0) await sleep(remaining);
    const snapshot = await domSnapshot();
    receipts.push({
      expectedElapsedMs: elapsedMs,
      actualElapsedMs: Date.now() - startedAt,
      appState: snapshot.appState,
      guideText: snapshot.guideText,
      screenshot: await capture(`entry-${String(elapsedMs).padStart(5, "0")}`),
    });
  }
  await waitFor(
    "document.body.dataset.appState",
    (value) => value === "PLAYING",
    "PLAYING after entry",
    5000,
  );
  screenshots.playing = await capture("playing");
  return receipts;
}

let result;
try {
  await Promise.all([
    command("Runtime.enable"),
    command("Network.enable"),
    command("Page.enable"),
  ]);
  if (width > 0 && height > 0) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      screenWidth: width,
      screenHeight: height,
      deviceScaleFactor: 1,
      mobile: width <= 480,
    });
  }
  if (slowNetwork) {
    await command("Network.emulateNetworkConditions", {
      offline: false,
      latency: 80,
      downloadThroughput: 196_608,
      uploadThroughput: 98_304,
      connectionType: "cellular3g",
    });
  }

  const screenshots = {};
  await command("Page.navigate", { url });
  const loadingSamples = await sampleLoading(screenshots);
  if (slowNetwork) {
    await command("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "none",
    });
  }
  const progressValues = loadingSamples.map((item) => item.progress);
  assert.ok(progressValues.length >= 3, "loading progress did not expose stages");
  assert.ok(progressValues.every((value, index) => index === 0 || value >= progressValues[index - 1]));
  assert.equal(progressValues.at(-1), 100);
  const ready = await domSnapshot();
  assert.deepEqual(ready.hooks, {
    debug: "undefined",
    entry: "undefined",
    collision: "undefined",
    lifecycle: "undefined",
    content: "undefined",
  });

  await initializeProductionSceneQuery();
  await evaluate("document.getElementById('app-play')?.click()");
  const entryMilestones = await captureEntryMilestones(screenshots);
  const playing = await domSnapshot();
  assert.equal(playing.hudHidden, false);
  assert.match(playing.guideText, /Trackside crew.*east 20.*south 7.*west 8/);

  const memoRoute = [];
  memoRoute.push(await move({ direction: "left", target: 500, axis: "x", comparison: "lte" }));
  memoRoute.push(await move({ direction: "up", target: 200, axis: "y", comparison: "lte" }));
  await waitFor(
    "document.getElementById('content-modal')?.hidden",
    (value) => value === false,
    "physical Memo6 content",
    5000,
  );
  const memoOpen = await domSnapshot();
  assert.equal(memoOpen.appState, "MODAL_OPEN");
  assert.equal(memoOpen.guideHidden, true);
  assert.ok(memoOpen.contentTitle.length > 0);
  screenshots.memo6 = await capture("memo6-physical");
  await evaluate("document.getElementById('content-close')?.click()");
  await waitFor(
    "document.body.dataset.appState",
    (value) => value === "PLAYING",
    "Memo6 close",
  );

  await evaluate("document.getElementById('campus-map-open')?.click()");
  await waitFor(
    "document.getElementById('campus-map-root')?.hidden",
    (value) => value === false,
    "visited map",
  );
  const visitedMap = await domSnapshot();
  assert.equal(visitedMap.visitedMemo6, true);
  screenshots.mapVisited = await capture("map-visited-memo6");
  await evaluate("document.getElementById('campus-map-close')?.click()");
  await waitFor(
    "document.body.dataset.appState",
    (value) => value === "PLAYING",
    "map close",
  );

  const sprayerRoute = [];
  sprayerRoute.push(await move({ direction: "down", target: 304, axis: "y", comparison: "gte" }));
  sprayerRoute.push(await move({ direction: "right", target: 1408, axis: "x", comparison: "gte" }));
  sprayerRoute.push(await move({ direction: "down", target: 416, axis: "y", comparison: "gte" }));
  sprayerRoute.push(await move({ direction: "left", target: 1280, axis: "x", comparison: "lte" }));
  await waitFor(
    "document.getElementById('content-guide')?.textContent ?? ''",
    (value) => /Factory smoke.*west 30.*south 8/.test(value),
    "sprayer factory guide",
    5000,
  );
  await sleep(400);
  screenshots.sprayer = await capture("sprayer-trigger");

  const returnRoute = [];
  returnRoute.push(await move({ direction: "right", target: 1408, axis: "x", comparison: "gte" }));
  returnRoute.push(await move({ direction: "up", target: 304, axis: "y", comparison: "lte" }));
  returnRoute.push(await move({ direction: "left", target: 1088, axis: "x", comparison: "lte" }));

  const roofReceipts = [];
  for (const step of roofRoute) {
    const receipt = await move(step);
    roofReceipts.push(receipt);
    if (step.capture) {
      await sleep(350);
      screenshots[step.capture] = await capture(step.capture);
    }
  }
  const footprintMove = await move({
    direction: "right",
    target: 336,
    axis: "x",
    comparison: "gte",
  });
  await sleep(100);
  screenshots.footsteps = await capture("footsteps");

  const final = await domSnapshot();
  assert.equal(final.appState, "PLAYING");
  assert.equal(final.hudHidden, false);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    label,
    viewport: width > 0 && height > 0 ? { width, height } : "browser-default",
    slowNetwork,
    loadingSamples,
    entryMilestones,
    memoRoute,
    visitedMap,
    sprayerRoute,
    returnRoute,
    roofRoute: roofReceipts,
    footprintMove,
    final,
    screenshots,
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
  await command("Target.closeTarget", { targetId: target.id }).catch(
    () => undefined,
  );
  socket.close();
}

if (!result?.passed) process.exitCode = 1;

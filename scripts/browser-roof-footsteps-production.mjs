import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const label = process.env.ROOF_FOOTSTEPS_LABEL ?? "desktop";
const screenshotDir = process.env.ROOF_FOOTSTEPS_SCREENSHOT_DIR;
const receiptPath = process.env.ROOF_FOOTSTEPS_PRODUCTION_RECEIPT;
const width = Number(process.env.ROOF_FOOTSTEPS_WIDTH ?? 0);
const height = Number(process.env.ROOF_FOOTSTEPS_HEIGHT ?? 0);
const traceRoute = process.env.ROOF_FOOTSTEPS_TRACE === "true";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const route = Object.freeze([
  { direction: "left", target: 552, axis: "x", comparison: "lte" },
  { direction: "down", target: 556, axis: "y", comparison: "gte" },
  { direction: "right", target: 680, axis: "x", comparison: "gte" },
  { direction: "down", target: 616, axis: "y", comparison: "gte" },
  { direction: "left", target: 668, axis: "x", comparison: "lte" },
  {
    direction: "down",
    target: 728,
    axis: "y",
    comparison: "gte",
    screenshotName: "roof-outside",
  },
  { direction: "down", target: 960, axis: "y", comparison: "gte" },
  {
    direction: "left",
    target: 640,
    axis: "x",
    comparison: "lte",
    screenshotName: "roof-inside",
  },
  { direction: "down", target: 1080, axis: "y", comparison: "gte" },
  {
    direction: "right",
    target: 728,
    axis: "x",
    comparison: "gte",
    screenshotName: "roof-after",
  },
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
  left: { key: "ArrowLeft", keyCode: 37 },
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
  });
  return response.result?.value;
}

async function waitForState(expected, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if ((await evaluate("document.body?.dataset.appState")) === expected) return;
    await sleep(50);
  }
  throw new Error(`${expected} timeout`);
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const shot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${label}-${name}.png`);
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  return path;
}

async function initializeProductionSceneQuery() {
  const prototype = await command("Runtime.evaluate", {
    expression: "Phaser.Game.prototype",
  });
  const prototypeObjectId = prototype.result?.objectId;
  assert.ok(prototypeObjectId, "Phaser.Game.prototype is not inspectable");
  const instances = await command("Runtime.queryObjects", {
    prototypeObjectId,
  });
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
  await command("Page.navigate", { url });
  await waitForState("READY", 30000);
  const hooks = {
    debug: await evaluate("typeof window.__campusDebug"),
    collision: await evaluate("typeof window.__campusCollisionTest"),
    lifecycle: await evaluate("typeof window.__campusLifecycleTest"),
  };
  assert.deepEqual(hooks, {
    debug: "undefined",
    collision: "undefined",
    lifecycle: "undefined",
  });
  await initializeProductionSceneQuery();
  await evaluate("document.querySelector('#app-play')?.click()");
  await waitForState("PLAYING", 15000);
  // The collision route starts only after the real train has completed at ~17s.
  await sleep(12_500);

  const captures = { trace: [] };
  const steps = [];
  const routeStartedAt = Date.now();
  for (const [index, step] of route.entries()) {
    const receipt = await move(step);
    steps.push(receipt);
    if (traceRoute) {
      captures.trace.push(
        await capture(
          `trace-${String(index + 1).padStart(2, "0")}-${step.direction}`,
        ),
      );
    }
    if (step.screenshotName) {
      await sleep(350);
      captures[step.screenshotName] = await capture(step.screenshotName);
    }
  }
  const footprintMove = await move({
    direction: "right",
    target: 336,
    axis: "x",
    comparison: "gte",
  });
  await sleep(100);
  captures.footsteps = await capture("footsteps");

  const canvas = await evaluate(`(() => {
    const element = document.querySelector('#app canvas');
    const rect = element?.getBoundingClientRect();
    return element && rect ? {
      width: element.width,
      height: element.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
    } : null;
  })()`);
  assert.equal(await evaluate("document.body?.dataset.appState"), "PLAYING");
  assert.equal(canvas?.width, 480);
  assert.equal(canvas?.height, 270);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    label,
    viewport: width > 0 && height > 0 ? { width, height } : "browser-default",
    hooks,
    routeDurationMs: Date.now() - routeStartedAt,
    route: steps,
    footprintMove,
    canvas,
    captures,
    events,
  };
  if (receiptPath) {
    writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (phaserGamesObjectId) {
    await command("Runtime.releaseObject", {
      objectId: phaserGamesObjectId,
    }).catch(() => undefined);
  }
  await command("Target.closeTarget", { targetId: target.id }).catch(
    () => undefined,
  );
  socket.close();
}

if (!result?.passed) process.exitCode = 1;

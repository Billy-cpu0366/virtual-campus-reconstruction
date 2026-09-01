import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const screenshotDir = process.env.MAP_PRODUCTION_SCREENSHOT_DIR;
const receiptPath = process.env.MAP_PRODUCTION_RECEIPT;
const width = Number(process.env.MAP_PRODUCTION_WIDTH ?? 0);
const height = Number(process.env.MAP_PRODUCTION_HEIGHT ?? 0);
const label = process.env.MAP_PRODUCTION_LABEL ?? "desktop";
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

async function waitFor(expression, expected, name, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if ((await evaluate(expression)) === expected) return;
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

async function snapshot() {
  return evaluate(`(() => {
    const rect = (id) => {
      const value = document.getElementById(id)?.getBoundingClientRect();
      return value ? { left: value.left, top: value.top, right: value.right,
        bottom: value.bottom, width: value.width, height: value.height } : null;
    };
    const miniPlayer = document.getElementById('campus-mini-map-player');
    return {
      appState: document.body.dataset.appState,
      hooks: {
        debug: typeof window.__campusDebug,
        collision: typeof window.__campusCollisionTest,
        lifecycle: typeof window.__campusLifecycleTest,
        content: typeof window.__campusContentTest,
      },
      hudHidden: document.getElementById('campus-map-hud')?.hidden,
      rootHidden: document.getElementById('campus-map-root')?.hidden,
      dialogHidden: document.getElementById('campus-map-dialog')?.hidden,
      guideHidden: document.getElementById('content-guide')?.hidden,
      contentHidden: document.getElementById('content-modal')?.hidden,
      contentTitle: document.getElementById('content-title')?.textContent,
      miniMarkers: document.querySelectorAll('[data-mini-map-marker]').length,
      bigMarkers: document.querySelectorAll('[data-big-map-marker]').length,
      disabledMarkers: document.querySelectorAll('[data-big-map-marker]:disabled').length,
      miniLoaded: document.querySelector('#campus-mini-map-frame img')?.complete &&
        document.querySelector('#campus-mini-map-frame img')?.naturalWidth > 0,
      bigLoaded: document.querySelector('#campus-big-map-frame img')?.complete &&
        document.querySelector('#campus-big-map-frame img')?.naturalWidth > 0,
      miniPlayer: { left: miniPlayer?.style.left, top: miniPlayer?.style.top },
      hudRect: rect('campus-map-hud'),
      canvasRect: rect('app'),
    };
  })()`);
}

async function holdRight(durationMs) {
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await sleep(durationMs);
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
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
  await waitFor("document.body?.dataset.appState", "READY", "READY");
  await evaluate("document.getElementById('app-play')?.click()");
  await waitFor("document.body?.dataset.appState", "PLAYING", "PLAYING");
  const initial = await snapshot();
  assert.deepEqual(initial.hooks, {
    debug: "undefined",
    collision: "undefined",
    lifecycle: "undefined",
    content: "undefined",
  });
  assert.equal(initial.hudHidden, false);
  assert.equal(initial.rootHidden, true);
  assert.equal(initial.miniMarkers, 11);
  assert.equal(initial.bigMarkers, 11);
  assert.equal(initial.disabledMarkers, 3);
  assert.equal(initial.miniLoaded, true);
  const screenshots = { hud: await capture("hud") };

  await evaluate("document.getElementById('campus-map-open')?.click()");
  await waitFor(
    "document.getElementById('campus-map-root')?.hidden",
    false,
    "big map",
  );
  const opened = await snapshot();
  assert.equal(opened.appState, "MODAL_OPEN");
  assert.equal(opened.hudHidden, true);
  assert.equal(opened.dialogHidden, false);
  assert.equal(opened.guideHidden, true);
  assert.equal(opened.bigLoaded, true);
  screenshots.bigMap = await capture("big-map");

  await evaluate("document.querySelector('[data-big-map-marker=\"cv\"]')?.click()");
  assert.equal((await snapshot()).rootHidden, false);
  await evaluate("document.querySelector('[data-big-map-marker=\"memo6\"]')?.click()");
  await waitFor(
    "document.getElementById('content-modal')?.hidden",
    false,
    "Memo6 content",
  );
  const content = await snapshot();
  assert.equal(content.appState, "MODAL_OPEN");
  assert.equal(content.rootHidden, true);
  assert.equal(content.guideHidden, true);
  assert.ok(content.contentTitle.length > 0);
  screenshots.content = await capture("memo6-direct");
  await evaluate("document.getElementById('content-close')?.click()");
  await waitFor("document.body?.dataset.appState", "PLAYING", "content close");

  const beforeMove = await snapshot();
  await holdRight(700);
  await sleep(250);
  const afterMove = await snapshot();
  assert.notDeepEqual(afterMove.miniPlayer, beforeMove.miniPlayer);
  assert.equal(afterMove.hudHidden, false);
  screenshots.moved = await capture("hud-moved");

  await evaluate("document.getElementById('campus-map-open')?.click()");
  await waitFor(
    "document.getElementById('campus-map-root')?.hidden",
    false,
    "reopened map",
  );
  await evaluate("document.getElementById('campus-map-backdrop')?.click()");
  await waitFor("document.body?.dataset.appState", "PLAYING", "backdrop close");
  const closed = await snapshot();
  assert.equal(closed.hudHidden, false);
  assert.equal(closed.rootHidden, true);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    viewport: width > 0 && height > 0 ? { width, height } : "browser-default",
    initial,
    opened,
    content,
    movement: { before: beforeMove.miniPlayer, after: afterMove.miniPlayer },
    closed,
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

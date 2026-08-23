import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl = process.argv[2] ?? "http://127.0.0.1:4175/";
const targetUrl = new URL(inputUrl);
targetUrl.searchParams.set("collision-test", "1");
targetUrl.searchParams.set("lifecycle-test", "1");
targetUrl.searchParams.set("content-smoke", "1");
targetUrl.searchParams.set("map-smoke", String(Date.now()));
const url = targetUrl.toString();
const screenshotDir = process.env.MAP_SMOKE_SCREENSHOT_DIR;
const receiptPath = process.env.MAP_SMOKE_RECEIPT;
const width = Number(process.env.MAP_SMOKE_WIDTH ?? 0);
const height = Number(process.env.MAP_SMOKE_HEIGHT ?? 0);
const label = process.env.MAP_SMOKE_LABEL ?? "desktop";
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

async function waitFor(predicate, labelName, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate("window.__campusDebug?.() ?? null");
    if (value && predicate(value)) return value;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${labelName}`);
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${label}-${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
}

async function domSnapshot() {
  return evaluate(`(() => {
    const rect = (id) => {
      const value = document.getElementById(id)?.getBoundingClientRect();
      return value ? { left: value.left, top: value.top, right: value.right,
        bottom: value.bottom, width: value.width, height: value.height } : null;
    };
    return {
      appState: document.body.dataset.appState,
      hudHidden: document.getElementById('campus-map-hud')?.hidden,
      rootHidden: document.getElementById('campus-map-root')?.hidden,
      dialogHidden: document.getElementById('campus-map-dialog')?.hidden,
      contentHidden: document.getElementById('content-modal')?.hidden,
      contentTitle: document.getElementById('content-title')?.textContent,
      miniMarkers: document.querySelectorAll('[data-mini-map-marker]').length,
      bigMarkers: document.querySelectorAll('[data-big-map-marker]').length,
      disabledMarkers: document.querySelectorAll('[data-big-map-marker]:disabled').length,
      visitedMini: document.querySelectorAll('[data-mini-map-marker].visited').length,
      visitedBig: document.querySelectorAll('[data-big-map-marker].visited').length,
      miniLoaded: document.querySelector('#campus-mini-map-frame img')?.complete &&
        document.querySelector('#campus-mini-map-frame img')?.naturalWidth > 0,
      bigLoaded: document.querySelector('#campus-big-map-frame img')?.complete &&
        document.querySelector('#campus-big-map-frame img')?.naturalWidth > 0,
      activeId: document.activeElement?.id ?? '',
      hudRect: rect('campus-map-hud'),
      guideRect: rect('content-guide'),
      joystickRect: rect('campus-joystick'),
    };
  })()`);
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
  await waitFor((snapshot) => snapshot.entry?.sceneReady === true, "scene ready");
  await evaluate("document.querySelector('#app-play')?.click()");
  const playing = await waitFor(
    (snapshot) =>
      snapshot.entry?.snapshot?.status === "playable" &&
      snapshot.content?.map?.hudHidden === false,
    "playable map HUD",
    60000,
  );
  const initialDom = await domSnapshot();
  assert.equal(initialDom.appState, "PLAYING");
  assert.equal(initialDom.hudHidden, false);
  assert.equal(initialDom.rootHidden, true);
  assert.equal(initialDom.miniMarkers, 11);
  assert.equal(initialDom.bigMarkers, 11);
  assert.equal(initialDom.disabledMarkers, 3);
  assert.equal(initialDom.miniLoaded, true);
  assert.equal(playing.content.map.playerPercent.x > 0, true);
  const screenshots = { hud: await capture("hud") };

  await evaluate("document.getElementById('campus-map-open')?.click()");
  const opened = await waitFor(
    (snapshot) => snapshot.content?.map?.mapOpen === true,
    "big map open",
  );
  const openDom = await domSnapshot();
  assert.equal(openDom.appState, "MODAL_OPEN");
  assert.equal(openDom.hudHidden, true);
  assert.equal(openDom.rootHidden, false);
  assert.equal(openDom.dialogHidden, false);
  assert.equal(openDom.bigLoaded, true);
  assert.equal(openDom.activeId, "campus-map-close");
  assert.equal(opened.content.controlsDisabled, true);
  screenshots.bigMap = await capture("big-map");

  await evaluate("document.querySelector('[data-big-map-marker=\"cv\"]')?.click()");
  assert.equal((await domSnapshot()).rootHidden, false);
  await evaluate("document.querySelector('[data-big-map-marker=\"memo6\"]')?.click()");
  const directContent = await waitFor(
    (snapshot) =>
      snapshot.content?.active?.menuId === "memo6" &&
      snapshot.content?.map?.rootHidden === true,
    "map selected Memo6",
  );
  const directDom = await domSnapshot();
  assert.equal(directDom.appState, "MODAL_OPEN");
  assert.equal(directDom.contentHidden, false);
  assert.ok(directDom.contentTitle.length > 0);
  assert.equal(directContent.content.controlsDisabled, true);
  screenshots.directContent = await capture("memo6-direct");
  await evaluate("document.getElementById('content-close')?.click()");
  await waitFor(
    (snapshot) =>
      snapshot.content?.active === null &&
      snapshot.content?.map?.hudHidden === false,
    "direct content close",
  );

  await evaluate(`(() => {
    window.__campusContentTest.setPlayerPosition(496, 176);
    return window.__campusContentTest.tick();
  })()`);
  await waitFor(
    (snapshot) =>
      snapshot.content?.active?.menuId === "memo6" &&
      snapshot.content?.visited?.includes("memo6"),
    "physical Memo6 visit",
  );
  await evaluate("document.getElementById('content-close')?.click()");
  await waitFor(
    (snapshot) => snapshot.content?.active === null,
    "physical content close",
  );
  await evaluate("document.getElementById('campus-map-open')?.click()");
  const visited = await waitFor(
    (snapshot) =>
      snapshot.content?.map?.mapOpen === true &&
      snapshot.content?.map?.visitedMarkerIds?.includes("memo6"),
    "visited map marker",
  );
  const visitedDom = await domSnapshot();
  assert.equal(visitedDom.visitedMini, 1);
  assert.equal(visitedDom.visitedBig, 1);
  screenshots.visited = await capture("visited");
  await evaluate("document.getElementById('campus-map-close')?.click()");

  const shutdown = await evaluate("window.__campusLifecycleTest.shutdown()");
  assert.equal(shutdown.mapHudHidden, true);
  assert.equal(shutdown.mapRootHidden, true);
  assert.equal(shutdown.mapLeaseActive, false);
  assert.deepEqual(shutdown.sideFailures, []);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    viewport: width > 0 && height > 0 ? { width, height } : "browser-default",
    initial: initialDom,
    opened: openDom,
    directContent: directDom,
    visited: { dom: visitedDom, map: visited.content.map },
    shutdown,
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

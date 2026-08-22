import assert from "node:assert/strict";

import { clickPlay } from "./browser-app-actions.mjs";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const entryUrl = new URL(inputUrl);
entryUrl.searchParams.set("entry-smoke", String(Date.now()));
const url = entryUrl.toString();
const timeoutMs = Number(process.env.ENTRY_SMOKE_TIMEOUT_MS ?? "12000");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${endpoint}: ${response.status}`);
  }
  return response.json();
}

const target = await fetchJson(
  `${cdpUrl}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };

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
  if (message.method === "Runtime.consoleAPICalled") {
    if (message.params.type === "error" || message.params.type === "warning") {
      events.console.push({
        type: message.params.type,
        args: message.params.args?.map((arg) => arg.value ?? arg.description),
      });
    }
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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
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

const snapshotExpression = `(() => {
  const entry = window.__campusEntryTest?.snapshot();
  const debug = window.__campusDebug?.();
  const canvas = document.querySelector("#app canvas");
  const rect = canvas?.getBoundingClientRect();
  return {
    bodyState: document.body?.dataset.appState ?? null,
    entry: entry === undefined ? null : {
      ...entry,
      shellHidden: document.getElementById("app-shell")?.hidden ?? true,
      playHidden: document.getElementById("app-play")?.hidden ?? true,
      playDisabled: document.getElementById("app-play")?.disabled ?? true,
    },
    debug,
    canvas: canvas ? {
      width: canvas.width,
      height: canvas.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
    } : null,
  };
})()`;

async function waitFor(predicate, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await evaluate(snapshotExpression);
    if (predicate(snapshot)) return snapshot;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${label}`);
}

try {
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Page.navigate", { url });

  const observedStates = new Set();
  const readyStartedAt = Date.now();
  let ready;
  while (Date.now() - readyStartedAt < timeoutMs) {
    const snapshot = await evaluate(snapshotExpression);
    if (snapshot?.bodyState !== null) observedStates.add(snapshot.bodyState);
    if (snapshot?.entry?.app?.status === "READY" && snapshot?.debug?.entry?.sceneReady) {
      ready = snapshot;
      break;
    }
    await sleep(25);
  }
  assert.ok(ready !== undefined, "entry did not reach ready");
  assert.ok(observedStates.has("LOADING"), "loading state was not observed");
  assert.equal(ready.entry.app.progress, 1);
  assert.equal(ready.entry.playHidden, false);
  assert.equal(ready.entry.playDisabled, false);
  assert.equal(ready.debug.player.visible, false);
  assert.equal(ready.debug.playerRuntime.control.enabled, false);
  assert.equal(ready.canvas.width, 480);
  assert.equal(ready.canvas.height, 270);
  assert.ok(Math.abs(ready.canvas.cssWidth / ready.canvas.cssHeight - 16 / 9) < 0.01);
  assert.equal(ready.debug.camera.zoom, 1);
  assert.equal(ready.debug.camera.roundPixels, true);
  const readyCenter = {
    x: ready.debug.camera.scrollX + 480 / 2,
    y: ready.debug.camera.scrollY + 270 / 2,
  };
  assert.ok(Math.abs(readyCenter.x - 944) < 1);
  assert.ok(Math.abs(readyCenter.y - 928) < 1);

  const clickedAt = Date.now();
  const clickedPoint = await clickPlay(command, evaluate, timeoutMs);
  const entering = await waitFor(
    (snapshot) => snapshot?.entry?.app?.status === "ENTERING_GAME",
    "entry transition",
  );
  assert.equal(entering.entry.shellHidden, true);
  assert.equal(entering.debug.player.visible, true);
  assert.equal(entering.debug.entry.leaseCount, 1);
  assert.equal(entering.debug.playerRuntime.control.enabled, false);
  assert.equal(entering.debug.entry.train, "entering");

  const cameraStable = await waitFor(
    (snapshot) => snapshot?.debug?.entry?.snapshot?.cameraStable === true,
    "camera stable receipt",
  );
  const cameraElapsedMs = Date.now() - clickedAt;
  assert.ok(cameraElapsedMs >= 2800, `camera settled too early: ${cameraElapsedMs}ms`);
  assert.ok(cameraElapsedMs < 4200, `camera settled too late: ${cameraElapsedMs}ms`);
  assert.equal(cameraStable.debug.entry.snapshot.trainArrived, false);
  assert.equal(cameraStable.debug.entry.snapshot.status, "entering");
  assert.equal(cameraStable.debug.playerRuntime.control.enabled, false);
  assert.equal(cameraStable.debug.entry.leaseCount, 1);
  assert.ok(
    Math.abs(
      (cameraStable.debug.player.x - cameraStable.debug.camera.scrollX) - 240,
    ) < 2,
  );
  assert.ok(
    Math.abs(
      (cameraStable.debug.player.y - cameraStable.debug.camera.scrollY) - 135,
    ) < 2,
  );

  const playable = await waitFor(
    (snapshot) => snapshot?.entry?.app?.status === "PLAYING",
    "playable receipt",
  );
  const playableElapsedMs = Date.now() - clickedAt;
  assert.ok(playableElapsedMs >= 4800, `train arrived too early: ${playableElapsedMs}ms`);
  assert.ok(playableElapsedMs < 6500, `train arrived too late: ${playableElapsedMs}ms`);
  assert.equal(playable.debug.entry.snapshot.cameraStable, true);
  assert.equal(playable.debug.entry.snapshot.trainArrived, true);
  assert.equal(playable.debug.entry.train, "arrived");
  assert.equal(playable.debug.side.train.state, "holding");
  assert.equal(playable.debug.side.trainHasSprite, true);
  assert.equal(playable.debug.side.trainHasCollisionShape, true);
  assert.equal(playable.debug.side.trainColliderActive, true);
  assert.ok(playable.debug.side.trainBlockingCellCount > 0);
  assert.equal(playable.debug.entry.leaseCount, 0);
  assert.equal(playable.debug.playerRuntime.control.enabled, true);
  assert.equal(playable.entry.guideHidden, false);
  assert.match(playable.entry.guideText, /MEMO6/);
  assert.equal(playable.debug.cameraRuntime.status, null);
  assert.equal(playable.debug.cameraRuntime.result, null);
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  console.log(JSON.stringify({
    ok: true,
    url,
    observedStates: [...observedStates],
    clickedPoint,
    cameraElapsedMs,
    playableElapsedMs,
    ready,
    entering,
    cameraStable,
    playable,
    events,
  }, null, 2));
} finally {
  socket.close();
  await fetch(`${cdpUrl}/json/close/${target.id}`).catch(() => {});
}

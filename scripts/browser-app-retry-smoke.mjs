import assert from "node:assert/strict";

import { clickPlay, clickRetry, waitForAppStatus } from "./browser-app-actions.mjs";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const smokeUrl = new URL(inputUrl);
smokeUrl.searchParams.set("app-retry-smoke", String(Date.now()));
const url = smokeUrl.toString();
const timeoutMs = Number(process.env.APP_RETRY_SMOKE_TIMEOUT_MS ?? 30000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) throw new Error(`${endpoint}: ${response.status}`);
  return response.json();
}

const target = await fetchJson(
  `${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`,
  { method: "PUT" },
);
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
let remainingChunkFailures = 2;
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
  if (message.method === "Fetch.requestPaused") {
    const requestUrl = message.params.request.url;
    if (remainingChunkFailures > 0 && requestUrl.endsWith("/maps/chunks/chunk0.json")) {
      remainingChunkFailures -= 1;
      void command("Fetch.failRequest", {
        requestId: message.params.requestId,
        errorReason: "Failed",
      });
    } else {
      void command("Fetch.continueRequest", {
        requestId: message.params.requestId,
      });
    }
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

async function appSnapshot() {
  return evaluate(`(() => ({
    hook: window.__campusEntryTest?.snapshot() ?? null,
    state: document.body?.dataset.appState ?? null,
    generation: Number(document.body?.dataset.appGeneration ?? 0),
    activeId: document.activeElement?.id ?? "",
    canvasCount: document.querySelectorAll("#app canvas").length,
    debug: window.__campusDebug?.() ?? null,
  }))()`);
}

async function waitForSnapshot(predicate, label) {
  const startedAt = Date.now();
  let lastSnapshot;
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await appSnapshot();
    lastSnapshot = snapshot;
    if (predicate(snapshot)) return snapshot;
    await sleep(50);
  }
  throw new Error(
    `timed out waiting for ${label}: ${JSON.stringify({
      remainingChunkFailures,
      lastSnapshot,
      events,
    })}`,
  );
}

try {
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Fetch.enable", {
    patterns: [{ urlPattern: "*", requestStage: "Request" }],
  });
  await command("Page.navigate", { url });

  const error = await waitForSnapshot(
    (snapshot) =>
      snapshot.state === "ERROR" &&
      snapshot.generation === 1 &&
      snapshot.hook?.cleanup?.generation === 1 &&
      snapshot.hook?.currentGeneration === null &&
      snapshot.canvasCount === 0,
    "generation 1 cleanup after required chunk failure",
  );
  assert.equal(remainingChunkFailures, 0);
  assert.equal(error.activeId, "app-retry");
  assert.equal(error.canvasCount, 0);
  assert.equal(error.hook.cleanup.receipt.trainColliderActive, false);
  assert.equal(error.hook.cleanup.receipt.trainBlockingCellCount, 0);
  assert.equal(error.hook.cleanup.receipt.physicsColliderCount, 0);

  await command("Fetch.disable");
  const retryPoint = await clickRetry(command, evaluate, timeoutMs);
  const ready = await waitForSnapshot(
    (snapshot) =>
      snapshot.state === "READY" &&
      snapshot.generation === 2 &&
      snapshot.hook?.currentGeneration === 2 &&
      snapshot.canvasCount === 1 &&
      snapshot.debug?.entry?.sceneReady === true,
    "generation 2 ready",
  );
  assert.equal(ready.activeId, "app-play");
  assert.equal(ready.debug.side.sprayer.started, true);
  assert.ok(["emitting", "paused"].includes(ready.debug.side.smoke.state));

  const playPoint = await clickPlay(command, evaluate, timeoutMs);
  await waitForAppStatus(evaluate, "PLAYING", timeoutMs);
  const playing = await waitForSnapshot(
    (snapshot) =>
      snapshot.state === "PLAYING" &&
      snapshot.generation === 2 &&
      snapshot.debug?.entry?.snapshot?.status === "playable" &&
      snapshot.debug?.side?.train?.state === "holding",
    "generation 2 playable",
  );
  await sleep(500);
  const stable = await appSnapshot();
  assert.equal(stable.state, "PLAYING");
  assert.equal(stable.generation, 2);
  assert.equal(stable.canvasCount, 1);
  assert.equal(stable.hook.cleanup.generation, 1);

  assert.equal(events.failedRequests.length, 2);
  assert.ok(
    events.failedRequests.every((failure) => failure.errorText === "net::ERR_FAILED"),
  );
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.badResponses, []);

  console.log(JSON.stringify({
    ok: true,
    url,
    error,
    retryPoint,
    ready,
    playPoint,
    playing,
    stable,
    events,
  }, null, 2));
} finally {
  socket.close();
  await fetch(`${cdpUrl}/json/close/${target.id}`).catch(() => {});
}

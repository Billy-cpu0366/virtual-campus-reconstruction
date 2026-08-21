import assert from "node:assert/strict";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.argv[2] ?? "http://127.0.0.1:4175/";
const waitMs = Number(process.env.LAYER_SMOKE_WAIT_MS ?? "7000");

async function jsonFetch(targetUrl, options) {
  const response = await fetch(targetUrl, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${targetUrl}: ${response.status}`);
  }
  return response.json();
}

const target = await jsonFetch(
  `${cdpUrl}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (request === undefined) return;
  pending.delete(message.id);
  if (message.error !== undefined) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result ?? {});
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
    throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed");
  }
  return result.result?.value;
}

try {
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Page.navigate", { url });
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  const debug = await evaluate(
    "window.__campusDebug ? window.__campusDebug() : null",
  );
  assert.ok(debug !== null, "campus debug state is unavailable");
  assert.deepEqual(debug.state.failed, [], "dynamic world has failed chunks");
  assert.ok(debug.rendererLayers > 0, "no visual layers were rendered");
  assert.ok(debug.markerRecords > 0, "no marker records were retained");
  assert.ok(
    debug.particles3Diagnostics > 0,
    "particles3 unconsumed diagnostics were not retained",
  );
  assert.deepEqual(debug.roofStates.concert, {
    group: "concert",
    state: "visible",
    visible: true,
    alpha: 1,
    durationMs: 300,
  });
  assert.deepEqual(debug.roofStates.factory, {
    group: "factory",
    state: "visible",
    visible: true,
    alpha: 1,
    durationMs: 300,
  });

  console.log(JSON.stringify({ ok: true, url, debug }, null, 2));
} finally {
  socket.close();
  await fetch(`${cdpUrl}/json/close/${target.id}`).catch(() => {});
}

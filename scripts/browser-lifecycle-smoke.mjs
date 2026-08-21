const base = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const inputUrl =
  process.argv[2] ??
  "http://127.0.0.1:4175/";
const lifecycleUrl = new URL(inputUrl);
lifecycleUrl.searchParams.set("lifecycle-test", "1");
lifecycleUrl.searchParams.set("lifecycle-smoke", String(Date.now()));
const url = lifecycleUrl.toString();
const waitMs = Number(process.env.LIFECYCLE_WAIT_MS ?? 3500);
const maxChunks = 25;
const maxRendererLayers = maxChunks * 19;
const maxMarkerRecords = 4109;

const targetResponse = await fetch(
  `${base}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) {
  throw new Error(`could not create target: ${targetResponse.status}`);
}
const target = await targetResponse.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

const pending = new Map();
let nextId = 0;
const events = {
  exceptions: [],
  failedRequests: [],
  badResponses: [],
};

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
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
      events.badResponses.push({
        url: response.url,
        status: response.status,
      });
    }
  }
});

function command(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, (message) => {
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result ?? {});
    });
  });
}

async function evaluate(expression, awaitPromise = false) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result?.value;
}

await command("Runtime.enable");
await command("Network.enable");
await command("Page.enable");
await command("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, waitMs));

const before = await evaluate(`(() => {
  const debug = window.__campusDebug?.();
  const chunks = [...new Set(
    performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/maps/chunks/chunk")),
  )];
  return {
    debug,
    debugHook: typeof window.__campusDebug,
    lifecycleHook: typeof window.__campusLifecycleTest,
    chunks,
  };
})()`);

await evaluate(
  "window.__campusLifecycleTest.shutdown()",
  true,
);
await new Promise((resolve) => setTimeout(resolve, 100));

const after = await evaluate(`(() => ({
  debugHook: typeof window.__campusDebug,
  lifecycleHook: typeof window.__campusLifecycleTest,
  collisionHook: typeof window.__campusCollisionTest,
}))()`);

const result = {
  url,
  before,
  after,
  bounds: {
    maxChunks,
    maxRendererLayers,
    maxMarkerRecords,
  },
  events,
  passed:
    before?.debugHook === "function" &&
    before?.lifecycleHook === "object" &&
    before?.debug?.state?.destroyed === false &&
    before?.chunks?.length > 0 &&
    before.chunks.length <= maxChunks &&
    before.debug.rendererLayers <= maxRendererLayers &&
    before.debug.markerRecords <= maxMarkerRecords &&
    after?.debugHook === "undefined" &&
    after?.lifecycleHook === "undefined" &&
    after?.collisionHook === "undefined" &&
    events.exceptions.length === 0 &&
    events.failedRequests.length === 0 &&
    events.badResponses.length === 0,
};
console.log(JSON.stringify(result, null, 2));
await command("Target.closeTarget", { targetId: target.id });
ws.close();
if (!result.passed) process.exitCode = 1;

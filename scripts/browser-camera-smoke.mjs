import { clickPlay } from "./browser-app-actions.mjs";

const base = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const inputUrl =
  process.argv[2] ??
  process.env.SMOKE_URL ??
  "http://127.0.0.1:4175/";
const directEntryUrl = new URL(inputUrl);
directEntryUrl.searchParams.delete("camera-smoke");
const url = directEntryUrl.toString();
const cameraUrl = new URL(inputUrl);
cameraUrl.searchParams.set("camera-smoke", String(Date.now()));
const tourUrl = cameraUrl.toString();
const timeoutMs = Number(process.env.CAMERA_SMOKE_TIMEOUT_MS ?? 20000);
const pollMs = Number(process.env.CAMERA_SMOKE_POLL_MS ?? 50);

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
    const details = message.params.exceptionDetails;
    events.exceptions.push({
      description:
        details?.exception?.description ?? details?.text ?? "unknown",
      timestamp: details?.timestamp ?? null,
      stack: (details?.stackTrace?.callFrames ?? []).map((frame) => ({
        functionName: frame.functionName,
        url: frame.url,
        lineNumber: frame.lineNumber,
        columnNumber: frame.columnNumber,
      })),
    });
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

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result?.value;
}

const snapshotExpression = `(() => {
  const debug = window.__campusDebug?.();
  const chunks = [...new Set(
    performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/maps/chunks/chunk")),
  )];
  return {
    href: window.location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    debug,
    chunks,
  };
})()`;

await command("Runtime.enable");
await command("Network.enable");
await command("Page.enable");
await command("Page.navigate", { url });
await clickPlay(command, evaluate, timeoutMs);

let directEntry;
const directStartedAt = Date.now();
while (Date.now() - directStartedAt < timeoutMs) {
  await new Promise((resolve) => setTimeout(resolve, pollMs));
  const snapshot = await evaluate(snapshotExpression);
  if (
    snapshot?.href === url &&
    snapshot?.debug?.entry?.snapshot?.status === "playable"
  ) {
    directEntry = snapshot;
    break;
  }
}
await new Promise((resolve) => setTimeout(resolve, 600));
const settledDirectEntry = await evaluate(snapshotExpression);
if (
  settledDirectEntry?.href !== url ||
  settledDirectEntry?.debug?.entry?.snapshot?.status !== "playable"
) {
  throw new Error("direct-entry page did not settle on the expected URL");
}
directEntry = settledDirectEntry;
const directEvents = {
  exceptions: [...events.exceptions],
  failedRequests: [...events.failedRequests],
  badResponses: [...events.badResponses],
};
events.exceptions.length = 0;
events.failedRequests.length = 0;
events.badResponses.length = 0;

await command("Page.navigate", { url: tourUrl });
await clickPlay(command, evaluate, timeoutMs);

const samples = [];
let sawRunning = false;
let sawLockedControls = false;
let completed;
const startedAt = Date.now();
while (Date.now() - startedAt < timeoutMs) {
  await new Promise((resolve) => setTimeout(resolve, pollMs));
  const snapshot = await evaluate(snapshotExpression);
  if (snapshot?.href !== tourUrl || snapshot?.debug === undefined) continue;
  samples.push(snapshot);
  const runtime = snapshot.debug.cameraRuntime;
  if (runtime?.status === "running") sawRunning = true;
  if (
    runtime?.status === "running" &&
    snapshot.debug.playerRuntime?.control?.enabled === false
  ) {
    sawLockedControls = true;
  }
  if (runtime?.status === "completed" && runtime?.result === "completed") {
    completed = snapshot;
    break;
  }
}

await new Promise((resolve) => setTimeout(resolve, 600));
const settled = await evaluate(snapshotExpression);
if (settled?.href !== tourUrl || settled?.debug === undefined) {
  throw new Error("camera-tour page did not settle on the expected URL");
}
const chunkCounts = samples.map((sample) => sample.chunks.length);
const minChunkCount = chunkCounts.length > 0 ? Math.min(...chunkCounts) : 0;
const maxChunkCount = chunkCounts.length > 0 ? Math.max(...chunkCounts) : 0;
const effects = settled?.debug?.cameraRuntime?.effectAvailability;
const nativeScale = settled?.debug?.cameraRuntime?.nativeScaleSettings;
const directPlayer = directEntry?.debug?.player;
const directCamera = directEntry?.debug?.camera;
const directZoom = directCamera?.zoom;
const directPlayerVisible =
  Number.isFinite(directPlayer?.x) &&
  Number.isFinite(directPlayer?.y) &&
  Number.isFinite(directCamera?.scrollX) &&
  Number.isFinite(directCamera?.scrollY) &&
  Number.isFinite(directZoom) &&
  directZoom > 0 &&
  (directPlayer.x - directCamera.scrollX) * directZoom >= 0 &&
  (directPlayer.x - directCamera.scrollX) * directZoom <=
    directEntry?.viewport?.width &&
  (directPlayer.y - directCamera.scrollY) * directZoom >= 0 &&
  (directPlayer.y - directCamera.scrollY) * directZoom <=
    directEntry?.viewport?.height;

const result = {
  directEntryUrl: url,
  tourUrl,
  directEntry,
  directEvents,
  directPlayerVisible,
  sampleCount: samples.length,
  sawRunning,
  sawLockedControls,
  completed,
  settled,
  chunkCounts: { min: minChunkCount, max: maxChunkCount },
  events,
  passed:
    directEntry?.debug?.cameraRuntime?.status === null &&
    directEntry?.debug?.cameraRuntime?.result === null &&
    directEntry?.debug?.cameraRuntime?.controlDisables === 0 &&
    directEntry?.debug?.cameraRuntime?.controlEnables === 0 &&
    directEntry?.debug?.playerRuntime?.control?.enabled === true &&
    directPlayerVisible &&
    directEvents.exceptions.length === 0 &&
    directEvents.failedRequests.length === 0 &&
    directEvents.badResponses.length === 0 &&
    sawRunning &&
    sawLockedControls &&
    completed?.debug?.cameraRuntime?.controlDisables === 1 &&
    settled?.debug?.cameraRuntime?.controlEnables === 1 &&
    settled?.debug?.cameraRuntime?.viewportUpdates > 6 &&
    settled?.debug?.cameraRuntime?.pendingViewport === null &&
    settled?.debug?.playerRuntime?.control?.enabled === true &&
    settled?.debug?.camera?.zoom === 1 &&
    settled?.debug?.camera?.roundPixels === true &&
    nativeScale?.nativeScale > 0 &&
    nativeScale?.blurStrength === 16 * nativeScale.nativeScale &&
    effects?.HeatHaze === "unavailable" &&
    effects?.Fire === "unavailable" &&
    effects?.Morph === "unavailable" &&
    (maxChunkCount > minChunkCount || minChunkCount === 25) &&
    events.exceptions.length === 0 &&
    events.failedRequests.length === 0 &&
    events.badResponses.length === 0,
};
console.log(JSON.stringify(result, null, 2));
await command("Target.closeTarget", { targetId: target.id });
ws.close();
if (!result.passed) process.exitCode = 1;

import { writeFileSync } from "node:fs";

const base = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const inputUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const chunkUrl = new URL(inputUrl);
chunkUrl.searchParams.set("collision-test", "1");
chunkUrl.searchParams.set("entry-autoplay", "1");
chunkUrl.searchParams.set("chunk-smoke", String(Date.now()));
const url = chunkUrl.toString();
const screenshotPath = process.env.SMOKE_SCREENSHOT;
const initialWaitMs = Number(process.env.CHUNK_INITIAL_WAIT_MS ?? 7500);
const targetWaitMs = Number(process.env.CHUNK_TARGET_WAIT_MS ?? 2000);
const targetPosition = Object.freeze({
  x: Number(process.env.CHUNK_TARGET_X ?? 224),
  y: Number(process.env.CHUNK_TARGET_Y ?? 2016),
});

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

await command("Runtime.enable");
await command("Network.enable");
await command("Page.enable");
await command("Page.navigate", { url });

const chunkResources = () => `performance.getEntriesByType("resource")
  .map((entry) => entry.name)
  .filter((name) => name.includes("/maps/chunks/chunk"))`;
async function waitForSettledDebug(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const debug = await evaluate(
      "window.__campusDebug ? window.__campusDebug() : null",
    );
    if (
      debug?.entry?.snapshot?.status === "playable" &&
      debug?.state?.requesting?.length === 0 &&
      debug?.state?.rendered?.length > 0
    ) {
      return debug;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("chunk runtime did not settle");
}

const beforeDebug = await waitForSettledDebug(initialWaitMs + 10000);
const before = await evaluate(chunkResources());
const targetHookType = await evaluate(
  "typeof window.__campusCollisionTest",
);
if (targetHookType !== "object") {
  throw new Error("chunk target test hook is unavailable");
}
await evaluate(
  `window.__campusCollisionTest.setPlayerPosition(` +
    `${targetPosition.x}, ${targetPosition.y})`,
);
await new Promise((resolve) => setTimeout(resolve, targetWaitMs));
const afterDebug = await waitForSettledDebug(targetWaitMs + 10000);
const after = await evaluate(chunkResources());
const uniqueBefore = [...new Set(before)];
const uniqueAfter = [...new Set(after)];
const newRequests = uniqueAfter.filter((name) => !uniqueBefore.includes(name));
const allChunksPreloaded = uniqueBefore.length === 25;
const chunk20Requested = uniqueAfter.some((name) =>
  name.endsWith("/maps/chunks/chunk20.json"),
);

const masterResponse = await fetch(new URL("/maps/chunks/master.json", url));
if (!masterResponse.ok) {
  throw new Error(`could not load chunk master: ${masterResponse.status}`);
}
const master = await masterResponse.json();
const chunksHorizontal = master.nbChunksHorizontal;
if (!Number.isInteger(chunksHorizontal) || chunksHorizontal <= 0) {
  throw new Error("chunk master has invalid nbChunksHorizontal");
}
const chunkFile = ({ x, y }) => `chunk${y * chunksHorizontal + x}.json`;
const expectedBefore = (beforeDebug?.state?.targets ?? []).map(chunkFile);
const expectedAfterTargets = (afterDebug?.state?.targets ?? []).map(chunkFile);
const expectedAfter = [...new Set([...expectedBefore, ...expectedAfterTargets])];
const expectedNew = expectedAfter.filter(
  (name) => !expectedBefore.includes(name),
);
const actualFiles = (resources) => resources.map((resource) =>
  new URL(resource).pathname.split("/").at(-1),
);
const sameFiles = (left, right) =>
  left.length === right.length &&
  [...left].sort().every((name, index) => name === [...right].sort()[index]);
const actualBefore = actualFiles(uniqueBefore);
const actualAfter = actualFiles(uniqueAfter);
const actualNew = actualFiles(newRequests);

if (screenshotPath) {
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

const result = {
  url,
  targetPosition,
  targetHookType,
  initialChunks: uniqueBefore,
  afterTargetChunks: uniqueAfter,
  newChunksAfterTarget: newRequests,
  expected: {
    before: expectedBefore,
    after: expectedAfter,
    newAfterTarget: expectedNew,
  },
  coordinator: {
    before: beforeDebug?.state ?? null,
    after: afterDebug?.state ?? null,
  },
  allChunksPreloaded,
  chunk20Requested,
  events,
  screenshotPath: screenshotPath ?? null,
  passed:
    (allChunksPreloaded
      ? uniqueBefore.length === 25 &&
        uniqueAfter.length === 25 &&
        newRequests.length === 0
      : expectedNew.length > 0 &&
        sameFiles(actualBefore, expectedBefore) &&
        sameFiles(actualAfter, expectedAfter) &&
        sameFiles(actualNew, expectedNew)) &&
    chunk20Requested &&
    (beforeDebug?.state?.failed?.length ?? -1) === 0 &&
    (afterDebug?.state?.failed?.length ?? -1) === 0 &&
    events.exceptions.length === 0 &&
    events.failedRequests.length === 0 &&
    events.badResponses.length === 0,
};
console.log(JSON.stringify(result, null, 2));
await command("Target.closeTarget", { targetId: target.id });
ws.close();
if (!result.passed) process.exitCode = 1;

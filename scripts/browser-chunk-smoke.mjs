import { writeFileSync } from "node:fs";

const base = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const url = process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const screenshotPath = process.env.SMOKE_SCREENSHOT;
const initialWaitMs = Number(process.env.CHUNK_INITIAL_WAIT_MS ?? 2500);
const moveWaitMs = Number(process.env.CHUNK_MOVE_WAIT_MS ?? 3500);
const settleWaitMs = Number(process.env.CHUNK_SETTLE_WAIT_MS ?? 1000);
const moveKeys = (process.env.CHUNK_MOVE_SEQUENCE ?? "ArrowRight,ArrowDown,ArrowRight,ArrowDown")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);
const keyInfoFor = (key) => ({
  ArrowUp: { code: "ArrowUp", windowsVirtualKeyCode: 38 },
  ArrowDown: { code: "ArrowDown", windowsVirtualKeyCode: 40 },
  ArrowLeft: { code: "ArrowLeft", windowsVirtualKeyCode: 37 },
  ArrowRight: { code: "ArrowRight", windowsVirtualKeyCode: 39 },
}[key]);
const keyInfos = moveKeys.map((key) => {
  const info = keyInfoFor(key);
  if (info === undefined) {
    throw new Error(`unsupported CHUNK_MOVE_KEY: ${key}`);
  }
  return info;
});
if (moveKeys.length === 0) {
  throw new Error("CHUNK_MOVE_SEQUENCE must not be empty");
}

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
await new Promise((resolve) => setTimeout(resolve, initialWaitMs));

const chunkResources = () => `performance.getEntriesByType("resource")
  .map((entry) => entry.name)
  .filter((name) => name.includes("/maps/chunks/chunk"))`;
const before = await evaluate(chunkResources());

for (let index = 0; index < moveKeys.length; index += 1) {
  const moveKey = moveKeys[index];
  const keyInfo = keyInfos[index];
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: moveKey,
    ...keyInfo,
  });
  await new Promise((resolve) => setTimeout(resolve, moveWaitMs));
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: moveKey,
    ...keyInfo,
  });
}
await new Promise((resolve) => setTimeout(resolve, settleWaitMs));

const after = await evaluate(chunkResources());
const uniqueBefore = [...new Set(before)];
const uniqueAfter = [...new Set(after)];
const newRequests = uniqueAfter.filter((name) => !uniqueBefore.includes(name));

if (screenshotPath) {
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

const result = {
  url,
  moveKeys,
  initialChunks: uniqueBefore,
  afterMoveChunks: uniqueAfter,
  newChunksAfterMove: newRequests,
  events,
  screenshotPath: screenshotPath ?? null,
  passed:
    uniqueBefore.length > 0 &&
    newRequests.length > 0 &&
    events.exceptions.length === 0 &&
    events.failedRequests.length === 0 &&
    events.badResponses.length === 0,
};
console.log(JSON.stringify(result, null, 2));
await command("Target.closeTarget", { targetId: target.id });
ws.close();
if (!result.passed) process.exitCode = 1;

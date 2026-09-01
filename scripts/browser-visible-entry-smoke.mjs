import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const url =
  process.argv[2] ??
  process.env.VISIBLE_ENTRY_URL ??
  "http://127.0.0.1:4175/";
const label = process.env.VISIBLE_ENTRY_LABEL ?? "desktop";
const screenshotDir = process.env.VISIBLE_ENTRY_SCREENSHOT_DIR;
const receiptPath = process.env.VISIBLE_ENTRY_RECEIPT;
const width = Number(process.env.VISIBLE_ENTRY_WIDTH ?? 0);
const height = Number(process.env.VISIBLE_ENTRY_HEIGHT ?? 0);
const deviceScaleFactor = Number(
  process.env.VISIBLE_ENTRY_DEVICE_SCALE ?? 1,
);
const milestones = Object.freeze([
  { name: "smoke", elapsedMs: 1_000 },
  { name: "train", elapsedMs: 5_200 },
  { name: "ambient-guide", elapsedMs: 18_000 },
]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targetResponse = await fetch(
  `${cdpBase}/json/new?${encodeURIComponent("about:blank")}`,
  { method: "PUT" },
);
if (!targetResponse.ok) {
  throw new Error(`could not create target: ${targetResponse.status}`);
}
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const events = {
  console: [],
  exceptions: [],
  failedRequests: [],
  badResponses: [],
};
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
    events.console.push({
      type: message.params.type,
      args: message.params.args?.map((arg) => arg.value ?? arg.description),
    });
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
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result?.value;
}

async function waitForState(expected, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if ((await evaluate("document.body?.dataset.appState")) === expected) {
      return;
    }
    await sleep(50);
  }
  throw new Error(`${expected} timeout after ${timeoutMs}ms`);
}

async function capture(name) {
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
  });
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const path = join(screenshotDir, `${label}-${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
}

let result;
try {
  await Promise.all([
    command("Page.enable"),
    command("Runtime.enable"),
    command("Network.enable"),
  ]);
  if (width > 0 && height > 0) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor,
      mobile: width <= 480,
      screenWidth: width,
      screenHeight: height,
    });
  }
  await command("Page.navigate", { url });
  await waitForState("READY", 30000);
  const hookTypes = {
    debug: await evaluate("typeof window.__campusDebug"),
    entry: await evaluate("typeof window.__campusEntryTest"),
    lifecycle: await evaluate("typeof window.__campusLifecycleTest"),
  };
  assert.deepEqual(hookTypes, {
    debug: "undefined",
    entry: "undefined",
    lifecycle: "undefined",
  });

  const clicked = await evaluate(`(() => {
    document.querySelector('#app-play')?.click();
    return true;
  })()`);
  assert.equal(clicked, true);
  const clickedAt = Date.now();
  const captures = [];
  for (const milestone of milestones) {
    const remaining = clickedAt + milestone.elapsedMs - Date.now();
    if (remaining > 0) await sleep(remaining);
    captures.push({
      ...milestone,
      actualElapsedMs: Date.now() - clickedAt,
      appState: await evaluate("document.body?.dataset.appState"),
      guideText: await evaluate(
        "document.getElementById('content-guide')?.textContent ?? ''",
      ),
      screenshot: await capture(milestone.name),
    });
  }

  await waitForState("PLAYING", 1000);
  const canvas = await evaluate(`(() => {
    const element = document.querySelector('#app canvas');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      width: element.width,
      height: element.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
    };
  })()`);
  assert.equal(canvas?.width, 480);
  assert.equal(canvas?.height, 270);
  assert.match(captures[1]?.guideText ?? "", /Explore MEMO6/);
  assert.match(
    captures[2]?.guideText ?? "",
    /Trackside crew.*east 20.*south 7.*west 8/,
  );
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    label,
    viewport: width > 0 && height > 0 ? { width, height } : "browser-default",
    hookTypes,
    canvas,
    captures,
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

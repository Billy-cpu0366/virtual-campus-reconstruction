import { writeFileSync } from "node:fs";

const base = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const url =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const screenshotPath = process.env.SMOKE_SCREENSHOT;

if (process.env.SMOKE_CLEANUP_STALE === "true") {
  const staleTargetsResponse = await fetch(`${base}/json/list`);
  if (!staleTargetsResponse.ok) {
    throw new Error(
      `could not list stale targets: ${staleTargetsResponse.status}`,
    );
  }
  const staleTargets = await staleTargetsResponse.json();
  await Promise.all(
    staleTargets
      .filter(({ type }) => type === "page")
      .map(({ id }) => fetch(`${base}/json/close/${id}`)),
  );
}

const targetResponse = await fetch(
  `${base}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) {
  throw new Error(`could not create target: ${targetResponse.status}`);
}
const target = await targetResponse.json();
const events = {
  console: [],
  exceptions: [],
  log: [],
  failedRequests: [],
  badResponses: [],
  responses: [],
};
const pending = new Map();
let nextId = 0;
const ws = new WebSocket(target.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method === "Runtime.consoleAPICalled") {
    const type = message.params.type;
    if (type === "error" || type === "warning") {
      events.console.push({
        type,
        args: message.params.args?.map((arg) => arg.value ?? arg.description),
      });
    }
  }
  if (message.method === "Runtime.exceptionThrown") {
    events.exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text,
    );
  }
  if (message.method === "Log.entryAdded") {
    const entry = message.params.entry;
    if (entry.level === "error" || entry.level === "warning") {
      events.log.push({ level: entry.level, text: entry.text });
    }
  }
  if (message.method === "Network.loadingFailed") {
    events.failedRequests.push({
      url: message.params.url,
      errorText: message.params.errorText,
    });
  }
  if (message.method === "Network.responseReceived") {
    const response = message.params.response;
    const assetRequest =
      response.url.includes("/maps/") ||
      response.url.includes("/sprites/") ||
      response.url.includes("/vendor/");
    if (response.status >= 400) {
      events.badResponses.push({
        url: response.url,
        status: response.status,
      });
    }
    if (assetRequest) {
      events.responses.push({
        url: response.url,
        status: response.status,
        type: message.params.type,
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

await command("Runtime.enable");
await command("Log.enable");
await command("Network.enable");
await command("Page.enable");
await command("Page.navigate", { url });
const readyStartedAt = Date.now();
while (Date.now() - readyStartedAt < 20000) {
  const status = await command("Runtime.evaluate", {
    expression: "document.body?.dataset.appState ?? null",
    returnByValue: true,
  });
  if (status.result?.value === "READY") break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}

const evaluation = await command("Runtime.evaluate", {
  expression: `JSON.stringify({
    title: document.title,
    hasPhaser: Boolean(window.Phaser),
    appState: document.body?.dataset.appState ?? null,
    appGeneration: Number(document.body?.dataset.appGeneration ?? 0),
    shellHidden: document.getElementById("app-shell")?.hidden ?? true,
    playHidden: document.getElementById("app-play")?.hidden ?? true,
    canvasCount: document.querySelectorAll("#app canvas").length,
    canvasSize: (() => {
      const canvas = document.querySelector("#app canvas");
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    })(),
    diagnostics: document.getElementById("diag")?.textContent ?? "",
    diagnosticDisplay: document.getElementById("diag")?.style.display ?? "",
  })`,
  returnByValue: true,
});
const page = JSON.parse(evaluation.result.value);
if (screenshotPath) {
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
}
const unexpectedBadResponses = events.badResponses.filter(
  ({ url: responseUrl }) => !responseUrl.endsWith("/favicon.ico"),
);

const result = {
  page,
  events,
  screenshotPath: screenshotPath ?? null,
  passed:
    page.hasPhaser &&
    page.appState === "READY" &&
    page.appGeneration === 1 &&
    page.shellHidden === false &&
    page.playHidden === false &&
    page.canvasCount === 1 &&
    page.canvasSize?.width === 480 &&
    page.canvasSize?.height === 270 &&
    page.diagnostics.trim() === "" &&
    events.exceptions.length === 0 &&
    events.failedRequests.length === 0 &&
    unexpectedBadResponses.length === 0,
};
console.log(JSON.stringify(result, null, 2));
await command("Target.closeTarget", { targetId: target.id });
ws.close();
if (!result.passed) process.exitCode = 1;

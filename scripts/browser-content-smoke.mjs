const base = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const inputUrl =
  process.argv[2] ??
  process.env.SMOKE_URL ??
  "http://127.0.0.1:4175/";
const testUrl = new URL(inputUrl);
testUrl.searchParams.set("content-smoke", String(Date.now()));
testUrl.searchParams.set("lifecycle-test", "1");
const url = testUrl.toString();
const timeoutMs = Number(process.env.CONTENT_SMOKE_TIMEOUT_MS ?? 12000);

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
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
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
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result?.value;
}

await command("Runtime.enable");
await command("Network.enable");
await command("Page.enable");
await command("Page.navigate", { url });

let ready = false;
const startedAt = Date.now();
while (Date.now() - startedAt < timeoutMs) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  ready = await evaluate(
    "Boolean(window.__campusContentTest && window.__campusLifecycleTest && window.__campusDebug)",
  );
  if (ready) break;
}
if (!ready) throw new Error("content test hooks did not become ready");

const desktop = await evaluate(`(() => {
  const hook = window.__campusContentTest;
  const root = document.getElementById("content-ui-root");
  const backdrop = document.getElementById("content-backdrop");
  const modal = document.getElementById("content-modal");
  const close = document.getElementById("content-close");

  hook.setPlayerPosition(944, 768);
  const first = hook.tick();
  const firstResidence = first.active?.residenceId;
  const firstDom = {
    rootPointer: getComputedStyle(root).pointerEvents,
    backdropPointer: getComputedStyle(backdrop).pointerEvents,
    modalPointer: getComputedStyle(modal).pointerEvents,
    backdropZ: backdrop.style.zIndex,
    modalZ: modal.style.zIndex,
    outsideTarget: document.elementFromPoint(5, 5)?.id ?? "",
  };

  close.click();
  const closed = hook.snapshot();
  const sameResidence = hook.tick();

  hook.setPlayerPosition(900, 768);
  const left = hook.tick();
  hook.setPlayerPosition(944, 768);
  const reentered = hook.tick();

  hook.setPlayerPosition(1760, 1280);
  const memo = hook.tick();
  const memoDom = {
    backdropTarget: document.elementFromPoint(5, 5)?.id ?? "",
    backdropPointer: getComputedStyle(backdrop).pointerEvents,
    maxHeight: modal.style.maxHeight,
  };

  return {
    first,
    firstResidence,
    firstDom,
    closed,
    sameResidence,
    left,
    reentered,
    memo,
    memoDom,
  };
})()`);

await command("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 667,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 100));
const mobile = await evaluate(`(() => {
  const hook = window.__campusContentTest;
  const backdrop = document.getElementById("content-backdrop");
  const beforeClose = hook.snapshot();
  const maxHeight = document.getElementById("content-modal").style.maxHeight;
  backdrop.click();
  return { beforeClose, maxHeight, afterClose: hook.snapshot() };
})()`);

const lifecycle = await evaluate(`(async () => {
  const shutdown = window.__campusLifecycleTest.shutdown;
  await shutdown();
  return {
    rootHidden: document.getElementById("content-ui-root")?.hidden ?? false,
    backdropHidden: document.getElementById("content-backdrop")?.hidden ?? false,
    modalHidden: document.getElementById("content-modal")?.hidden ?? false,
    contentHookPresent: Boolean(window.__campusContentTest),
    lifecycleHookPresent: Boolean(window.__campusLifecycleTest),
    debugHookPresent: Boolean(window.__campusDebug),
  };
})()`, true);

const first = desktop.first;
const closed = desktop.closed;
const reentered = desktop.reentered;
const memo = desktop.memo;
const mobileHeight = Number.parseFloat(mobile.maxHeight);
const passed =
  first?.active?.menuId === "about" &&
  first?.ui?.title === "About Me" &&
  first?.ui?.backdropHidden === true &&
  first?.visited?.includes("about") &&
  first?.leases === 1 &&
  first?.playerControlEnabled === false &&
  desktop.firstDom.rootPointer === "none" &&
  desktop.firstDom.backdropPointer === "none" &&
  desktop.firstDom.modalPointer === "auto" &&
  desktop.firstDom.backdropZ === "9998" &&
  desktop.firstDom.modalZ === "9999" &&
  desktop.firstDom.outsideTarget !== "content-ui-root" &&
  closed?.active === null &&
  closed?.ui?.rootHidden === true &&
  closed?.suppressed?.includes(desktop.firstResidence) &&
  closed?.leases === 0 &&
  closed?.playerControlEnabled === true &&
  desktop.sameResidence?.active === null &&
  desktop.left?.suppressed?.length === 0 &&
  reentered?.active?.menuId === "about" &&
  reentered?.active?.residenceId !== desktop.firstResidence &&
  memo?.active?.menuId === "memo1" &&
  memo?.ui?.title === "Memo #1" &&
  memo?.ui?.backdropHidden === false &&
  memo?.leases === 1 &&
  desktop.memoDom.backdropTarget === "content-backdrop" &&
  desktop.memoDom.backdropPointer === "auto" &&
  mobile.beforeClose?.active?.menuId === "memo1" &&
  Math.abs(mobileHeight - 466.9) < 1 &&
  mobile.afterClose?.active === null &&
  mobile.afterClose?.suppressed?.length === 1 &&
  mobile.afterClose?.leases === 0 &&
  mobile.afterClose?.playerControlEnabled === true &&
  lifecycle.rootHidden === true &&
  lifecycle.backdropHidden === true &&
  lifecycle.modalHidden === true &&
  lifecycle.contentHookPresent === false &&
  lifecycle.lifecycleHookPresent === false &&
  lifecycle.debugHookPresent === false &&
  events.console.length === 0 &&
  events.exceptions.length === 0 &&
  events.failedRequests.length === 0 &&
  events.badResponses.length === 0;

const result = { url, desktop, mobile, lifecycle, events, passed };
console.log(JSON.stringify(result, null, 2));
await command("Target.closeTarget", { targetId: target.id });
ws.close();
if (!passed) process.exitCode = 1;

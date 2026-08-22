import assert from "node:assert/strict";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4175";
const smokeUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? `${baseUrl}/`;
const waitMs = Number(process.env.SMOKE_WAIT_MS ?? "5000");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${url}: ${response.status}`);
  }
  return response.json();
}

const target = await fetchJson(
  `${cdpUrl}/json/new?${encodeURIComponent(smokeUrl)}`,
  { method: "PUT" },
);
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
const exceptions = [];
const failedRequests = [];
const badResponses = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined) {
    const request = pending.get(message.id);
    if (request !== undefined) {
      pending.delete(message.id);
      if (message.error !== undefined) {
        request.reject(new Error(JSON.stringify(message.error)));
      } else {
        request.resolve(message.result);
      }
    }
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        "runtime exception",
    );
  }
  if (message.method === "Network.loadingFailed") {
    failedRequests.push({
      url: message.params.url,
      errorText: message.params.errorText,
    });
  }
  if (message.method === "Network.responseReceived") {
    const response = message.params.response;
    if (response.status >= 400) {
      badResponses.push({ url: response.url, status: response.status });
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
        "Runtime.evaluate failed",
    );
  }
  return result.result?.value;
}

try {
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Page.navigate", { url: smokeUrl });
  await sleep(waitMs);

  const page = await evaluate(`JSON.stringify({
    title: document.title,
    diagnostics: document.getElementById("diag")?.textContent ?? "",
    diagnosticDisplay: document.getElementById("diag")?.style.display ?? "",
    diagnosticHidden: document.getElementById("diag")?.hidden ?? null,
    debugHook: typeof window.__campusDebug,
    collisionHook: typeof window.__campusCollisionTest,
    entryHook: typeof window.__campusEntryTest,
  })`);
  const result = JSON.parse(page);
  assert.equal(result.title, "虚拟校园 · 可玩雏形");
  assert.equal(result.diagnostics, "");
  assert.equal(result.diagnosticDisplay, "");
  assert.equal(result.diagnosticHidden, true);
  assert.equal(result.debugHook, "undefined");
  assert.equal(result.collisionHook, "undefined");
  assert.equal(result.entryHook, "undefined");
  assert.deepEqual(exceptions, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(badResponses, []);

  console.log(
    JSON.stringify(
      {
        ok: true,
        smokeUrl,
        page: result,
        exceptions,
        failedRequests,
        badResponses,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    `browser runtime safety smoke failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  socket.close();
  try {
    await fetch(`${cdpUrl}/json/close/${target.id}`);
  } catch {
    // The target may already be closed.
  }
}

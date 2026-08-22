import assert from "node:assert/strict";

import {
  clickAppButton,
  clickPlay,
  waitForAppStatus,
} from "./browser-app-actions.mjs";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:4175/";
const contentUrl = new URL(inputUrl);
contentUrl.searchParams.set("content-smoke", String(Date.now()));
const url = contentUrl.toString();
const timeoutMs = Number(process.env.CONTENT_SMOKE_TIMEOUT_MS ?? 35000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${endpoint}: ${response.status}`);
  }
  return response.json();
}

const target = await fetchJson(
  `${cdpUrl}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };

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
        result.exceptionDetails.text ??
        "Runtime.evaluate failed",
    );
  }
  return result.result?.value;
}

async function waitForDebug(predicate, label, timeout = timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const debug = await evaluate("window.__campusDebug?.() ?? null");
    if (debug !== null && predicate(debug)) return debug;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function moveUntil({ key, code, keyCode, reached, label }) {
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: keyCode,
  });
  const startedAt = Date.now();
  let debug;
  try {
    while (Date.now() - startedAt < 10000) {
      debug = await evaluate("window.__campusDebug?.() ?? null");
      if (debug !== null && reached(debug.player, debug)) return debug;
      await sleep(33);
    }
    throw new Error(
      `timed out during real movement: ${label}; ` +
        JSON.stringify({ player: debug?.player, body: debug?.body }),
    );
  } finally {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: keyCode,
    });
  }
}

try {
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Page.navigate", { url });
  const clickedPoint = await clickPlay(command, evaluate, timeoutMs);
  await waitForAppStatus(evaluate, "PLAYING", timeoutMs);

  const playable = await waitForDebug(
    (debug) => debug.entry?.snapshot?.status === "playable",
    "playable entry",
  );
  assert.equal(playable.player.x, 1088);
  assert.equal(playable.player.y, 304);
  assert.equal(playable.content.active, null);
  assert.match(
    (await evaluate("window.__campusEntryTest.snapshot().guideText")),
    /MEMO6/,
  );

  const trainComplete = await waitForDebug(
    (debug) =>
      debug.side?.train?.state === "complete" &&
      debug.side?.trainHasSprite === false &&
      debug.side?.trainColliderActive === false,
    "real train departure cleanup",
  );

  const afterWest = await moveUntil({
    key: "ArrowLeft",
    code: "ArrowLeft",
    keyCode: 37,
    label: "west 36 tiles",
    reached: (player) => player.x <= 512,
  });
  const afterNorth = await moveUntil({
    key: "ArrowUp",
    code: "ArrowUp",
    keyCode: 38,
    label: "north 7 tiles",
    reached: (player, debug) =>
      player.y <= 192 || debug.content?.active?.menuId === "memo6",
  });

  await waitForAppStatus(evaluate, "MODAL_OPEN", 5000);
  const memo = await waitForDebug(
    (debug) => debug.content?.active?.menuId === "memo6",
    "Memo 6 residence",
    5000,
  );
  const dom = await evaluate(`(() => {
    const body = document.getElementById("content-body");
    const image = body?.querySelector("img");
    const fallback = body?.querySelector("figure span");
    return {
      title: document.getElementById("content-title")?.textContent ?? "",
      body: body?.textContent ?? "",
      sectionCount: body?.querySelectorAll("section").length ?? 0,
      heading: body?.querySelector("h3")?.textContent ?? "",
      imageSrc: image?.getAttribute("src") ?? "",
      imageVisible: image ? getComputedStyle(image).visibility !== "hidden" : false,
      fallbackVisible: fallback ? !fallback.hidden : false,
      focusedId: document.activeElement?.id ?? "",
    };
  })()`);

  assert.equal(memo.content.active.menuId, "memo6");
  assert.ok(memo.content.visited.includes("memo6"));
  assert.equal(memo.content.leases, 1);
  assert.equal(memo.content.playerControlEnabled, false);
  assert.equal(dom.title, "I'm not a game developer");
  assert.match(dom.body, /clean architecture and logical solutions/);
  assert.equal(dom.sectionCount, 1);
  assert.equal(dom.heading, "I'm not a game developer");
  assert.equal(dom.imageSrc, "/assets/images/cards/card6_base.webp");
  assert.equal(dom.imageVisible || dom.fallbackVisible, true);
  assert.equal(dom.focusedId, "content-close");

  await clickAppButton(
    command,
    evaluate,
    "#content-close",
    "MODAL_OPEN",
    5000,
  );
  await waitForAppStatus(evaluate, "PLAYING", 5000);
  const closed = await waitForDebug(
    (debug) =>
      debug.content?.active === null &&
      debug.content?.leases === 0 &&
      debug.content?.playerControlEnabled === true,
    "Memo 6 close cleanup",
    5000,
  );

  assert.ok(afterWest.player.x <= 512);
  assert.ok(
    Math.hypot(afterNorth.player.x - 496, afterNorth.player.y - 176) < 30,
  );
  assert.deepEqual(events.console, []);
  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  console.log(JSON.stringify({
    ok: true,
    url,
    clickedPoint,
    playable,
    trainComplete,
    afterWest: afterWest.player,
    afterNorth: afterNorth.player,
    memo,
    dom,
    closed,
    events,
  }, null, 2));
} finally {
  socket.close();
  await fetch(`${cdpUrl}/json/close/${target.id}`).catch(() => {});
}

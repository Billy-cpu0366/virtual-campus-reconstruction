import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const inputUrl = process.argv[2] ?? "http://localhost:4175/";
const targetUrl = new URL(inputUrl);
targetUrl.searchParams.set("collision-test", "1");
targetUrl.searchParams.set("beach", String(Date.now()));
const url = targetUrl.toString();
const receiptPath = process.env.BEACH_RECEIPT;
const screenshotDir = process.env.BEACH_SCREENSHOT_DIR;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 沙滩触发块（GID 69353）铺在 tile x 60–115 / y 117–139，
// 也就是世界坐标 x 960–1856 / y 1872–2240。
// 岸上那个点特地挑在 tile (80,115)：walls 层是空的（GID 0），
// 不是 69353 也不是 69345——撞墙块会挡掉「穿回常服」的判定（原站就这么写的）。
const ON_BEACH = { x: 1288, y: 1896 };
const OFF_BEACH = { x: 1288, y: 1848 };

const targetResponse = await fetch(
  `${cdpBase}/json/new?${encodeURIComponent(url)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) throw new Error(`create target: ${targetResponse.status}`);
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };
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
    events.console.push(message.params.args?.map((arg) => arg.value ?? arg.description));
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
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text,
    );
  }
  return response.result?.value;
}

async function debug() {
  return evaluate("window.__campusDebug?.() ?? null");
}

async function waitFor(predicate, label, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await debug();
    if (snapshot && predicate(snapshot)) return snapshot;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function capture(name) {
  if (!screenshotDir) return null;
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  const path = join(screenshotDir, `${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  return path;
}

const clothes = (snapshot) => snapshot?.playerRuntime?.clothesChange ?? {};
const onBeach = (snapshot) => snapshot?.playerRuntime?.onBeach ?? null;
const changing = (snapshot) => snapshot?.playerRuntime?.clothingChange ?? null;

async function teleport(point) {
  await evaluate(
    `window.__campusCollisionTest.setPlayerPosition(${point.x}, ${point.y})`,
  );
}

let result;
try {
  await Promise.all([
    command("Runtime.enable"),
    command("Network.enable"),
    command("Page.enable"),
  ]);
  await command("Page.navigate", { url });
  await waitFor(
    (snapshot) => snapshot.entry?.sceneReady === true,
    "scene ready",
    30000,
  );
  await evaluate("document.querySelector('#app-play')?.click()");
  await waitFor(
    (snapshot) => snapshot.entry?.snapshot?.status === "playable",
    "playable entry",
  );

  // ① 站在岸上
  await teleport(OFF_BEACH);
  const outside = await waitFor(
    (snapshot) => typeof clothes(snapshot).tileIndex === "number",
    "tile lookup works",
    15000,
  );
  assert.notEqual(
    clothes(outside).tileIndex,
    69353,
    `off-beach probe tile was ${clothes(outside).tileIndex}`,
  );
  assert.equal(onBeach(outside), false, "不该一开始就穿着泳装");
  const outsideShot = await capture("beach-outside");

  // ② 踩上沙滩触发块 → 脱衣
  await teleport(ON_BEACH);
  const undressing = await waitFor(
    (snapshot) => changing(snapshot) === "undressing",
    "undressing starts",
    15000,
  );
  assert.equal(undressing.playerRuntime.control.visualLocked, true);
  const undressingShot = await capture("beach-undressing");

  const dressed = await waitFor(
    (snapshot) => snapshot.playerRuntime.onBeach === true,
    "undressing finishes",
    15000,
  );
  assert.equal(changing(dressed), null);
  assert.equal(clothes(dressed).tileIndex, 69353);
  assert.equal(dressed.player.texture, "player-beach");
  const beachShot = await capture("beach-swimsuit");

  // 泳装走路：帧布局与常服一致，贴图换成 player-beach。
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  const beachWalking = await waitFor(
    (snapshot) =>
      snapshot.player.texture === "player-beach" &&
      snapshot.player.animation === "beach-walk-west",
    "swimsuit walk animation",
    5000,
  ).finally(async () => {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowLeft",
      code: "ArrowLeft",
      windowsVirtualKeyCode: 37,
    });
  });
  assert.equal(beachWalking.playerRuntime.onBeach, true);
  const beachWalkShot = await capture("beach-walking");
  // 刚才走了一段，位置已不确定；挪回已知的沙滩格再继续。
  await teleport(ON_BEACH);

  // ③ 冷却内立刻回岸上：不该换装（原站就是 1 秒冷却挡住）
  await teleport(OFF_BEACH);
  await sleep(300);
  const duringUndressCooldown = await debug();
  assert.equal(
    changing(duringUndressCooldown),
    null,
    "脱完 1 秒内回岸上不该开始穿衣",
  );
  assert.equal(onBeach(duringUndressCooldown), true, "身上还是泳装");

  // ④ 等冷却过去，再走回陆地 → 穿衣
  await sleep(900);
  await teleport(ON_BEACH);
  // 等的是「上一次巡检记下的格子」，不是当场查到的格子——
  // 换装的边沿判定用的是巡检值，每 3 帧才更新一次。
  await waitFor(
    (snapshot) => clothes(snapshot).lastTileIndex === 69353,
    "beach tile recorded by the 3-frame poll",
    15000,
  );
  await teleport(OFF_BEACH);
  const dressing = await waitFor(
    (snapshot) => changing(snapshot) === "dressing",
    "dressing starts",
    15000,
  );
  assert.equal(dressing.playerRuntime.control.visualLocked, true);

  const redressed = await waitFor(
    (snapshot) => snapshot.playerRuntime.onBeach === false,
    "dressing finishes",
    15000,
  );
  assert.equal(changing(redressed), null);
  assert.equal(redressed.player.texture, "player");
  const redressedShot = await capture("beach-redressed");

  // ⑤ 穿衣冷却内再踩沙滩不重复触发
  await teleport(ON_BEACH);
  await sleep(200);
  const duringCooldown = await debug();
  assert.equal(
    changing(duringCooldown),
    null,
    "穿衣 1 秒内不该再开始脱衣",
  );

  assert.deepEqual(events.exceptions, []);
  assert.deepEqual(events.failedRequests, []);
  assert.deepEqual(events.badResponses, []);

  result = {
    passed: true,
    url,
    offBeachProbe: { tileIndex: clothes(outside).tileIndex, onBeach: onBeach(outside) },
    undressing: {
      visualLocked: undressing.playerRuntime.control.visualLocked,
      status: undressing.playerRuntime.control.status,
    },
    dressed: {
      onBeach: dressed.playerRuntime.onBeach,
      tileIndex: clothes(dressed).tileIndex,
      texture: dressed.player.texture,
      frame: dressed.player.frame,
    },
    duringUndressCooldown: {
      clothingChange: changing(duringUndressCooldown),
      onBeach: onBeach(duringUndressCooldown),
    },
    dressing: {
      visualLocked: dressing.playerRuntime.control.visualLocked,
      status: dressing.playerRuntime.control.status,
    },
    redressed: {
      onBeach: redressed.playerRuntime.onBeach,
      tileIndex: clothes(redressed).tileIndex,
      texture: redressed.player.texture,
      frame: redressed.player.frame,
    },
    duringCooldown: {
      clothingChange: changing(duringCooldown),
      onBeach: onBeach(duringCooldown),
    },
    beachWalking: {
      texture: beachWalking.player.texture,
      animation: beachWalking.player.animation,
      onBeach: beachWalking.playerRuntime.onBeach,
    },
    screenshots: {
      outside: outsideShot,
      undressing: undressingShot,
      beach: beachShot,
      beachWalking: beachWalkShot,
      redressed: redressedShot,
    },
    console: events.console,
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

// 配置实测冒烟：改一个配置值 → 刷新页面（**不重新构建**）→ 在真浏览器里量出来 + 截图 → 改回去。
//
// 验的是「配置到底接上了没有」：改的数真的走进了画面，而不是只躺在 JSON 里没人读。
// 顺带证明配置是「改完刷新就生效」，不用重新构建。
//
// 前置（另开两个终端）：
//   1) npm run dev                    开发服务器，默认 4175
//   2) 带 --remote-debugging-port=9223 的无头 Chrome
// 跑：
//   npm run browser:config-live-smoke
//   只跑几条：CONFIG_LIVE_ONLY="06-bug-count,10-static-crowd-density" npm run browser:config-live-smoke
//   换输出位置：CONFIG_LIVE_OUT="bak/配置实测-2026-09-21" npm run browser:config-live-smoke
//
// 保险：每条开跑前把配置原文备份到 <out>/原值-*.json，跑完（含出错、超时）逐字节还原并校验。
// 进程被强杀也不会丢原文——备份就在 <out> 里，照着抄回去即可。
//
// 错误页（appState=ERROR）会自动点一次重试：那是**探针自己的问题**——连着快速换页会让上一页
// 没下完的分块请求被中止（AbortError: chunk request aborted），不是配置把它搞坏的。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { clickPlay, clickRetry, waitForAppStatus } from "./browser-app-actions.mjs";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
// 默认用 localhost 而不是 127.0.0.1：这台机器上 `vite` 只监听 [::1]（IPv6），
// 写 127.0.0.1 会连不上。localhost 两个都试。
const inputUrl =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://localhost:4175/";
const dataDir = "config/default/05-旁支/SYS-NPC/数据";
const outDir = process.env.CONFIG_LIVE_OUT ?? "/tmp/config-live-smoke";
const shotDir = join(outDir, "screens");
const totalTimeoutMs = Number(process.env.CONFIG_LIVE_TIMEOUT_MS ?? 1_800_000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

/** 一条用例 = 改一份配置里的一个（或一组）值 + 从哪个镜头看。 */
const TESTS = [
  {
    id: "01-dancing-count",
    file: "dancing-crowd-config.json",
    camera: [1960, 1620],
    what: "跳舞人数 npcCount 8 -> 48",
    apply: (json) => {
      json.data.npcCount = 48;
    },
  },
  {
    id: "02-dancing-scale",
    file: "dancing-crowd-config.json",
    camera: [1960, 1620],
    what: "跳舞的人个头 scale 0.9 -> 2.5",
    apply: (json) => {
      json.data.scale = 2.5;
    },
  },
  {
    id: "03-protest-slogan",
    file: "venue-crowd-presentation.json",
    camera: [1790, 1200],
    what: "抗议者喊的口号 slogans 换成一条测试文本",
    apply: (json) => {
      json.data.slogans = ["CONFIG-TEST-8842 换皮测试"];
    },
  },
  {
    id: "04-protest-count",
    file: "venue-crowd-regions.json",
    camera: [1790, 1200],
    what: "抗议区人数 count 30 -> 150（只改 count 不动：位置被 spacing 卡死，连 spacing 20 -> 6 一起改）",
    apply: (json) => {
      const region = json.data.find((entry) => entry.id === "protesters_rising-87");
      region.count = 150;
      region.spacing = 6;
    },
  },
  {
    id: "05-protest-bubble-fontsize",
    file: "venue-crowd-presentation.json",
    camera: [1790, 1200],
    what: "抗议气泡字号 speechBubble.fontSizePx 8 -> 24",
    apply: (json) => {
      json.data.speechBubble.fontSizePx = 24;
    },
  },
  {
    id: "06-bug-count",
    file: "bug-crowd-config.json",
    camera: [224, 2088],
    what: "虫子数量 npcCount 10 -> 60",
    apply: (json) => {
      json.data.npcCount = 60;
    },
  },
  {
    id: "07-bug-display-scale",
    file: "bug-crowd-presentation.json",
    camera: [224, 2088],
    what: "虫子个头 displayScale -> 3 倍",
    apply: (json) => {
      json.data.displayScale = json.data.displayScale * 3;
    },
  },
  {
    id: "08-sprayer-scale",
    file: "sprayer-configs.json",
    camera: [1016, 400],
    what: "喷水器个头 scale 0.9 -> 2.5",
    apply: (json) => {
      for (const sprayer of json.data) sprayer.scale = 2.5;
    },
  },
  {
    id: "09-static-npc-move",
    file: "static-npc-configs.json",
    camera: [1000, 950],
    what: "把「舔毛的猫」从格子 (12,106) 挪到 (62,58)",
    apply: (json) => {
      const cat = json.data.find((entry) => entry.id === "cat-licking");
      cat.tileX = 62;
      cat.tileY = 58;
    },
  },
  {
    id: "10-static-crowd-density",
    file: "static-crowd-tuning.json",
    camera: [1790, 1200],
    what: "普通人群调密 minSpacing 20 -> 6 且 factor 0.004 -> 0.016",
    apply: (json) => {
      json.data.minSpacing = 6;
      json.data.factor = 0.016;
    },
  },
];

// ------------------------------------------------------------------ 原值备份
const originals = new Map();
for (const name of new Set(TESTS.map((test) => test.file))) {
  const text = readFileSync(join(dataDir, name), "utf8");
  originals.set(name, {
    path: join(dataDir, name),
    text,
    // 配置是由 vite 开发中间件直接当静态文件端出来的，所以请求地址就是磁盘路径的 URL 编码
    url: new URL(`config/default/05-旁支/SYS-NPC/数据/${name}`, inputUrl).toString(),
  });
}
// 先把上一次跑留下的「原值」读下来，再覆盖写——preflight 要靠它判断「这份配置在两次跑之间被动过没有」。
const previousOriginals = new Map();
for (const name of originals.keys()) {
  const previousPath = join(outDir, `原值-${name}`);
  previousOriginals.set(name, existsSync(previousPath) ? readFileSync(previousPath, "utf8") : undefined);
}

mkdirSync(shotDir, { recursive: true });
for (const [name, original] of originals) {
  writeFileSync(join(outDir, `原值-${name}`), original.text, "utf8");
}

function restoreAll() {
  for (const original of originals.values()) {
    writeFileSync(original.path, original.text, "utf8");
  }
}
process.on("exit", restoreAll);

// ------------------------------------------------------------------ CDP 连接
let socket;
let nextId = 0;
const pending = new Map();
const noise = [];

function command(method, params = {}, timeoutMs = 30_000) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
    }, timeoutMs);
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

async function waitFor(expression, predicate, label, timeoutMs = 45_000) {
  const startedAt = Date.now();
  let last;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      last = await evaluate(expression);
      if (predicate(last)) return last;
    } catch {
      // 导航中途取不到上下文，忽略
    }
    await sleep(120);
  }
  throw new Error(`timed out waiting for ${label} (last=${JSON.stringify(last)})`);
}

/** 一个镜头要量哪些数：人群总数 / 画面内数量 / 缩放、静态 NPC 坐标、喷水器、气泡。 */
const MEASURE = `(() => {
  if (typeof __games === "undefined") return null;
  for (const game of __games) {
    const scene = game?.scene?.getScene?.("campus");
    const camera = scene?.cameras?.main;
    if (!scene || !camera) continue;
    const view = camera.worldView;
    const entries = (map) => [...(map ?? new Map())];
    const inView = (map, half) => entries(map).filter(([, sprite]) =>
      sprite.x + half >= view.x && sprite.x - half <= view.x + view.width &&
      sprite.y + half >= view.y && sprite.y - half <= view.y + view.height).length;
    const dancing = entries(scene.dancingCrowdRuntime?.sprites);
    const bugs = entries(scene.bugCrowdRuntime?.sprites);
    return {
      view: {
        x: Math.round(view.x), y: Math.round(view.y),
        w: Math.round(view.width), h: Math.round(view.height),
      },
      dancingTotal: dancing.length,
      dancingInView: inView(scene.dancingCrowdRuntime?.sprites, 24),
      dancingScale: dancing[0] ? Number(dancing[0][1].scaleX.toFixed(3)) : null,
      bugTotal: bugs.length,
      bugInView: inView(scene.bugCrowdRuntime?.sprites, 20),
      bugScale: bugs[0] ? Number(bugs[0][1].scaleX.toFixed(3)) : null,
      venueTotal: entries(scene.venueCrowdRuntime?.sprites).length,
      venueInView: inView(scene.venueCrowdRuntime?.sprites, 32),
      staticCrowdTotal: entries(scene.staticCrowdRuntime?.sprites).length,
      staticCrowdInView: inView(scene.staticCrowdRuntime?.sprites, 24),
      staticNpcAll: entries(scene.staticNpcRuntime?.sprites).map(([id, sprite]) => ({
        id: String(id), x: Math.round(sprite.x), y: Math.round(sprite.y),
        scale: Number(sprite.scaleX.toFixed(2)),
      })),
      sprayers: entries(scene.sprayerRuntime?.sprites).map(([id, sprite]) => ({
        id: String(id), x: Math.round(sprite.x), y: Math.round(sprite.y),
        scale: Number(sprite.scaleX.toFixed(2)),
      })),
      bubbles: entries(scene.venueCrowdRuntime?.speechBubbles).map(([id, bubble]) => ({
        id: String(id), text: bubble.text ?? null, fontSize: bubble.style?.fontSize ?? null,
      })),
      fps: Math.round(game.loop?.actualFps ?? 0),
    };
  }
  return null;
})()`;

/**
 * 把当前页面的 Phaser.Game 实例抓成全局 `__games`（和 browser-npc-visual-production.mjs 同一套办法）。
 *
 * 必须等新文档真的接手了再抓：`Page.navigate` 只是「发车」，老文档可能还活着那一瞬，
 * 那时候 `Phaser.Game.prototype` 拿到的是**老上下文**的原型，queryObjects 抓到的是老游戏对象，
 * 新上下文里 `__games` 永远是 undefined。
 */
async function grabGames(tag) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const proto = await command("Runtime.evaluate", {
        expression: "Phaser.Game.prototype",
      });
      const objects = await command("Runtime.queryObjects", {
        prototypeObjectId: proto.result.objectId,
      });
      await command("Runtime.callFunctionOn", {
        objectId: objects.objects.objectId,
        functionDeclaration: "function () { globalThis.__games = this; }",
      });
      const count = await evaluate(
        "(typeof __games === 'undefined') ? -1 : __games.length",
      );
      if (typeof count === "number" && count > 0) return count;
    } catch {
      // 导航中途的上下文不可用，重试
    }
    await sleep(250);
  }
  throw new Error(`no Phaser.Game instance on page (tag=${tag})`);
}

/** 等到 App 进入某个状态；进 ERROR 就点一次重试（见文件头说明）。 */
async function awaitAppState(target, timeoutMs) {
  const startedAt = Date.now();
  let retries = 0;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await waitForAppStatus(evaluate, target, 400);
    } catch {
      // 还没到，接着等
    }
    const status = await evaluate("document.body?.dataset?.appState ?? null").catch(() => null);
    if (status === "ERROR" && retries < 3) {
      retries += 1;
      await clickRetry(command, evaluate, 5000).catch(() => {});
      await sleep(800);
    }
  }
  throw new Error(`timed out waiting for App status ${target}`);
}

/** 开一次游戏：导航 → 等到能玩 → 把镜头对准 → 量一遍 + 截图。 */
async function loadAndPlay(tag, camera) {
  noise.length = 0;
  const url = new URL(inputUrl);
  url.searchParams.set("config-live-smoke", tag);
  await command("Page.navigate", { url: url.toString() });
  await waitFor(
    "location.search",
    (search) => typeof search === "string" && search.includes(tag),
    `新文档接手（${tag}）`,
    25_000,
  );
  await waitFor("typeof Phaser !== 'undefined'", (ready) => ready === true, "Phaser 加载", 30_000);
  await grabGames(tag);
  await awaitAppState("READY", 60_000);
  await clickPlay(command, evaluate, 60_000);
  await awaitAppState("PLAYING", 60_000);
  await waitFor(
    `(() => { for (const game of __games) {
      if (game?.scene?.getScene?.("campus")?.cameras?.main) return true;
    } return false; })()`,
    (ready) => ready === true,
    "校园场景就绪",
    40_000,
  );
  await sleep(1500);
  const centered = await evaluate(
    `(() => { for (const game of __games) {
      const scene = game?.scene?.getScene?.("campus");
      if (scene?.cameras?.main) {
        scene.cameras.main.stopFollow?.();
        scene.cameras.main.centerOn(${camera[0]}, ${camera[1]});
        return true;
      }
    } return false; })()`,
  );
  if (centered !== true) throw new Error("could not center camera");
  // 镜头里的人是逐帧补出来的（maxCreatePerSync），等它补齐再量
  await sleep(3200);
  const measured = await evaluate(MEASURE);
  const shot = await command("Page.captureScreenshot", { format: "png" });
  return { measured, png: shot.data, noise: [...noise] };
}

/** 只留改前改后不一样的那几项，并排成 [改前, 改后]。 */
function diff(before, after) {
  const scalarKeys = [
    "dancingTotal", "dancingInView", "dancingScale",
    "bugTotal", "bugInView", "bugScale",
    "venueTotal", "venueInView",
    "staticCrowdTotal", "staticCrowdInView",
  ];
  const out = {};
  for (const key of scalarKeys) {
    if (before[key] !== after[key]) out[key] = [before[key], after[key]];
  }
  for (const key of ["sprayers", "staticNpcAll"]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      out[key] = [before[key], after[key]];
    }
  }
  const bubbleKey = (measure) =>
    JSON.stringify(measure.bubbles.map((bubble) => `${bubble.text}|${bubble.fontSize}`).sort());
  if (bubbleKey(before) !== bubbleKey(after)) {
    out.bubbles = [before.bubbles, after.bubbles];
  }
  return out;
}

// ------------------------------------------------------------------ 开跑
const report = {
  url: inputUrl,
  startedAt: new Date().toISOString(),
  outDir,
  originals: {},
  tests: [],
};
for (const [name, original] of originals) {
  report.originals[name] = { sha256_16: sha(original.text), restored: null, servedMatchesDisk: null };
}

function finalize(finishedBy) {
  restoreAll();
  report.finishedBy = finishedBy;
  for (const [name, original] of originals) {
    report.originals[name].restored =
      readFileSync(original.path, "utf8") === original.text ? "byte-identical" : "MISMATCH";
  }
  report.noise = noise;
  writeFileSync(join(outDir, "RESULT.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`report -> ${join(outDir, "RESULT.json")}`);
  console.log(`restore: ${JSON.stringify(
    Object.fromEntries(Object.entries(report.originals).map(([name, v]) => [name, v.restored])),
  )}`);
}

const watchdog = setTimeout(() => {
  console.error("WATCHDOG: hard timeout");
  console.error(`配置原文在 ${outDir}/原值-*.json，照着抄回 ${dataDir}/ 即可。`);
  finalize("watchdog");
  process.exit(3);
}, totalTimeoutMs);
watchdog.unref?.();

const only = (process.env.CONFIG_LIVE_ONLY ?? "").split(",").filter(Boolean);
const active = only.length === 0 ? TESTS : TESTS.filter((test) => only.includes(test.id));
console.log(`running ${active.length}/${TESTS.length} tests -> ${outDir}`);

try {
  const target = await (
    await fetch(`${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })
  ).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("websocket open timeout")), 15_000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener("error", (error) => {
      clearTimeout(timer);
      reject(error);
    }, { once: true });
  });
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
    if (message.method === "Runtime.consoleAPICalled" &&
        (message.params.type === "error" || message.params.type === "warning")) {
      noise.push(`console.${message.params.type}: ${
        (message.params.args ?? []).map((arg) => arg.value ?? arg.description).join(" ")}`);
    }
    if (message.method === "Runtime.exceptionThrown") {
      noise.push(`EXCEPTION: ${
        message.params.exceptionDetails?.exception?.description ?? "?"}`);
    }
    if (message.method === "Network.responseReceived" &&
        message.params.response.status >= 400 &&
        !message.params.response.url.endsWith("/favicon.ico")) {
      noise.push(`HTTP ${message.params.response.status} ${message.params.response.url}`);
    }
    if (message.method === "Network.loadingFailed") {
      noise.push(`LOADFAIL ${message.params.errorText} ${message.params.url}`);
    }
  });
  await Promise.all([
    command("Runtime.enable"),
    command("Page.enable"),
    command("Network.enable"),
  ]);
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  // 前置检查一：这份配置跟上一跑记录的「原值」是不是还一样。
  //
  // 不一样，说明它在两次跑之间被动过——可能是有意改的，也可能是上一次跑被强杀留下的脏值。
  // **不能让工具悄悄把脏值当成新的原值**：那样子跑完「逐字节还原」还原的是脏值，
  // 报告还是绿的，等于把错的东西盖了章（2026-09-23 真踩过一次）。
  const drifted = [];
  for (const [name, original] of originals) {
    const previous = previousOriginals.get(name);
    if (previous !== undefined && previous !== original.text) drifted.push(name);
  }
  if (drifted.length > 0 && process.env.CONFIG_LIVE_ADOPT !== "1") {
    throw new Error(
      `${drifted.join(", ")} 和上一跑记录的原值对不上，先确认现在磁盘上这份是对的：\n`
      + `  确认无误 -> 删掉 ${outDir}/原值-*.json 或设 CONFIG_LIVE_ADOPT=1 重新采原值\n`
      + `  是被改坏了 -> 从 ${outDir}/原值-*.json 抄回去再跑`,
    );
  }

  // 前置检查二：开发服务器端出来的配置，和磁盘上那份是不是同一份（确认读的真是磁盘）
  for (const [name, original] of originals) {
    report.originals[name].servedMatchesDisk =
      (await (await fetch(original.url)).text()) === original.text;
  }
  const notServed = Object.entries(report.originals)
    .filter(([, v]) => v.servedMatchesDisk !== true)
    .map(([name]) => name);
  assert.deepEqual(
    notServed, [],
    `开发服务器端的配置和磁盘不一致，先确认 dev server 起对了：${notServed.join(", ")}`,
  );
  console.log("preflight: served config matches disk");

  // 一个镜头一份改前基线（多条目共用同一个镜头时只拍一次）
  const cameras = [];
  for (const test of active) {
    const key = test.camera.join(",");
    if (!cameras.some(([existing]) => existing === key)) {
      cameras.push([key, `b${cameras.length + 1}`]);
    }
  }
  const baselines = new Map();
  for (const [key, tag] of cameras) {
    const camera = key.split(",").map(Number);
    console.log(`[baseline ${tag}] camera ${key}`);
    const run = await loadAndPlay(`base-${tag}`, camera);
    writeFileSync(
      join(shotDir, `00-baseline-${tag}-${key.replace(",", "_")}.png`),
      run.png,
      "base64",
    );
    baselines.set(key, run.measured);
    const m = run.measured;
    console.log(`  dancing=${m.dancingTotal} bugs=${m.bugTotal} venueInView=${m.venueInView}`
      + ` staticCrowd=${m.staticCrowdTotal} staticNpc=${m.staticNpcAll.length}`
      + ` sprayers=${m.sprayers.length} bubbles=${m.bubbles.length} fps=${m.fps}`);
  }

  const failures = [];
  let index = 0;
  for (const test of active) {
    index += 1;
    const original = originals.get(test.file);
    const json = JSON.parse(original.text);
    test.apply(json);
    const mutated = `${JSON.stringify(json, null, 2)}\n`;
    writeFileSync(original.path, mutated, "utf8");
    const servedNow = (await (await fetch(original.url)).text()) === mutated;
    console.log(`[${test.id}] ${test.file} :: ${test.what} | served===newfile: ${servedNow}`);

    let changed = {};
    try {
      const run = await loadAndPlay(`${test.id}-${index}`, test.camera);
      writeFileSync(join(shotDir, `${test.id}-after.png`), run.png, "base64");
      changed = diff(baselines.get(test.camera.join(",")), run.measured);
      report.tests.push({
        id: test.id, file: test.file, what: test.what, camera: test.camera,
        servedNewValue: servedNow, before: baselines.get(test.camera.join(",")),
        after: run.measured, changed, noise: run.noise,
      });
    } finally {
      // 每条跑完立刻还原并校验，别攒到最后
      writeFileSync(original.path, original.text, "utf8");
      assert.equal(readFileSync(original.path, "utf8"), original.text, `restore failed ${test.file}`);
    }

    const empty = Object.keys(changed).length === 0;
    if (empty || servedNow !== true) failures.push(test.id);
    console.log(`  ${empty ? "NO CHANGE" : "changed"} ${JSON.stringify(changed).slice(0, 500)}`);
  }

  report.failures = failures;
  assert.deepEqual(
    failures, [],
    `这些用例没在画面上/代码层产生变化（服务端没拿到新值，或量不到差别）：${failures.join(", ")}`,
  );
  console.log(`\nPASS: ${active.length} 条用例条条都在画面上量到了变化；配置全部逐字节还原。`);
  console.log(`截图：${shotDir}`);
} catch (error) {
  report.error = String(error?.stack ?? error);
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
} finally {
  // 出错、断言失败、被看门狗掐断，都要落一份报告——不然只剩屏幕上滚过去的几行，事后查不了
  finalize(report.error === undefined ? "done" : "error");
  clearTimeout(watchdog);
  socket?.close?.();
}

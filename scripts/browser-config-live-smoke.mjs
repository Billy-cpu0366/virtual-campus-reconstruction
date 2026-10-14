// 配置实测冒烟：改一个配置值 → 刷新页面（**不重新构建**）→ 在真浏览器里量出来 + 截图 → 改回去。
//
// 覆盖已接线板块。每接一个板块，就往下面 TESTS 表里加用例，
// 再在 MEASURE 里加上这个板块要量的数——这是「接线接上了没有」的最后一关。
// 用例 01-10 是 NPC，11-14 是 SYS-ROUTE，15 起覆盖新增板块。
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
// 每个板块的数据目录。用例不单独写 `dir` 时用 NPC 那份（下面大部分还是 NPC 的）。
const DATA_DIRS = {
  npc: "config/default/05-旁支/SYS-NPC/数据",
  route: "config/default/05-旁支/SYS-ROUTE/数据",
  chunk: "config/default/01-地图线/SYS-CHUNK/数据",
  zone: "config/default/03-内容线/SYS-ZONE/数据",
  move: "config/default/02-玩法线/SYS-MOVE/数据",
  input: "config/default/02-玩法线/SYS-INPUT/数据",
  world: "config/default/01-地图线/SYS-WORLD/数据",
  camera: "config/default/02-玩法线/SYS-CAMERA/数据",
  interact: "config/default/03-内容线/SYS-INTERACT/数据",
  layer: "config/default/02-玩法线/SYS-LAYER/数据",
  player: "config/default/02-玩法线/SYS-PLAYER/数据",
  entity: "config/default/04-独立件/SYS-ENTITY/数据",
  fx: "config/default/05-旁支/SYS-FX/数据",
  app: "config/default/04-独立件/SYS-APP/数据",
  gameUi: "config/default/04-独立件/SYS-GAME-UI/数据",
  transport: "config/default/06-网络协议层/SYS-TRANSPORT/数据",
};
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
  {
    // ---- 从这一条起是 SYS-ROUTE。板块接线的第一件事就是让它们出现在这张表里。
    id: "11-helicopter-scale",
    dir: DATA_DIRS.route,
    file: "vehicle-config.json",
    camera: [504, 1288],
    what: "直升机个头 scale 2 -> 5",
    apply: (json) => {
      json.data.helicopter.scale = 5;
    },
  },
  {
    id: "12-helicopter-move",
    dir: DATA_DIRS.route,
    file: "vehicle-config.json",
    camera: [504, 1288],
    what: "直升机从楼顶 (504,1288) 挪到 (620,1180)",
    apply: (json) => {
      json.data.helicopter.position = { x: 620, y: 1180 };
    },
  },
  {
    id: "13-police-scale",
    dir: DATA_DIRS.route,
    file: "vehicle-config.json",
    camera: [1790, 1331],
    what: "三辆警车个头 scale 1 -> 3",
    apply: (json) => {
      json.data.police.scale = 3;
    },
  },
  {
    id: "14-train-exit-distance",
    dir: DATA_DIRS.route,
    file: "train-config.json",
    camera: [480, 310],
    what: "火车开出去多远 exitDistance 4000 -> 1000（等它真停下再量：改前应停在 480-4000，改后 480-1000）",
    apply: (json) => {
      json.data.exitDistance = 1000;
    },
    // 开跑那一刻火车还在开出去，等的就是它到站。
    settle: {
      label: "火车离场结束",
      expression: `(() => { for (const game of __games) {
        const snapshot = game?.scene?.getScene?.("campus")?.trainRuntime?.snapshot;
        if (snapshot) return snapshot.state;
      } return null; })()`,
      predicate: (state) =>
        state === "complete" || state === "cancelled" || state === "shutdown",
    },
  },
  {
    id: "15-chunk-camera-padding",
    dir: DATA_DIRS.chunk,
    file: "chunk-config.json",
    camera: [1000, 1000],
    what: "相机预载边距 cameraPadding 1 -> 0，量稳定后的目标分块数",
    apply: (json) => { json.data.cameraPadding = 0; },
    expectedChange: "chunkTargetCount",
    settle: {
      label: "分块请求全部结束",
      expression: `(() => { for (const game of __games) {
        const state = game?.scene?.getScene?.("campus")?.coordinator?.state;
        if (state) return { targets: state.targets?.length, requesting: state.requesting?.length };
      } return null; })()`,
      predicate: (state) => state?.targets > 0 && state?.requesting === 0,
    },
  },
  {
    id: "16-zone-memo6-position",
    dir: DATA_DIRS.zone,
    file: "zone-config.json",
    camera: [496, 176],
    what: "MEMO6 触发点和地图标记 x 从 496 移到 720",
    apply: (json) => {
      json.data.markers.find((marker) => marker.markerId === "memo6").x = 720;
    },
    expectedChange: "memo6Marker",
  },
  {
    id: "17-move-drag",
    dir: DATA_DIRS.move,
    file: "move-config.json",
    camera: [1000, 1000],
    what: "玩家松手阻力 drag 从 300 调为 180，量碰撞体阻力",
    apply: (json) => { json.data.drag = 180; },
    expectedChange: "playerDrag",
  },
  {
    id: "18-input-desktop-joystick",
    dir: DATA_DIRS.input,
    file: "input-config.json",
    camera: [1000, 1000],
    what: "桌面摇杆 visible 从 false 调为 true，量摇杆的运行时显示状态",
    apply: (json) => { json.data.desktop.joystickVisible = true; },
    expectedChange: "joystickVisible",
  },
  {
    id: "19-world-clear-budget",
    dir: DATA_DIRS.world,
    file: "world-config.json",
    camera: [1000, 1000],
    what: "世界图层每帧清理预算 clearLayersPerFrame 从 4 调为 2",
    apply: (json) => { json.data.clearLayersPerFrame = 2; },
    expectedChange: "worldClearLayersPerFrame",
  },
  {
    id: "20-camera-zoom",
    dir: DATA_DIRS.camera,
    file: "camera-config.json",
    camera: [1000, 1000],
    what: "相机缩放 zoom 从 1 调为 1.25，量 Phaser 相机当前 zoom",
    apply: (json) => { json.data.settings.zoom = 1.25; },
    expectedChange: "cameraZoom",
  },
  {
    id: "21-interact-content",
    dir: DATA_DIRS.interact,
    file: "interact-config.json",
    camera: [944, 768],
    what: "About 弹窗标题从 About me 改为 CONFIG-LIVE-ABOUT",
    apply: (json) => { json.data.content.about.title = "CONFIG-LIVE-ABOUT"; },
    expectedChange: "contentTitle",
    prepare: `(() => { for (const game of __games) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene) continue;
      scene.openContentFromMap({ markerId: "about", menuId: "about", enabled: true });
      return document.getElementById("content-title")?.textContent === "CONFIG-LIVE-ABOUT"
        || document.getElementById("content-title")?.textContent === "About me";
    } return false; })()`,
  },
  {
    id: "22-layer-depth",
    dir: DATA_DIRS.layer,
    file: "layer-config.json",
    camera: [1000, 1000],
    what: "layer1 深度从 100 改为 777，量 Tilemap 实例 depth",
    apply: (json) => {
      const layer = json.data.strategies.find((entry) => entry.name === "layer1");
      layer.depth = 777;
    },
    expectedChange: "layer1Depth",
  },
  {
    id: "23-player-display-size",
    dir: DATA_DIRS.player,
    file: "player-config.json",
    camera: [1088, 304],
    what: "玩家显示尺寸从 48 改为 64，量玩家精灵 displayWidth",
    apply: (json) => { json.data.displaySize = 64; },
    expectedChange: "playerDisplayWidth",
  },
  {
    id: "24-entity-cleanup-order",
    dir: DATA_DIRS.entity,
    file: "entity-config.json",
    camera: [1088, 304],
    what: "静态 NPC 与静态人群的清理顺序互换，量真实 shutdown 调用轨迹",
    apply: (json) => {
      const order = json.data.cleanupOrder;
      const npc = order.indexOf("static-npc");
      const crowd = order.indexOf("static-crowd");
      [order[npc], order[crowd]] = [order[crowd], order[npc]];
    },
    expectedChange: "entityCleanupOrder",
    prepare: `(() => {
      for (const game of __games) {
        const scene = game?.scene?.getScene?.("campus");
        const npc = scene?.staticNpcRuntime;
        const crowd = scene?.staticCrowdRuntime;
        if (!scene || !npc || !crowd) continue;
        const trace = globalThis.__entityCleanupTrace = [];
        globalThis.__entityCleanupDone = false;
        for (const [runtime, name] of [[npc, "static-npc"], [crowd, "static-crowd"]]) {
          const shutdown = runtime.shutdown.bind(runtime);
          runtime.shutdown = (...args) => { trace.push(name); return shutdown(...args); };
        }
        void scene.shutdownForGeneration().then(() => {
          globalThis.__entityCleanupDone = true;
        }, (error) => {
          globalThis.__entityCleanupError = String(error);
          globalThis.__entityCleanupDone = true;
        });
        return true;
      }
      return false;
    })()`,
    settle: {
      label: "场景关停完成并记录两个 NPC 运行时",
      expression: "globalThis.__entityCleanupDone === true ? globalThis.__entityCleanupTrace : null",
      predicate: (trace) => Array.isArray(trace) && trace.length === 2,
    },
  },
  {
    id: "25-factory-smoke-anchor",
    dir: DATA_DIRS.fx,
    file: "fx-config.json",
    camera: [1_000, 600],
    what: "工厂烟囱 x 坐标从 808 改为 1000，量粒子运行时锚点",
    apply: (json) => { json.data.factorySmoke.x = 1_000; },
    expectedChange: "factorySmokeAnchorX",
  },
  {
    id: "26-game-ui-root-padding",
    dir: DATA_DIRS.gameUi,
    file: "game-ui-config.json",
    camera: [1_000, 600],
    what: "桌面页面边距从 24px 改为 40px，量 app-shell 的内联 padding",
    apply: (json) => { json.data.rootPadding.desktop = "40px"; },
    expectedChange: "appShellPadding",
  },
  {
    id: "27-app-logical-width",
    dir: DATA_DIRS.app,
    file: "app-config.json",
    camera: [1_000, 600],
    what: "Phaser 逻辑宽度从 480 改为 600，量实际 game.config.width",
    apply: (json) => { json.data.logicalWidth = 600; },
    expectedChange: "appLogicalWidth",
  },
  {
    // ---- §17 网络协议层。超时不是画面值，量的是场景实际喂给 fetchJson 的那份。
    id: "28-transport-json-timeout",
    dir: DATA_DIRS.transport,
    file: "transport-config.json",
    camera: [1_000, 600],
    what: "JSON 请求超时从 15000 改为 45000，量场景包装 JsonLoader 时传入的超时",
    apply: (json) => { json.data.timeouts.json = 45000; },
    expectedChange: "jsonTimeoutMs",
  },
];

// ------------------------------------------------------------------ 原值备份
//
// 键是「目录 + 文件名」：将来两个板块出现同名文件时也不会串。
const originals = new Map();
for (const test of TESTS) {
  const dir = test.dir ?? DATA_DIRS.npc;
  const key = `${dir}/${test.file}`;
  if (originals.has(key)) continue;
  const text = readFileSync(join(dir, test.file), "utf8");
  originals.set(key, {
    path: join(dir, test.file),
    text,
    // 配置是由 vite 开发中间件直接当静态文件端出来的，所以请求地址就是磁盘路径的 URL 编码
    url: new URL(`${dir}/${test.file}`, inputUrl).toString(),
  });
}
// 先把上一次跑留下的「原值」读下来，再覆盖写——preflight 要靠它判断「这份配置在两次跑之间被动过没有」。
// 备份文件名把目录里的斜杠换成 `--`，免得在 <out> 下再建一层目录。
const backupName = (key) => `原值-${key.replace(/[\\/]/g, "--")}`;
const previousOriginals = new Map();
for (const key of originals.keys()) {
  const previousPath = join(outDir, backupName(key));
  previousOriginals.set(key, existsSync(previousPath) ? readFileSync(previousPath, "utf8") : undefined);
}

mkdirSync(shotDir, { recursive: true });
for (const [key, original] of originals) {
  writeFileSync(join(outDir, backupName(key)), original.text, "utf8");
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

/**
 * 一个镜头要量哪些数。
 *
 * NPC 那一组：人群总数 / 画面内数量 / 缩放、静态 NPC 坐标、喷水器、气泡。
 * SYS-ROUTE 那一组：直升机、三辆警车、火车——**量的是运行时快照**，不是像素。
 * 快照里的数就是画面上那个对象身上的数（`x`/`y`/`scale` 直接取自 sprite），
 * 所以「快照变了」等价于「画面上那个东西变了」，截图也一并存着可以对着看。
 *
 * `scene.vehicleRuntime` / `scene.trainRuntime` 在 TS 里是 private，运行时就是普通属性，能直接取。
 */
const MEASURE = `(() => {
  if (typeof __games === "undefined") return null;
  for (const game of __games) {
    const scene = game?.scene?.getScene?.("campus");
    const entityCleanupTrace = globalThis.__entityCleanupTrace;
    if (scene && Array.isArray(entityCleanupTrace)) {
      return { entityCleanupOrder: entityCleanupTrace.join(",") };
    }
    const camera = scene?.cameras?.main;
    if (!scene || !camera) continue;
    const view = camera.worldView;
    const entries = (map) => [...(map ?? new Map())];
    const inView = (map, half) => entries(map).filter(([, sprite]) =>
      sprite.x + half >= view.x && sprite.x - half <= view.x + view.width &&
      sprite.y + half >= view.y && sprite.y - half <= view.y + view.height).length;
    const dancing = entries(scene.dancingCrowdRuntime?.sprites);
    const bugs = entries(scene.bugCrowdRuntime?.sprites);
    const vehicle = scene.vehicleRuntime?.snapshot;
    const heli = vehicle?.helicopter;
    const train = scene.trainRuntime?.snapshot;
    const chunkState = scene.coordinator?.state;
    const memo6 = scene.zoneRuntime?.markers?.find((marker) => marker.markerId === "memo6");
    const memo6Dom = document.querySelector('[data-big-map-marker="memo6"]');
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
      helicopter: heli ? {
        x: Math.round(heli.x), y: Math.round(heli.y),
        scale: Number(heli.scale.toFixed(2)),
        depth: heli.depth,
        frame: heli.frame,
        bladeCount: heli.bladeCount,
        mainRotorSize: heli.mainRotorSize,
        mainRotorOffset: heli.mainRotorOffset,
        componentKeys: heli.componentKeys,
      } : null,
      police: (vehicle?.police ?? []).map((car) => ({
        id: car.id, x: Math.round(car.x), y: Math.round(car.y), frame: car.frame,
        scale: Number(car.scale.toFixed(2)), depth: car.depth,
      })),
      train: train ? { state: train.state, x: Math.round(train.x) } : null,
      chunkTargetCount: chunkState?.targets?.length ?? null,
      memo6Marker: memo6 ? { x: memo6.x, y: memo6.y, left: memo6Dom?.style.left ?? null } : null,
      playerDrag: scene.player?.body?.drag?.x ?? null,
      joystickVisible: scene.joystick?.debugState?.().visible ?? null,
      worldClearLayersPerFrame: scene.worldRenderer?.teardownSnapshot?.clearLayersPerFrame ?? null,
      cameraZoom: camera.zoom,
      contentTitle: document.getElementById("content-title")?.textContent ?? null,
      layer1Depth: entries(scene.worldRenderer?.layers).find(([key]) => key.startsWith("layer1@"))?.[1]?.depth ?? null,
      playerDisplayWidth: scene.player?.displayWidth ?? null,
      entityCleanupOrder: globalThis.__entityCleanupTrace?.join(",") ?? null,
      factorySmokeAnchorX: scene.smokeRuntime?.visualSnapshot?.anchor?.x ?? null,
      appShellPadding: document.getElementById("app-shell")?.style.padding ?? null,
      appLogicalWidth: game?.config?.width ?? null,
      jsonTimeoutMs: scene.transportSnapshot?.jsonTimeoutMs ?? null,
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

/**
 * 开一次游戏：导航 → 等到能玩 → 把镜头对准 → （可选）等某个状态稳定 → 量一遍 + 截图。
 *
 * `settle` 是给「这条用例要量的数在开跑那一刻还没定下来」用的。火车那条就是：
 * 进场流程结束时火车还在开出去，这时候量到的是「这一刻开到哪儿了」，两次跑差几百像素
 * 可能只是加载快慢——看着变了，其实跟改的那个值没关系。等它真停下来再量，才是那条配置说了算。
 * **量到没稳定下来的数，比没量到更坏**：报告是绿的，结论却是错的。
 */
async function loadAndPlay(tag, camera, settle, prepare) {
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
  if (prepare !== undefined) {
    const prepared = await evaluate(prepare);
    if (prepared !== true) throw new Error("config-live smoke preparation failed");
    await sleep(300);
  }
  if (settle !== undefined) {
    await waitFor(settle.expression, settle.predicate, settle.label ?? "settle", 90_000);
    // 状态到位之后再松一口气：上一帧刚变，画面上那个对象可能还差这一帧
    await sleep(400);
  }
  const measured = await evaluate(MEASURE);
  const shot = await command("Page.captureScreenshot", { format: "png" });
  return { measured, png: shot.data, noise: [...noise] };
}

/** 只留改前改后不一样的那几项，并排成 [改前, 改后]。 */
function diff(before, after) {
  if (typeof before.entityCleanupOrder === "string" || typeof after.entityCleanupOrder === "string") {
    return before.entityCleanupOrder === after.entityCleanupOrder
      ? {}
      : { entityCleanupOrder: [before.entityCleanupOrder, after.entityCleanupOrder] };
  }
  const scalarKeys = [
    "dancingTotal", "dancingInView", "dancingScale",
    "bugTotal", "bugInView", "bugScale",
    "venueTotal", "venueInView",
    "staticCrowdTotal", "staticCrowdInView",
    "chunkTargetCount", "playerDrag", "joystickVisible", "worldClearLayersPerFrame", "cameraZoom", "contentTitle", "layer1Depth", "playerDisplayWidth", "entityCleanupOrder", "factorySmokeAnchorX", "appShellPadding", "appLogicalWidth", "jsonTimeoutMs",
  ];
  const out = {};
  for (const key of scalarKeys) {
    if (before[key] !== after[key]) out[key] = [before[key], after[key]];
  }
  // 对象/数组类的按整体比。`train` 是对象也走这一支。
  for (const key of [
    "sprayers", "staticNpcAll", "helicopter", "police", "train", "memo6Marker",
  ]) {
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
for (const [key, original] of originals) {
  report.originals[key] = { sha256_16: sha(original.text), restored: null, servedMatchesDisk: null };
}

function finalize(finishedBy) {
  restoreAll();
  report.finishedBy = finishedBy;
  for (const [key, original] of originals) {
    report.originals[key].restored =
      readFileSync(original.path, "utf8") === original.text ? "byte-identical" : "MISMATCH";
  }
  report.noise = noise;
  writeFileSync(join(outDir, "RESULT.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`report -> ${join(outDir, "RESULT.json")}`);
  console.log(`restore: ${JSON.stringify(
    Object.fromEntries(Object.entries(report.originals).map(([key, v]) => [key, v.restored])),
  )}`);
}

const watchdog = setTimeout(() => {
  console.error("WATCHDOG: hard timeout");
  console.error(`配置原文在 ${outDir}/原值-*.json，照着自己那份路径抄回去即可。`);
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
  for (const [key, original] of originals) {
    const previous = previousOriginals.get(key);
    if (previous !== undefined && previous !== original.text) drifted.push(key);
  }
  if (drifted.length > 0 && process.env.CONFIG_LIVE_ADOPT !== "1") {
    throw new Error(
      `${drifted.join(", ")} 和上一跑记录的原值对不上，先确认现在磁盘上这份是对的：\n`
      + `  确认无误 -> 删掉 ${outDir}/原值-*.json 或设 CONFIG_LIVE_ADOPT=1 重新采原值\n`
      + `  是被改坏了 -> 从 ${outDir}/原值-*.json 抄回去再跑`,
    );
  }

  // 前置检查二：开发服务器端出来的配置，和磁盘上那份是不是同一份（确认读的真是磁盘）
  for (const [key, original] of originals) {
    report.originals[key].servedMatchesDisk =
      (await (await fetch(original.url)).text()) === original.text;
  }
  const notServed = Object.entries(report.originals)
    .filter(([, v]) => v.servedMatchesDisk !== true)
    .map(([key]) => key);
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
    // 基线镜头可能被同一镜头的多条用例共用，等的条件取该镜头下**最长的那个**：
    // 基线只要等够，后面每条要量的数就都是稳定的。
    const settles = active.filter((test) => test.camera.join(",") === key)
      .map((test) => test.settle).filter(Boolean);
    const prepare = active.find((test) => test.camera.join(",") === key && test.prepare)?.prepare;
    const run = await loadAndPlay(`base-${tag}`, camera, settles.at(-1), prepare);
    writeFileSync(
      join(shotDir, `00-baseline-${tag}-${key.replace(",", "_")}.png`),
      run.png,
      "base64",
    );
    baselines.set(key, run.measured);
    const m = run.measured;
    if (m.entityCleanupOrder !== undefined) {
      console.log(`  entityCleanupOrder=${m.entityCleanupOrder}`);
    } else {
      console.log(`  dancing=${m.dancingTotal} bugs=${m.bugTotal} venueInView=${m.venueInView}`
        + ` staticCrowd=${m.staticCrowdTotal} staticNpc=${m.staticNpcAll.length}`
        + ` sprayers=${m.sprayers.length} bubbles=${m.bubbles.length} fps=${m.fps}`);
      console.log(`  helicopter=${JSON.stringify(m.helicopter && {
        x: m.helicopter.x, y: m.helicopter.y, scale: m.helicopter.scale,
      })} police=${m.police.length} train=${JSON.stringify(m.train)}`);
    }
  }

  const failures = [];
  let index = 0;
  for (const test of active) {
    index += 1;
    const original = originals.get(`${test.dir ?? DATA_DIRS.npc}/${test.file}`);
    const json = JSON.parse(original.text);
    test.apply(json);
    const mutated = `${JSON.stringify(json, null, 2)}\n`;
    writeFileSync(original.path, mutated, "utf8");
    const servedNow = (await (await fetch(original.url)).text()) === mutated;
    console.log(`[${test.id}] ${test.file} :: ${test.what} | served===newfile: ${servedNow}`);

    let changed = {};
    try {
      const run = await loadAndPlay(`${test.id}-${index}`, test.camera, test.settle, test.prepare);
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
    const expectedMissing = test.expectedChange !== undefined && !(test.expectedChange in changed);
    if (empty || expectedMissing || servedNow !== true) failures.push(test.id);
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

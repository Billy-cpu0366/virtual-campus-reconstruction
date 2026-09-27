#!/usr/bin/env node
// Prepare the ignored runtime directory from versioned public evidence.
// This is the only supported way to create public/ for the playable prototype.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets",
);
const RUNTIME_ROOT = resolve(ROOT, "public");
const SANITIZER = resolve(ROOT, "scripts/sanitize-runtime-maps.mjs");
const CONTENT_MANIFEST = resolve(ROOT, "scripts/runtime-content-assets.json");
const ROUTE_CROWD_TEXTURES = [
  "npc-man", "npc-man2", "npc-woman", "npc-woman2", "npc-woman3",
  "npc-woman4", "npc-woman5", "npc-woman6", "npc-woman7", "npc-woman8",
  "npc-man3", "npc-man4", "npc-man5", "npc-man6", "npc-man8", "npc-man9",
  "npc-man10",
];
const STATIC_NPC_TEXTURES = [
  "npc-special-reading", "npc-special-eating", "npc-cat-licking",
];
const STATIC_CROWD_TEXTURES = [
  "npc-man-beach", "npc-man-beach2", "npc-woman-beach", "npc-woman-beach2",
  "npc_footballer_blue", "npc_footballer_red", "npc-hazmat-suit", "npc-bug", "npc_protester_rising",
];
const DANCING_CROWD_TEXTURES = ["npc-dancing-down", "npc-dancing-left", "npc-dancing-right", "npc-dancing-up"];
// 喷水器原来是从 `src/npc/assets/` 里直接用 `new URL(..., import.meta.url)` 取图的，
// 打包器认不出那种写法（动态拼出来的路径它静态分析不了），线上和开发时都会落到
// 一个取不到的地址上，贴图登记不进 Phaser，整个动态世界起不来。现在和其它 NPC
// 贴图走同一条路：原站镜像 → `public/sprites/` → 配置里记 `/sprites/....webp`。
const SPRAYER_TEXTURES = ["npc-sprayer", "npc-sprayer-running"];
const VEHICLE_ASSETS = [
  ["sprites/npc-helicopter.webp", "sprites/npc-helicopter.webp"],
  [
    "sprites/npc-helicopter-rotor-back.webp",
    "sprites/npc-helicopter-rotor-back.webp",
  ],
  [
    "sprites/npc-helicopter-rotor-main.webp",
    "sprites/npc-helicopter-rotor-main.webp",
  ],
  [
    "sprites/npc-helicopter-high-resolution.webp",
    "sprites/npc-helicopter-high-resolution.webp",
  ],
  ["sprites/cars/car-police.webp", "sprites/cars/car-police.webp"],
];

// 地图资源按原站运行期的真实地址落盘：根是 /assets/maps，扩展名取原站 bundle
// 里实际 load 的那一个。原站加载的是 collisions-objects.webp 与
// tileset-particles.webp（`chunk-WMFY56ZM.js`），不是同名 .png —— 那两个 .png
// 是 Tiled 作图源（`tileset-particles.tsx` 指向它），运行期不用。
// 见 src/asset/urls.ts（`MAP_BASE_URL`）。
const FILES = [
  ["maps/exterior-final.webp", "assets/maps/exterior-final.webp"],
  ["maps/collisions-objects.webp", "assets/maps/collisions-objects.webp"],
  ["maps/tileset-particles.webp", "assets/maps/tileset-particles.webp"],
  ["maps/walls-layer.json", "assets/maps/walls-layer.json"],
  ["sprites/player.webp", "sprites/player.webp"],
  ["sprites/player-beach.webp", "sprites/player-beach.webp"],
  ["sprites/player-clothes-off.webp", "sprites/player-clothes-off.webp"],
  ...ROUTE_CROWD_TEXTURES.map((name) => [
    `sprites/${name}.webp`,
    `sprites/${name}.webp`,
  ]),
  ...STATIC_NPC_TEXTURES.map((name) => [
    `sprites/special/${name}.webp`,
    `sprites/special/${name}.webp`,
  ]),
  ...STATIC_CROWD_TEXTURES.map((name) => [
    `sprites/${name}.webp`,
    `sprites/${name}.webp`,
  ]),
  ...DANCING_CROWD_TEXTURES.map((name) => [
    `sprites/special/${name}.webp`,
    `sprites/special/${name}.webp`,
  ]),
  ...SPRAYER_TEXTURES.map((name) => [
    `sprites/${name}.webp`,
    `sprites/${name}.webp`,
  ]),
  ...VEHICLE_ASSETS,
  ["images/peter-oravec.gif", "assets/images/peter-oravec.gif"],
  ["images/peteroravec-logo.webp", "assets/images/peteroravec-logo.webp"],
  ["maps/mini-map.webp", "assets/maps/mini-map.webp"],
  ["maps/big-map.webp", "assets/maps/big-map.webp"],
  ["images/ui/map-holder-mini3.webp", "assets/images/ui/map-holder-mini3.webp"],
  ["js/phaser.min.js", "vendor/phaser.min.js"],
  ["maps/chunks/master.json", "assets/maps/chunks/master.json"],
  ...Array.from({ length: 25 }, (_, index) => [
    `maps/chunks/chunk${index}.json`,
    `assets/maps/chunks/chunk${index}.json`,
  ]),
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeResolve(root, relativePath, label) {
  const path = resolve(root, relativePath);
  const relativeToRoot = relative(root, path);
  if (
    isAbsolute(relativeToRoot) ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${sep}`)
  ) {
    throw new Error(`${label} escapes its root: ${relativePath}`);
  }
  return path;
}

for (const [sourceRelative, targetRelative] of FILES) {
  const source = safeResolve(SOURCE_ROOT, sourceRelative, "runtime source");
  const target = safeResolve(RUNTIME_ROOT, targetRelative, "runtime target");
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`copied ${sourceRelative} -> public/${targetRelative}`);
}

const contentAssets = JSON.parse(readFileSync(CONTENT_MANIFEST, "utf8"));
if (!Array.isArray(contentAssets) || contentAssets.length !== 10) {
  throw new Error("content runtime manifest must contain exactly 10 assets");
}
for (const asset of contentAssets) {
  const expectedTarget = String(asset.src).replace(/^\/+/, "");
  if (asset.targetRelative !== expectedTarget) {
    throw new Error(`content target does not match registry src: ${asset.src}`);
  }
  const source = safeResolve(SOURCE_ROOT, asset.sourceRelative, "content source");
  const target = safeResolve(RUNTIME_ROOT, asset.targetRelative, "content target");
  const sourceHash = sha256(source);
  if (sourceHash !== asset.sha256) {
    throw new Error(`content source hash mismatch: ${asset.sourceRelative}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  if (sha256(target) !== asset.sha256) {
    throw new Error(`content runtime hash mismatch: ${asset.targetRelative}`);
  }
  console.log(`copied ${asset.sourceRelative} -> public/${asset.targetRelative}`);
}

execFileSync(process.execPath, [SANITIZER], {
  cwd: ROOT,
  stdio: "inherit",
});

console.log("runtime assets prepared from sample public evidence");

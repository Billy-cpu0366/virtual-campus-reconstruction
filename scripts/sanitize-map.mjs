// 联网+渲染雏形：把 Tiled 导出的 final_map.json 规整成 Phaser 3.90 可解析的形态。
//
// 原因（FACT）：final_map.json 的 tilesets 含一个外部 tileset
//   { "firstgid": 69355, "source": "tileset-particles.tsx" }
// Phaser 3.90 的 ParseToTilemap 对「source 型外部 tileset」是空分支（不建 Tileset），
// 但地图数据里仍有 GID >= 69355 的 tile（layer3 49 个 + particles/particles2/particles3 层），
// 解析时 t.tiles[gid] 为 undefined → "Cannot read properties of undefined (reading '2')" 崩掉。
//
// 本雏形不渲染粒子层（particles 是未来系统），所以把外部 tileset 条目删掉、
// 并把所有 GID >= 69355 的 tile 归零（空 tile），既消除崩溃、又不丢渲染需要的数据。
//
// 源：sample/original-public-build/mirror/assets/maps/final_map.json
// 目标：public/maps/final_map.json（gitignored，派生文件）
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "sample/original-public-build/mirror/assets/maps/final_map.json";
const OUT = "public/maps/final_map.json";
const EXTERNAL_FIRSTGID = 69355;

const j = JSON.parse(readFileSync(SRC, "utf8"));

const before = j.tilesets.length;
j.tilesets = j.tilesets.filter((ts) => !ts.source);
const removed = before - j.tilesets.length;

let clamped = 0;
for (const layer of j.layers) {
  if (!Array.isArray(layer.data)) continue;
  for (let i = 0; i < layer.data.length; i++) {
    if (layer.data[i] >= EXTERNAL_FIRSTGID) {
      layer.data[i] = 0;
      clamped++;
    }
  }
}

writeFileSync(OUT, JSON.stringify(j));
console.log(`tilesets ${before} -> ${j.tilesets.length} (removed ${removed} external)`);
console.log(`clamped ${clamped} tiles (GID >= ${EXTERNAL_FIRSTGID}) to 0`);
console.log(`map ${j.width}x${j.height}, ${j.layers.length} layers -> ${OUT}`);

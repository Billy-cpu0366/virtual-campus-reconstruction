#!/usr/bin/env node
// Check the runtime files and sanitized map expected by game/CampusScene.ts.
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RUNTIME_ROOT = resolve(ROOT, "public");
const SOURCE_ROOT = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets",
);

const FILES = [
  ["maps/exterior-final.webp", "maps/exterior-final.webp"],
  ["maps/collisions-objects.png", "maps/collisions-objects.png"],
  ["sprites/player.webp", "sprites/player.webp"],
  ["js/phaser.min.js", "vendor/phaser.min.js"],
];

const CHUNK_FILES = [
  "maps/chunks/master.json",
  ...Array.from({ length: 25 }, (_, index) => `maps/chunks/chunk${index}.json`),
];

const errors = [];

for (const [sourceRelative, targetRelative] of FILES) {
  const source = resolve(SOURCE_ROOT, sourceRelative);
  const target = resolve(RUNTIME_ROOT, targetRelative);
  if (!existsSync(source)) {
    errors.push(`missing versioned source: sample/.../assets/${sourceRelative}`);
    continue;
  }
  if (!existsSync(target)) {
    errors.push(`missing runtime file: public/${targetRelative}`);
    continue;
  }
  if (statSync(source).size !== statSync(target).size) {
    errors.push(`size mismatch: ${sourceRelative} -> ${targetRelative}`);
  }
}

const mapPath = resolve(RUNTIME_ROOT, "maps/final_map.json");
if (!existsSync(mapPath)) {
  errors.push("missing runtime file: public/maps/final_map.json");
} else {
  try {
    const map = JSON.parse(readFileSync(mapPath, "utf8"));
    if (map.width !== 140 || map.height !== 140) {
      errors.push(`unexpected map size: ${map.width}x${map.height}`);
    }
    if (!Array.isArray(map.layers) || map.layers.length !== 24) {
      errors.push(`unexpected layer count: ${map.layers?.length}`);
    }
    const external = (map.tilesets ?? []).filter((tileset) => tileset.source);
    if (external.length > 0) {
      errors.push("sanitized map still contains external tileset references");
    }
    let highGidCount = 0;
    for (const layer of map.layers ?? []) {
      if (!Array.isArray(layer.data)) continue;
      highGidCount += layer.data.filter((gid) => gid >= 69355).length;
    }
    if (highGidCount !== 0) {
      errors.push(`sanitized map still contains ${highGidCount} particle GIDs`);
    }
  } catch (error) {
    errors.push(`invalid map JSON: ${error.message}`);
  }
}

for (const relative of CHUNK_FILES) {
  const source = resolve(SOURCE_ROOT, relative);
  const target = resolve(RUNTIME_ROOT, relative);
  if (!existsSync(source)) {
    errors.push(`missing versioned source: sample/.../assets/${relative}`);
  }
  if (!existsSync(target)) {
    errors.push(`missing runtime file: public/${relative}`);
  }
}

const masterPath = resolve(RUNTIME_ROOT, "maps/chunks/master.json");
if (existsSync(masterPath)) {
  try {
    const master = JSON.parse(readFileSync(masterPath, "utf8"));
    if (
      master.chunkWidth !== 28 ||
      master.chunkHeight !== 28 ||
      master.nbChunksHorizontal !== 5 ||
      master.nbChunksVertical !== 5 ||
      master.originalWidth !== 140 ||
      master.originalHeight !== 140
    ) {
      errors.push("runtime chunk master geometry is invalid");
    }
    if (
      !Array.isArray(master.tilesets) ||
      master.tilesets.some((tileset) => tileset.source)
    ) {
      errors.push("runtime chunk master still contains external tileset references");
    }
  } catch (error) {
    errors.push(`invalid chunk master JSON: ${error.message}`);
  }
}

for (const relative of CHUNK_FILES.slice(1)) {
  const chunkPath = resolve(RUNTIME_ROOT, relative);
  if (!existsSync(chunkPath)) continue;
  try {
    const chunk = JSON.parse(readFileSync(chunkPath, "utf8"));
    if (
      chunk.width !== 28 ||
      chunk.height !== 28 ||
      !Array.isArray(chunk.layers) ||
      chunk.layers.length !== 24
    ) {
      errors.push(`invalid chunk shape: ${relative}`);
      continue;
    }
    const highGids = chunk.layers.reduce((count, layer) => {
      if (!Array.isArray(layer.data)) return count;
      return count + layer.data.filter((gid) => gid >= 69355).length;
    }, 0);
    if (highGids !== 0) {
      errors.push(`${relative} still contains ${highGids} particle GIDs`);
    }
  } catch (error) {
    errors.push(`invalid chunk JSON ${relative}: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error("FAIL runtime asset check");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PASS runtime asset check");

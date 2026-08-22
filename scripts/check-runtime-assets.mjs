#!/usr/bin/env node
// Check the runtime files and sanitized map expected by game/CampusScene.ts.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RUNTIME_ROOT = resolve(ROOT, "public");
const SOURCE_ROOT = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets",
);
const CONTENT_MANIFEST = resolve(ROOT, "scripts/runtime-content-assets.json");

const FILES = [
  ["maps/exterior-final.webp", "maps/exterior-final.webp"],
  ["maps/collisions-objects.png", "maps/collisions-objects.png"],
  ["maps/tileset-particles.png", "maps/tileset-particles.png"],
  ["sprites/player.webp", "sprites/player.webp"],
  ["js/phaser.min.js", "vendor/phaser.min.js"],
];

const CHUNK_FILES = [
  "maps/chunks/master.json",
  ...Array.from({ length: 25 }, (_, index) => `maps/chunks/chunk${index}.json`),
];
const RAW_PARTICLE_GIDS = new Set([69355, 69356, 69357, 69358, 69359]);
const MARKER_GIDS = new Map([
  ["cars", new Set([69345, 69346, 69347, 69348, 69349, 69350, 69351, 69352])],
  ["particles3", new Set([69361])],
  ["footsteps", new Set([69345])],
]);
const PARTICLE_TILESET = {
  columns: 7,
  firstgid: 69355,
  image: "tileset-particles.png",
  imageheight: 16,
  imagewidth: 112,
  name: "tileset-particles",
  tilecount: 7,
  tileheight: 16,
  tilewidth: 16,
};

function pngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  ) {
    throw new Error("not a PNG");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function checkParticleTileset(tilesets, label) {
  const external = (tilesets ?? []).filter((tileset) => tileset.source);
  if (external.length > 0) {
    errors.push(`${label} still contains external tileset references`);
  }
  const particleTilesets = (tilesets ?? []).filter(
    (tileset) => tileset.name === PARTICLE_TILESET.name,
  );
  if (particleTilesets.length !== 1) {
    errors.push(`${label} must contain exactly one inline tileset-particles`);
    return;
  }
  const particleTileset = particleTilesets[0];
  for (const [key, expected] of Object.entries(PARTICLE_TILESET)) {
    if (particleTileset[key] !== expected) {
      errors.push(
        `${label} particle tileset ${key}=${particleTileset[key]} ` +
          `expected ${expected}`,
      );
    }
  }
}

function checkRawParticlePresence(layers, label) {
  for (const layerName of ["particles", "particles2"]) {
    const layer = (layers ?? []).find((item) => item.name === layerName);
    if (
      layer !== undefined &&
      (!Array.isArray(layer.data) ||
        !layer.data.some((gid) => RAW_PARTICLE_GIDS.has(gid)))
    ) {
      errors.push(`${label} has no retained raw visual ${layerName} GIDs`);
    }
  }
}

function checkLayerContracts(layers, label) {
  for (const layer of layers ?? []) {
    if (!Array.isArray(layer.data)) continue;
    if (layer.name === "particles" || layer.name === "particles2") {
      const unknown = layer.data.find(
        (gid) => gid !== 0 && !RAW_PARTICLE_GIDS.has(gid),
      );
      if (unknown !== undefined) {
        errors.push(`${label} has unsupported raw ${layer.name} GID ${unknown}`);
      }
      if (layer.data.includes(69360)) {
        errors.push(`${label} still contains UNKNOWN raw GID 69360`);
      }
      continue;
    }
    const allowed = MARKER_GIDS.get(layer.name);
    if (allowed !== undefined) {
      const unknown = layer.data.find(
        (gid) => gid !== 0 && !allowed.has(gid),
      );
      if (unknown !== undefined) {
        errors.push(`${label} has unsupported ${layer.name} GID ${unknown}`);
      }
      continue;
    }
    const highGid = layer.data.find((gid) => gid >= 69355);
    if (highGid !== undefined) {
      errors.push(`${label} still contains visual particle GID ${highGid}`);
    }
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeResolve(root, relative) {
  const path = resolve(root, relative);
  return path === root || path.startsWith(`${root}/`) ? path : undefined;
}

const errors = [];

try {
  const contentAssets = JSON.parse(readFileSync(CONTENT_MANIFEST, "utf8"));
  if (!Array.isArray(contentAssets) || contentAssets.length !== 10) {
    errors.push("content runtime manifest must contain exactly 10 assets");
  } else {
    for (const asset of contentAssets) {
      const expectedTarget = String(asset.src).replace(/^\/+/, "");
      if (asset.targetRelative !== expectedTarget) {
        errors.push(`content target does not match registry src: ${asset.src}`);
        continue;
      }
      const source = safeResolve(SOURCE_ROOT, asset.sourceRelative);
      const target = safeResolve(RUNTIME_ROOT, asset.targetRelative);
      if (source === undefined || target === undefined) {
        errors.push(`unsafe content asset path: ${asset.src}`);
        continue;
      }
      if (!existsSync(source)) {
        errors.push(`missing content source: ${asset.sourceRelative}`);
        continue;
      }
      if (sha256(source) !== asset.sha256) {
        errors.push(`content source hash mismatch: ${asset.sourceRelative}`);
      }
      if (!existsSync(target)) {
        errors.push(`missing content runtime file: public/${asset.targetRelative}`);
        continue;
      }
      if (sha256(target) !== asset.sha256) {
        errors.push(`content runtime hash mismatch: ${asset.targetRelative}`);
      }
    }
  }
} catch (error) {
  errors.push(`invalid content runtime manifest: ${error.message}`);
}

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
  if (sourceRelative === "maps/tileset-particles.png") {
    try {
      const sourceDimensions = pngDimensions(readFileSync(source));
      const targetDimensions = pngDimensions(readFileSync(target));
      for (const [label, dimensions] of [
        ["source", sourceDimensions],
        ["runtime", targetDimensions],
      ]) {
        if (dimensions.width !== 112 || dimensions.height !== 16) {
          errors.push(
            `${label} particle image is ${dimensions.width}x${dimensions.height}, ` +
              "expected 112x16",
          );
        }
      }
    } catch (error) {
      errors.push(`invalid particle image: ${error.message}`);
    }
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
    checkParticleTileset(map.tilesets, "final_map.json");
    checkRawParticlePresence(map.layers, "final_map.json");
    checkLayerContracts(map.layers, "final_map.json");
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
    checkParticleTileset(master.tilesets, "chunks/master.json");
    checkLayerContracts(master.layers, "chunks/master.json");
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
    checkParticleTileset(chunk.tilesets, relative);
    checkLayerContracts(chunk.layers, relative);
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

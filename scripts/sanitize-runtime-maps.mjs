// Prepare the final-map and master/chunk documents for the runtime prototype.
// Inline the evidence-backed particle tileset. Particles/particles2 retain
// only their confirmed raw visual GIDs; 69360 stays an UNKNOWN raw GID and
// is zeroed. Cars, particles3, and footsteps remain chunk-owned marker data.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_MAPS = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets/maps",
);
const RUNTIME_MAPS = resolve(ROOT, "public/maps");
const EXTERNAL_FIRSTGID = 69355;
const PARTICLE_TILESET_SOURCE = "tileset-particles.tsx";
const PARTICLE_TILESET = {
  columns: 7,
  firstgid: EXTERNAL_FIRSTGID,
  image: "tileset-particles.png",
  imageheight: 16,
  imagewidth: 112,
  name: "tileset-particles",
  tilecount: 7,
  tileheight: 16,
  tilewidth: 16,
};
const UNKNOWN_RAW_PARTICLE_GID = 69360;
const RAW_PARTICLE_GIDS = new Set([69355, 69356, 69357, 69358, 69359]);
const MARKER_GIDS = new Map([
  ["cars", new Set([69345, 69346, 69347, 69348, 69349, 69350, 69351, 69352])],
  ["particles3", new Set([69361])],
  ["footsteps", new Set([69345])],
]);

function inlineTilesets(tilesets) {
  return (tilesets ?? []).flatMap((tileset) => {
    if (!tileset.source) return [tileset];
    if (tileset.source === PARTICLE_TILESET_SOURCE) {
      return [{ ...PARTICLE_TILESET }];
    }
    return [];
  });
}

function sanitizeDocument(document, label) {
  const result = JSON.parse(JSON.stringify(document));
  const beforeTilesets = result.tilesets?.length ?? 0;
  result.tilesets = inlineTilesets(result.tilesets);
  const removedTilesets =
    beforeTilesets - result.tilesets.length +
    result.tilesets.filter((tileset) => tileset.source).length;

  let clamped = 0;
  let clampedUnsupportedMarkerTiles = 0;
  let preservedMarkerTiles = 0;
  for (const layer of result.layers ?? []) {
    if (!Array.isArray(layer.data)) continue;
    const allowedMarkerGids = MARKER_GIDS.get(layer.name);
    const isRawParticleLayer =
      layer.name === "particles" || layer.name === "particles2";
    for (let index = 0; index < layer.data.length; index += 1) {
      const gid = layer.data[index];
      if (allowedMarkerGids !== undefined) {
        if (gid === 0 || allowedMarkerGids.has(gid)) {
          if (gid !== 0) preservedMarkerTiles += 1;
          continue;
        }
        if (gid >= EXTERNAL_FIRSTGID) {
          layer.data[index] = 0;
          clampedUnsupportedMarkerTiles += 1;
          continue;
        }
      }
      if (isRawParticleLayer) {
        if (gid === 0 || RAW_PARTICLE_GIDS.has(gid)) continue;
        // Keep 69360 explicitly unsupported; do not assign it a visual meaning.
        if (gid === UNKNOWN_RAW_PARTICLE_GID || !RAW_PARTICLE_GIDS.has(gid)) {
          layer.data[index] = 0;
        }
        clampedUnsupportedMarkerTiles += 1;
        continue;
      }
      if (gid >= EXTERNAL_FIRSTGID) {
        layer.data[index] = 0;
        clamped += 1;
      }
    }
  }

  return {
    result,
    removedTilesets,
    clamped,
    clampedUnsupportedMarkerTiles,
    preservedMarkerTiles,
    label,
  };
}

function sanitizeFile(source, target, label) {
  const input = JSON.parse(readFileSync(source, "utf8"));
  const output = sanitizeDocument(input, label);
  writeFileSync(target, JSON.stringify(output.result));
  return output;
}

const final = sanitizeFile(
  resolve(SOURCE_MAPS, "final_map.json"),
  resolve(RUNTIME_MAPS, "final_map.json"),
  "final_map.json",
);
const master = sanitizeFile(
  resolve(SOURCE_MAPS, "chunks/master.json"),
  resolve(RUNTIME_MAPS, "chunks/master.json"),
  "chunks/master.json",
);

const chunkNames = readdirSync(resolve(SOURCE_MAPS, "chunks"))
  .filter((name) => /^chunk\d+\.json$/.test(name))
  .sort((left, right) => {
    const leftIndex = Number(left.match(/\d+/)?.[0]);
    const rightIndex = Number(right.match(/\d+/)?.[0]);
    return leftIndex - rightIndex;
  });

for (const name of chunkNames) {
  const output = sanitizeFile(
    resolve(SOURCE_MAPS, "chunks", name),
    resolve(RUNTIME_MAPS, "chunks", name),
    `chunks/${name}`,
  );
  console.log(
    `${output.label}: clamped ${output.clamped} visual particle GIDs, ` +
      `clamped ${output.clampedUnsupportedMarkerTiles} unsupported marker GIDs, ` +
      `preserved ${output.preservedMarkerTiles} marker tiles`,
  );
}

console.log(
  `${final.label}: tilesets ${final.removedTilesets} removed, ` +
    `${final.clamped} visual particle GIDs clamped, ` +
    `${final.clampedUnsupportedMarkerTiles} unsupported marker GIDs clamped, ` +
    `${final.preservedMarkerTiles} marker tiles preserved`,
);
console.log(
  `${master.label}: tilesets ${master.removedTilesets} removed, ` +
    `${master.clamped} visual particle GIDs clamped, ` +
    `${master.clampedUnsupportedMarkerTiles} unsupported marker GIDs clamped, ` +
    `${master.preservedMarkerTiles} marker tiles preserved`,
);

// Prepare the final-map and master/chunk documents for the runtime prototype.
// The source bundle references an unavailable particle tileset. The current
// playable scope does not render particle GIDs, so those GIDs become empty.
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

function sanitizeDocument(document, label) {
  const result = JSON.parse(JSON.stringify(document));
  let removedTilesets = 0;
  if (Array.isArray(result.tilesets)) {
    const before = result.tilesets.length;
    result.tilesets = result.tilesets.filter((tileset) => !tileset.source);
    removedTilesets = before - result.tilesets.length;
  }

  let clamped = 0;
  for (const layer of result.layers ?? []) {
    if (!Array.isArray(layer.data)) continue;
    for (let index = 0; index < layer.data.length; index += 1) {
      if (layer.data[index] >= EXTERNAL_FIRSTGID) {
        layer.data[index] = 0;
        clamped += 1;
      }
    }
  }

  return { result, removedTilesets, clamped, label };
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
    `${output.label}: clamped ${output.clamped} particle GIDs`,
  );
}

console.log(
  `${final.label}: tilesets ${final.removedTilesets} removed, ` +
    `${final.clamped} particle GIDs clamped`,
);
console.log(
  `${master.label}: tilesets ${master.removedTilesets} removed, ` +
    `${master.clamped} particle GIDs clamped`,
);

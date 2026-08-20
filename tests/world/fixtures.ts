import { parseChunkMaster } from "../../src/chunk/index.js";
import { LAYER_STRATEGIES } from "../../src/layer/index.js";
import { worldSpecFromMaster } from "../../src/world/index.js";
import type {
  ChunkLayer,
  ValidatedChunk,
  WorldSpec,
} from "../../src/world/index.js";

export function makeMaster(): ReturnType<typeof parseChunkMaster> {
  return parseChunkMaster({
    chunkWidth: 28,
    chunkHeight: 28,
    nbChunksHorizontal: 5,
    nbChunksVertical: 5,
    originalWidth: 140,
    originalHeight: 140,
    tilesets: [{ name: "exterior", tilewidth: 16, tileheight: 16 }],
  });
}

export function makeSpec(): WorldSpec {
  return worldSpecFromMaster(makeMaster());
}

export function zeroData(length: number): number[] {
  return Array.from({ length }, () => 0);
}

export function makeChunkLayers(): ChunkLayer[] {
  return LAYER_STRATEGIES.map((strategy) => ({
    name: strategy.name,
    data: zeroData(28 * 28),
  }));
}

export function makeChunk(x = 0, y = 0): ValidatedChunk {
  return { coordinate: { x, y }, layers: makeChunkLayers() };
}

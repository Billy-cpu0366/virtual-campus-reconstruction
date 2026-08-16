import type { ChunkMaster } from "../chunk/contract.js";
import { WorldSpecError, type WorldSpec } from "./contract.js";

// 从 SYS-CHUNK 已验证的 master 派生世界规格（SSOT：chunk 尺寸/网格数归 master）。
export function worldSpecFromMaster(master: ChunkMaster): WorldSpec {
  return Object.freeze({
    chunkWidthTiles: master.chunkWidth,
    chunkHeightTiles: master.chunkHeight,
    chunksHorizontal: master.nbChunksHorizontal,
    chunksVertical: master.nbChunksVertical,
    worldWidthTiles: master.originalWidth,
    worldHeightTiles: master.originalHeight,
    tileWidthPixels: master.tileWidth,
    tileHeightPixels: master.tileHeight,
    worldPixelWidth: master.originalWidth * master.tileWidth,
    worldPixelHeight: master.originalHeight * master.tileHeight,
  });
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new WorldSpecError(`${field} 必须是正整数`);
  }
  return value;
}

// 校验规格自洽：世界尺寸 = chunk × 网格，像素 = tile 尺寸 × tile 数。返回冻结副本。
export function validateWorldSpec(spec: WorldSpec): WorldSpec {
  const chunkWidthTiles = positiveInteger(spec.chunkWidthTiles, "chunkWidthTiles");
  const chunkHeightTiles = positiveInteger(spec.chunkHeightTiles, "chunkHeightTiles");
  const chunksHorizontal = positiveInteger(spec.chunksHorizontal, "chunksHorizontal");
  const chunksVertical = positiveInteger(spec.chunksVertical, "chunksVertical");
  const worldWidthTiles = positiveInteger(spec.worldWidthTiles, "worldWidthTiles");
  const worldHeightTiles = positiveInteger(spec.worldHeightTiles, "worldHeightTiles");
  const tileWidthPixels = positiveInteger(spec.tileWidthPixels, "tileWidthPixels");
  const tileHeightPixels = positiveInteger(spec.tileHeightPixels, "tileHeightPixels");

  if (worldWidthTiles !== chunkWidthTiles * chunksHorizontal) {
    throw new WorldSpecError(
      "worldWidthTiles 必须等于 chunkWidthTiles × chunksHorizontal",
    );
  }
  if (worldHeightTiles !== chunkHeightTiles * chunksVertical) {
    throw new WorldSpecError(
      "worldHeightTiles 必须等于 chunkHeightTiles × chunksVertical",
    );
  }
  if (spec.worldPixelWidth !== worldWidthTiles * tileWidthPixels) {
    throw new WorldSpecError(
      "worldPixelWidth 必须等于 worldWidthTiles × tileWidthPixels",
    );
  }
  if (spec.worldPixelHeight !== worldHeightTiles * tileHeightPixels) {
    throw new WorldSpecError(
      "worldPixelHeight 必须等于 worldHeightTiles × tileHeightPixels",
    );
  }

  return Object.freeze({
    chunkWidthTiles,
    chunkHeightTiles,
    chunksHorizontal,
    chunksVertical,
    worldWidthTiles,
    worldHeightTiles,
    tileWidthPixels,
    tileHeightPixels,
    worldPixelWidth: worldWidthTiles * tileWidthPixels,
    worldPixelHeight: worldHeightTiles * tileHeightPixels,
  });
}

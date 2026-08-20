import type { ChunkCoordinate } from "../chunk/coordinates.js";
import type { LayerStrategy } from "../layer/contract.js";
import {
  WorldChunkError,
  type ValidatedChunk,
  type WorldSpec,
} from "./contract.js";

// 校验 chunk 坐标：整数且在世界网格内。
export function validateCoordinate(
  coordinate: ChunkCoordinate,
  spec: WorldSpec,
): void {
  if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.y)) {
    throw new WorldChunkError("chunk 坐标必须是整数");
  }
  if (
    coordinate.x < 0 ||
    coordinate.y < 0 ||
    coordinate.x >= spec.chunksHorizontal ||
    coordinate.y >= spec.chunksVertical
  ) {
    throw new WorldChunkError("chunk 坐标超出网格");
  }
}

// 校验 chunk 结构：坐标、层数（与图层计划一致）、层名顺序、每层 data 长度 = chunk tile 数。
// 通过后返回冻结副本；不通过抛 WorldChunkError。24 层语义的唯一来源是 SYS-LAYER 图层计划。
export function validateChunk(
  chunk: ValidatedChunk,
  spec: WorldSpec,
  layerPlan: readonly LayerStrategy[],
): ValidatedChunk {
  validateCoordinate(chunk.coordinate, spec);

  if (chunk.layers.length !== layerPlan.length) {
    throw new WorldChunkError(
      `chunk 层数必须为 ${layerPlan.length}（实际 ${chunk.layers.length}）`,
    );
  }

  const tilesPerLayer = spec.chunkWidthTiles * spec.chunkHeightTiles;
  const layers = chunk.layers.map((layer, index) => {
    const expectedName = layerPlan[index]?.name;
    if (layer.name !== expectedName) {
      throw new WorldChunkError(
        `第 ${index} 层名应为 ${expectedName}（实际 ${layer.name}）`,
      );
    }
    if (layer.data.length !== tilesPerLayer) {
      throw new WorldChunkError(
        `层 ${layer.name} data 长度应为 ${tilesPerLayer}（实际 ${layer.data.length}）`,
      );
    }
    return Object.freeze({
      name: layer.name,
      data: Object.freeze([...layer.data]),
    });
  });

  return Object.freeze({
    coordinate: Object.freeze({ x: chunk.coordinate.x, y: chunk.coordinate.y }),
    layers: Object.freeze(layers),
  });
}

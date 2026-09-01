import { describe, expect, it } from "vitest";

import {
  chunkFileUrl,
  chunkMasterUrl,
  independentLayerUrl,
  MAP_BASE_URL,
  mapJsonUrl,
  mapMetadataUrl,
  tilesetImageUrl,
} from "../../src/asset/index.js";
import type { ChunkGeometry } from "../../src/chunk/index.js";

const geometry: ChunkGeometry = {
  chunkWidthTiles: 28,
  chunkHeightTiles: 28,
  chunksHorizontal: 5,
  chunksVertical: 5,
  tileWidthPixels: 16,
  tileHeightPixels: 16,
};

describe("SYS-ASSET 资源 URL 约定", () => {
  it("地图 JSON 与元数据 URL", () => {
    expect(mapJsonUrl()).toBe("/assets/maps/final_map.json");
    expect(mapMetadataUrl()).toBe("/assets/maps/final_map_small.json");
  });

  it("分块 master 与 chunk 文件 URL", () => {
    expect(chunkMasterUrl()).toBe("/assets/maps/chunks/master.json");
    expect(chunkFileUrl({ x: 0, y: 0 }, geometry)).toBe(
      "/assets/maps/chunks/chunk0.json",
    );
    expect(chunkFileUrl({ x: 4, y: 4 }, geometry)).toBe(
      "/assets/maps/chunks/chunk24.json",
    );
    expect(chunkFileUrl({ x: 2, y: 1 }, geometry)).toBe(
      "/assets/maps/chunks/chunk7.json",
    );
  });

  it("切块瓦片图片 URL", () => {
    expect(tilesetImageUrl("exterior-small-2.webp")).toBe(
      "/assets/maps/exterior-small-2.webp",
    );
  });

  it("独立图层 URL", () => {
    expect(independentLayerUrl("walls-layer.json")).toBe(
      "/assets/maps/walls-layer.json",
    );
    expect(independentLayerUrl("footsteps-layer.json")).toBe(
      "/assets/maps/footsteps-layer.json",
    );
    expect(independentLayerUrl("particle-trajectories.json")).toBe(
      "/assets/maps/particle-trajectories.json",
    );
  });

  it("根路径常量", () => {
    expect(MAP_BASE_URL).toBe("/assets/maps");
  });
});

import { describe, expect, it } from "vitest";

import {
  discoverOptimizedTilesets,
  MAP_METADATA_KEY,
  MAP_ORIGINAL_KEY,
  TILESET_BASE_KEY,
  type TilesetEntry,
} from "../../src/asset/index.js";

describe("SYS-ASSET 加载 key 约定", () => {
  it("固定 key 常量", () => {
    expect(MAP_METADATA_KEY).toBe("final-map-small");
    expect(MAP_ORIGINAL_KEY).toBe("final-map-original");
    expect(TILESET_BASE_KEY).toBe("exterior");
  });
});

describe("discoverOptimizedTilesets", () => {
  it("空列表返回空", () => {
    expect(discoverOptimizedTilesets([])).toEqual([]);
  });

  it("没有 exterior-small 的瓦片集不发现", () => {
    const tilesets: TilesetEntry[] = [
      { name: "exterior-final", image: "exterior-final.webp" },
      { name: "collisions", image: "collisions.png" },
    ];
    expect(discoverOptimizedTilesets(tilesets)).toEqual([]);
  });

  it("基础项 exterior-small 自身被排除", () => {
    const tilesets: TilesetEntry[] = [
      { name: "exterior-small", image: "exterior-small.webp" },
    ];
    expect(discoverOptimizedTilesets(tilesets)).toEqual([]);
  });

  it("单个切块按后缀构造 key 与 URL", () => {
    const tilesets: TilesetEntry[] = [
      { name: "exterior-small-2", image: "exterior-small-2.webp" },
    ];
    expect(discoverOptimizedTilesets(tilesets)).toEqual([
      { key: "exterior-2", url: "/assets/maps/exterior-small-2.webp" },
    ]);
  });

  it("完整切块集：基础项 + 2..16 + final，只发现 15 个切块", () => {
    const tilesets: TilesetEntry[] = [
      { name: "exterior-small", image: "exterior-small.webp" },
      ...Array.from({ length: 15 }, (_, i) => ({
        name: `exterior-small-${i + 2}`,
        image: `exterior-small-${i + 2}.webp`,
      })),
      { name: "exterior-final", image: "exterior-final.webp" },
    ];
    const discovered = discoverOptimizedTilesets(tilesets);
    expect(discovered).toHaveLength(15);
    expect(discovered[0]).toEqual({
      key: "exterior-2",
      url: "/assets/maps/exterior-small-2.webp",
    });
    expect(discovered[14]).toEqual({
      key: "exterior-16",
      url: "/assets/maps/exterior-small-16.webp",
    });
  });
});

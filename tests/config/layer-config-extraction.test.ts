import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadLayerConfigs } from "../../config/骨架/02-玩法线/SYS-LAYER/逻辑/index.js";

describe("SYS-LAYER 配置接线", () => {
  it("默认图层策略、深度、GID、桥区和屋顶区来自配置", async () => {
    const layer = await loadLayerConfigs(createDiskConfigSource());
    expect(layer.strategies).toHaveLength(24);
    expect(layer.strategiesByName.layer1?.depth).toBe(100);
    expect(layer.strategiesByName.particles?.rawGids).toEqual([
      69355, 69356, 69357, 69358, 69359,
    ]);
    expect(layer.bridges.bridge1).toEqual({
      up: "bridge1_up_wall",
      down: "bridge1_down_wall",
    });
    expect(layer.roofLayers).toEqual([
      "roof_concert", "roof_concert2", "roof_factory", "roof_factory2",
    ]);
    expect(layer.playerDepth).toEqual({ base: 500, yOffset: 24, ratio: 0.1 });
    expect(layer.collisionGidForced).toBe(69345);
    expect(layer.bridgeZones.bridge1.entry[0]).toEqual({
      minX: 89, maxX: 90, minY: 56, maxY: 67,
    });
    expect(layer.roofZones.factory).toEqual({
      left: 112, right: 640, top: 736, bottom: 1152,
    });
  });

  it("set1 的 layer1 深度采用该套配置值", async () => {
    const layer = await loadLayerConfigs(createDiskConfigSource("config/set1"));
    expect(layer.strategiesByName.layer1?.depth).toBe(120);
  });
});

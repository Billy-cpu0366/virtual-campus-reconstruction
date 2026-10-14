import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadWorldConfigs } from "../../config/骨架/01-地图线/SYS-WORLD/逻辑/index.js";

describe("SYS-WORLD 配置接线", () => {
  it("原版入场、巡检与图层参数来自配置", async () => {
    const world = await loadWorldConfigs(createDiskConfigSource());
    expect(world.entryCameraStart).toEqual({ x: 944, y: 928 });
    expect(world.entryCorridorSamples).toBe(6);
    expect(world.bridgeCheckFrames).toBe(3);
    expect(world.clearLayersPerFrame).toBe(4);
    expect(world.cameraTestTour).toEqual({ duration: 200, stayDuration: 100, returnDuration: 200 });
    expect(world.tileQuery.layer).toBe("walls");
  });
  it("set1 的入场相机起点更靠东", async () => {
    const world = await loadWorldConfigs(createDiskConfigSource("config/set1"));
    expect(world.entryCameraStart.x).toBe(1000);
  });
});

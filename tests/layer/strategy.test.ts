import { describe, expect, it } from "vitest";

import {
  activeBridgeWallLayer,
  BRIDGES,
  layerNames,
  layerRole,
  layerStrategy,
  LAYER_STRATEGIES,
  ROOF_LAYERS,
} from "../../src/layer/index.js";

describe("SYS-LAYER 24 层策略表", () => {
  it("恰好 24 层，顺序与 chunk JSON 一致", () => {
    expect(layerNames()).toEqual([
      "layer1", "layer2", "layer3", "layer4", "layer5",
      "layer6", "layer7", "layer8", "layer9", "layer10",
      "cars",
      "roof_concert", "roof_concert2", "roof_factory", "roof_factory2",
      "bridge1_up_wall", "bridge1_down_wall",
      "bridge2_up_wall", "bridge2_down_wall",
      "walls",
      "particles", "particles2", "particles3",
      "footsteps",
    ]);
  });

  it("层名不重复", () => {
    const names = layerNames();
    expect(new Set(names).size).toBe(names.length);
  });

  it("关键层角色正确", () => {
    expect(layerRole("layer1")).toBe("visual");
    expect(layerRole("layer6")).toBe("visual");
    expect(layerRole("walls")).toBe("collision");
    expect(layerRole("cars")).toBe("marker");
    expect(layerRole("roof_concert")).toBe("dynamic-visual");
    expect(layerRole("bridge1_up_wall")).toBe("dynamic-collision");
    expect(layerRole("particles3")).toBe("marker");
    expect(layerRole("footsteps")).toBe("marker");
  });

  it("关键层 depth 正确", () => {
    expect(layerStrategy("layer1").depth).toBe(100);
    expect(layerStrategy("layer5").depth).toBe(500);
    expect(layerStrategy("layer6").depth).toBe(1500);
    expect(layerStrategy("layer10").depth).toBe(1900);
    expect(layerStrategy("walls").depth).toBe(550);
    expect(layerStrategy("cars").depth).toBe(550);
    expect(layerStrategy("bridge1_up_wall").depth).toBe(3500);
    expect(layerStrategy("roof_concert").depth).toBe(3000);
    expect(layerStrategy("roof_factory2").depth).toBe(3300);
    expect(layerStrategy("particles").depth).toBeUndefined();
    expect(layerStrategy("footsteps").depth).toBeUndefined();
  });

  it("未知图层抛错", () => {
    expect(() => layerStrategy("nope")).toThrow();
  });
});

describe("桥上下墙层", () => {
  it("按状态取活动墙层", () => {
    expect(activeBridgeWallLayer(BRIDGES.bridge1, "up")).toBe(
      "bridge1_up_wall",
    );
    expect(activeBridgeWallLayer(BRIDGES.bridge1, "down")).toBe(
      "bridge1_down_wall",
    );
    expect(activeBridgeWallLayer(BRIDGES.bridge2, "up")).toBe(
      "bridge2_up_wall",
    );
    expect(activeBridgeWallLayer(BRIDGES.bridge2, "down")).toBe(
      "bridge2_down_wall",
    );
  });

  it("4 个 roof 层名齐全", () => {
    expect(ROOF_LAYERS).toEqual([
      "roof_concert",
      "roof_concert2",
      "roof_factory",
      "roof_factory2",
    ]);
  });

  it("桥墙层与 roof 层各 4 个，角色正确", () => {
    const bridges = LAYER_STRATEGIES.filter(
      (s) => s.role === "dynamic-collision",
    );
    expect(bridges).toHaveLength(4);
    const roofs = LAYER_STRATEGIES.filter((s) => s.role === "dynamic-visual");
    expect(roofs).toHaveLength(4);
  });
});

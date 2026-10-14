import { describe, expect, it } from "vitest";

import {
  activeBridgeWallLayer,
  layerNames,
  layerRole,
  layerStrategy,
  isKnownRawVisualGid,
  rawVisualGids,
} from "../../src/layer/index.js";
import { LAYER_CONFIGS } from "../config/layer-config-fixture.js";

const { strategies: LAYER_STRATEGIES, strategiesByName, bridges: BRIDGES } = LAYER_CONFIGS;

describe("SYS-LAYER 24 层策略表", () => {
  it("恰好 24 层，顺序与 chunk JSON 一致", () => {
    expect(layerNames(LAYER_STRATEGIES)).toEqual([
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
    const names = layerNames(LAYER_STRATEGIES);
    expect(new Set(names).size).toBe(names.length);
  });

  it("关键层角色正确", () => {
    expect(layerRole("layer1", strategiesByName)).toBe("visual");
    expect(layerRole("layer6", strategiesByName)).toBe("visual");
    expect(layerRole("walls", strategiesByName)).toBe("collision");
    expect(layerRole("cars", strategiesByName)).toBe("marker");
    expect(layerRole("roof_concert", strategiesByName)).toBe("dynamic-visual");
    expect(layerRole("bridge1_up_wall", strategiesByName)).toBe("dynamic-collision");
    expect(layerRole("particles", strategiesByName)).toBe("visual");
    expect(layerRole("particles2", strategiesByName)).toBe("visual");
    expect(layerRole("particles3", strategiesByName)).toBe("marker");
    expect(layerRole("footsteps", strategiesByName)).toBe("marker");
  });

  it("关键层 depth 正确", () => {
    expect(layerStrategy("layer1", strategiesByName).depth).toBe(100);
    expect(layerStrategy("layer5", strategiesByName).depth).toBe(500);
    expect(layerStrategy("layer6", strategiesByName).depth).toBe(1500);
    expect(layerStrategy("layer10", strategiesByName).depth).toBe(1900);
    expect(layerStrategy("walls", strategiesByName).depth).toBe(550);
    expect(layerStrategy("cars", strategiesByName).depth).toBe(550);
    expect(layerStrategy("bridge1_up_wall", strategiesByName).depth).toBe(3500);
    expect(layerStrategy("roof_concert", strategiesByName).depth).toBe(3000);
    expect(layerStrategy("roof_factory2", strategiesByName).depth).toBe(3300);
    expect(layerStrategy("particles", strategiesByName).depth).toBe(0);
    expect(layerStrategy("particles2", strategiesByName).depth).toBe(0);
    expect(layerStrategy("particles", strategiesByName).rawGids).toEqual([
      69355, 69356, 69357, 69358, 69359,
    ]);
    expect(layerStrategy("particles3", strategiesByName).depth).toBeUndefined();
    expect(layerStrategy("footsteps", strategiesByName).depth).toBeUndefined();
  });

  it("raw particle visual 只允许公开的五个 GID", () => {
    expect(rawVisualGids("particles", strategiesByName)).toEqual([
      69355, 69356, 69357, 69358, 69359,
    ]);
    expect(rawVisualGids("particles2", strategiesByName)).toEqual(rawVisualGids("particles", strategiesByName));
    expect(isKnownRawVisualGid("particles", 69359, strategiesByName)).toBe(true);
    expect(isKnownRawVisualGid("particles2", 69355, strategiesByName)).toBe(true);
    expect(isKnownRawVisualGid("particles", 69360, strategiesByName)).toBe(false);
    expect(isKnownRawVisualGid("particles3", 69361, strategiesByName)).toBe(false);
  });

  it("未知图层抛错", () => {
    expect(() => layerStrategy("nope", strategiesByName)).toThrow();
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
    expect(LAYER_CONFIGS.roofLayers).toEqual([
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

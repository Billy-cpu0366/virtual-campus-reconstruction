import { describe, expect, it } from "vitest";

import {
  isForcedCollision,
  isForcedNonCollision,
  playerDepth,
  roofAlpha,
  wallsDepth,
} from "../../src/layer/index.js";
import { LAYER_CONFIGS } from "../config/layer-config-fixture.js";

describe("玩家深度公式", () => {
  it("500 + (y + 24) * 0.1", () => {
    const { base, yOffset, ratio } = LAYER_CONFIGS.playerDepth;
    expect(playerDepth(0, base, yOffset, ratio)).toBeCloseTo(502.4);
    expect(playerDepth(304, base, yOffset, ratio)).toBeCloseTo(532.8);
    expect(playerDepth(2000, base, yOffset, ratio)).toBeCloseTo(702.4);
  });
});

describe("关键数值常量", () => {
  it("桥玩家深度 / 屋顶时长 / 脚印深度 / 墙诊断深度", () => {
    expect(LAYER_CONFIGS.bridgePlayerDepth).toBe(1650);
    expect(LAYER_CONFIGS.roofFadeMs).toBe(300);
    expect(LAYER_CONFIGS.footstepDepth).toBe(450);
    expect(wallsDepth(LAYER_CONFIGS.strategiesByName)).toBe(550);
  });
});

describe("屋顶淡隐 alpha", () => {
  it("visible=1、faded=0", () => {
    expect(roofAlpha("visible")).toBe(1);
    expect(roofAlpha("faded")).toBe(0);
  });
});

describe("walls 碰撞 GID", () => {
  it("69345 强制碰撞、69346 强制不碰撞", () => {
    expect(LAYER_CONFIGS.collisionGidForced).toBe(69345);
    expect(LAYER_CONFIGS.nonCollisionGidForced).toBe(69346);
    expect(isForcedCollision(69345, LAYER_CONFIGS.collisionGidForced)).toBe(true);
    expect(isForcedCollision(69346, LAYER_CONFIGS.collisionGidForced)).toBe(false);
    expect(isForcedNonCollision(69346, LAYER_CONFIGS.nonCollisionGidForced)).toBe(true);
    expect(isForcedNonCollision(69345, LAYER_CONFIGS.nonCollisionGidForced)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  BRIDGE_PLAYER_DEPTH,
  COLLISION_GID_FORCED,
  FOOTSTEP_DEPTH,
  isForcedCollision,
  isForcedNonCollision,
  NON_COLLISION_GID_FORCED,
  playerDepth,
  roofAlpha,
  ROOF_FADE_MS,
  WALLS_DEPTH,
} from "../../src/layer/index.js";

describe("玩家深度公式", () => {
  it("500 + (y + 24) * 0.1", () => {
    expect(playerDepth(0)).toBeCloseTo(502.4);
    expect(playerDepth(304)).toBeCloseTo(532.8);
    expect(playerDepth(2000)).toBeCloseTo(702.4);
  });
});

describe("关键数值常量", () => {
  it("桥玩家深度 / 屋顶时长 / 脚印深度 / 墙诊断深度", () => {
    expect(BRIDGE_PLAYER_DEPTH).toBe(1650);
    expect(ROOF_FADE_MS).toBe(300);
    expect(FOOTSTEP_DEPTH).toBe(450);
    expect(WALLS_DEPTH).toBe(550);
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
    expect(COLLISION_GID_FORCED).toBe(69345);
    expect(NON_COLLISION_GID_FORCED).toBe(69346);
    expect(isForcedCollision(69345)).toBe(true);
    expect(isForcedCollision(69346)).toBe(false);
    expect(isForcedNonCollision(69346)).toBe(true);
    expect(isForcedNonCollision(69345)).toBe(false);
  });
});

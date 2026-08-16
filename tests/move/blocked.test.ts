import { describe, expect, it } from "vitest";

import { blockedInDirection } from "../../src/move/index.js";
import type { BlockedFlags } from "../../src/move/index.js";

function blocked(partial: Partial<BlockedFlags>): BlockedFlags {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    ...partial,
  };
}

describe("撞墙反馈（方向 → blocked 轴）", () => {
  it("单轴只认对应轴", () => {
    expect(blockedInDirection("north", blocked({ up: true }))).toBe(true);
    expect(blockedInDirection("north", blocked({ up: false }))).toBe(false);
    expect(blockedInDirection("north", blocked({ down: true }))).toBe(false);
    expect(blockedInDirection("south", blocked({ down: true }))).toBe(true);
    expect(blockedInDirection("east", blocked({ right: true }))).toBe(true);
    expect(blockedInDirection("west", blocked({ left: true }))).toBe(true);
  });

  it("对角取两轴与", () => {
    expect(
      blockedInDirection("north-east", blocked({ up: true, right: true })),
    ).toBe(true);
    expect(
      blockedInDirection("north-east", blocked({ up: true, right: false })),
    ).toBe(false);
    expect(
      blockedInDirection("south-west", blocked({ down: true, left: true })),
    ).toBe(true);
    expect(
      blockedInDirection("south-west", blocked({ down: false, left: true })),
    ).toBe(false);
  });
});

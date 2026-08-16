import { describe, expect, it } from "vitest";

import {
  COLLISION_WALL_LAYER_NAMES,
  isWalkable,
} from "../../src/move/index.js";

describe("玩家碰撞墙层清单", () => {
  it("walls + 4 桥墙层共 5 层", () => {
    expect(COLLISION_WALL_LAYER_NAMES).toEqual([
      "walls",
      "bridge1_up_wall",
      "bridge1_down_wall",
      "bridge2_up_wall",
      "bridge2_down_wall",
    ]);
  });
});

describe("walls-layer 网格（NPC 寻路）", () => {
  const grid = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ];

  it("0=可走、1=墙", () => {
    expect(isWalkable(grid, 0, 0)).toBe(true);
    expect(isWalkable(grid, 1, 0)).toBe(false);
    expect(isWalkable(grid, 1, 1)).toBe(true);
    expect(isWalkable(grid, 2, 2)).toBe(false);
  });

  it("越界按不可走处理", () => {
    expect(isWalkable(grid, -1, 0)).toBe(false);
    expect(isWalkable(grid, 0, -1)).toBe(false);
    expect(isWalkable(grid, 3, 0)).toBe(false);
    expect(isWalkable(grid, 0, 3)).toBe(false);
  });
});

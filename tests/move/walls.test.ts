import { describe, expect, it } from "vitest";

import {
  isWalkable,
} from "../../src/move/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadMoveConfigs } from "../../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js";

const move = await loadMoveConfigs(createDiskConfigSource());
const walk = (grid: readonly (readonly number[])[], x: number, y: number) =>
  isWalkable(grid, x, y, move.walkableValue, move.blockedValue, move.outOfBoundsIsWalkable);

describe("玩家碰撞墙层清单", () => {
  it("walls + 4 桥墙层共 5 层", () => {
    expect(move.collisionLayerNames).toEqual([
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
    expect(walk(grid, 0, 0)).toBe(true);
    expect(walk(grid, 1, 0)).toBe(false);
    expect(walk(grid, 1, 1)).toBe(true);
    expect(walk(grid, 2, 2)).toBe(false);
  });

  it("越界按不可走处理", () => {
    expect(walk(grid, -1, 0)).toBe(false);
    expect(walk(grid, 0, -1)).toBe(false);
    expect(walk(grid, 3, 0)).toBe(false);
    expect(walk(grid, 0, 3)).toBe(false);
  });
});

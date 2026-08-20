import { describe, expect, it } from "vitest";

import {
  COLLIDE_WORLD_BOUNDS,
  PLAYER_BODY_HEIGHT,
  PLAYER_BODY_OFFSET_X,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_BODY_WIDTH,
  PLAYER_DRAG,
  PLAYER_MAX_VELOCITY,
} from "../../src/move/index.js";

describe("玩家碰撞体常量", () => {
  it("20×8 贴脚、偏移 (14,36)", () => {
    expect(PLAYER_BODY_WIDTH).toBe(20);
    expect(PLAYER_BODY_HEIGHT).toBe(8);
    expect(PLAYER_BODY_OFFSET_X).toBe(14);
    expect(PLAYER_BODY_OFFSET_Y).toBe(36);
  });

  it("drag / maxVelocity / collideWorldBounds", () => {
    expect(PLAYER_DRAG).toBe(300);
    expect(PLAYER_MAX_VELOCITY).toBe(200);
    expect(COLLIDE_WORLD_BOUNDS).toBe(true);
  });
});

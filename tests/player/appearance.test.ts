import { describe, expect, it } from "vitest";
import { PLAYER_CONFIGS } from "../config/player-config-fixture.js";
import { walkFrameRange, walkFrameStart } from "../../src/player/index.js";

describe("玩家外观配置", () => {
  it("出生点、尺寸、精灵表和动画参数来自配置", () => {
    expect(PLAYER_CONFIGS.spawn).toEqual({ x: 1088, y: 304 });
    expect(PLAYER_CONFIGS.texture).toBe("player");
    expect(PLAYER_CONFIGS.displaySize).toBe(48);
    expect(PLAYER_CONFIGS.spritesheet.frames).toBe(64);
    expect(PLAYER_CONFIGS.animation.walkFramesPerDirection).toBe(8);
    expect(PLAYER_CONFIGS.animation.frameRate).toBe(10);
    expect(PLAYER_CONFIGS.idleFrame).toBe(48);
  });
});

describe("8 方向帧映射", () => {
  it("按配置读取帧起始", () => {
    expect(walkFrameStart("east", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(0);
    expect(walkFrameStart("north-east", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(8);
    expect(walkFrameStart("north-west", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(16);
    expect(walkFrameStart("north", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(24);
    expect(walkFrameStart("south-east", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(32);
    expect(walkFrameStart("south-west", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(40);
    expect(walkFrameStart("south", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(48);
    expect(walkFrameStart("west", PLAYER_CONFIGS.animation.walkFrameStart)).toBe(56);
  });

  it("帧区间由配置起始帧和每方向帧数推导", () => {
    const { walkFrameStart: starts, walkFramesPerDirection: count } = PLAYER_CONFIGS.animation;
    expect(walkFrameRange("east", starts, count)).toEqual({ start: 0, end: 7 });
    expect(walkFrameRange("north", starts, count)).toEqual({ start: 24, end: 31 });
    expect(walkFrameRange("south", starts, count)).toEqual({ start: 48, end: 55 });
    expect(walkFrameRange("west", starts, count)).toEqual({ start: 56, end: 63 });
  });
});

import { describe, expect, it } from "vitest";

import {
  ANIMATION_FRAME_RATE,
  DISPLAY_SIZE,
  IDLE_FRAME,
  SPAWN_X,
  SPAWN_Y,
  SPRITESHEET_FRAMES,
  TEXTURE_PLAYER,
  WALK_FRAMES_PER_DIRECTION,
  walkFrameRange,
  walkFrameStart,
} from "../../src/player/index.js";

describe("出生点与外观常量", () => {
  it("出生点 (1088, 304)", () => {
    expect(SPAWN_X).toBe(1088);
    expect(SPAWN_Y).toBe(304);
  });

  it("外观 48×48、64 帧、frameRate 10、idle 帧 48", () => {
    expect(TEXTURE_PLAYER).toBe("player");
    expect(DISPLAY_SIZE).toBe(48);
    expect(SPRITESHEET_FRAMES).toBe(64);
    expect(WALK_FRAMES_PER_DIRECTION).toBe(8);
    expect(ANIMATION_FRAME_RATE).toBe(10);
    expect(IDLE_FRAME).toBe(48);
  });
});

describe("8 方向帧映射", () => {
  it("帧起始", () => {
    expect(walkFrameStart("east")).toBe(0);
    expect(walkFrameStart("north-east")).toBe(8);
    expect(walkFrameStart("north-west")).toBe(16);
    expect(walkFrameStart("north")).toBe(24);
    expect(walkFrameStart("south-east")).toBe(32);
    expect(walkFrameStart("south-west")).toBe(40);
    expect(walkFrameStart("south")).toBe(48);
    expect(walkFrameStart("west")).toBe(56);
  });

  it("帧区间（含首尾）", () => {
    expect(walkFrameRange("east")).toEqual({ start: 0, end: 7 });
    expect(walkFrameRange("north")).toEqual({ start: 24, end: 31 });
    expect(walkFrameRange("south")).toEqual({ start: 48, end: 55 });
    expect(walkFrameRange("west")).toEqual({ start: 56, end: 63 });
  });
});

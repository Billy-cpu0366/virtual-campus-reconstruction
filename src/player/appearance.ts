import type { Direction } from "../input/index.js";

// 出生点。
export const SPAWN_X = 1088;
export const SPAWN_Y = 304;

// 外观。
export const TEXTURE_PLAYER = "player";
export const DISPLAY_SIZE = 48;
export const SPRITESHEET_FRAMES = 64;
export const WALK_FRAMES_PER_DIRECTION = 8;
export const ANIMATION_FRAME_RATE = 10;
export const IDLE_FRAME = 48; // south 首帧

// 8 方向帧区间。
const WALK_FRAME_START: Record<Direction, number> = {
  east: 0,
  "north-east": 8,
  "north-west": 16,
  north: 24,
  "south-east": 32,
  "south-west": 40,
  south: 48,
  west: 56,
};

export function walkFrameStart(direction: Direction): number {
  const start = WALK_FRAME_START[direction];
  if (start === undefined) {
    throw new Error(`未知方向：${direction}`);
  }
  return start;
}

export function walkFrameRange(
  direction: Direction,
): { start: number; end: number } {
  const start = walkFrameStart(direction);
  return { start, end: start + WALK_FRAMES_PER_DIRECTION - 1 };
}

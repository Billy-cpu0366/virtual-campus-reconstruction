import type { Direction } from "../input/index.js";

export function walkFrameStart(
  direction: Direction,
  starts: Readonly<Record<Direction, number>>,
): number {
  const start = starts[direction];
  if (start === undefined) {
    throw new Error(`未知方向：${direction}`);
  }
  return start;
}

export function walkFrameRange(
  direction: Direction,
  starts: Readonly<Record<Direction, number>>,
  framesPerDirection: number,
): { start: number; end: number } {
  const start = walkFrameStart(direction, starts);
  return { start, end: start + framesPerDirection - 1 };
}

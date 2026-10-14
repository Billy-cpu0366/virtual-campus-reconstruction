import type { Direction } from "../input/index.js";

// 朝向 = 最后请求方向；没有请求时使用传入的默认朝向。
export function facingDirection(
  lastRequested: Direction | undefined,
  defaultFacing: Direction,
): Direction {
  return lastRequested ?? defaultFacing;
}

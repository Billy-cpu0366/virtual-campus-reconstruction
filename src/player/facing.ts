import type { Direction } from "../input/index.js";

// 默认朝南（FACT）。
export const DEFAULT_FACING: Direction = "south";

// 朝向 = 最后请求方向，无则默认朝南（FACT：lastRequestedDirection || "south"）。
export function facingDirection(
  lastRequested: Direction | undefined,
): Direction {
  return lastRequested ?? DEFAULT_FACING;
}

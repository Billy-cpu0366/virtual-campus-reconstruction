import type { Direction } from "../input/index.js";
import { directionVector, speedForDirection } from "../input/index.js";
import type { Velocity } from "./contract.js";

// 方向 → 速度。
export function velocityForDirection(
  direction: Direction,
  vectors: Parameters<typeof directionVector>[1],
  speeds: { readonly walk: number; readonly diagonal: number },
): Velocity {
  const { dx, dy } = directionVector(direction, vectors);
  const speed = speedForDirection(direction, vectors, speeds);
  return { vx: dx * speed, vy: dy * speed };
}

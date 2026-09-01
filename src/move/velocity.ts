import type { Direction } from "../input/index.js";
import { directionVector, speedForDirection } from "../input/index.js";
import type { Velocity } from "./contract.js";

// 方向 → 速度。
export function velocityForDirection(direction: Direction): Velocity {
  const { dx, dy } = directionVector(direction);
  const speed = speedForDirection(direction);
  return { vx: dx * speed, vy: dy * speed };
}

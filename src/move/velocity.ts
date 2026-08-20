import type { Direction } from "../input/index.js";
import { directionVector, speedForDirection } from "../input/index.js";
import type { Velocity } from "./contract.js";

// 方向 → 速度（FACT：单轴 150、对角 106；方向向量与速度由 SYS-INPUT 唯一提供，此处只组合）。
export function velocityForDirection(direction: Direction): Velocity {
  const { dx, dy } = directionVector(direction);
  const speed = speedForDirection(direction);
  return { vx: dx * speed, vy: dy * speed };
}

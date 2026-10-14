import type { Direction, DirectionVector } from "./contract.js";

// 8 方向向量由调用方递进来（Phaser 坐标 y 向下，故 south = +y）。
export function directionVector(
  direction: Direction,
  vectors: Readonly<Record<Direction, DirectionVector>>,
): DirectionVector {
  const vector = vectors[direction];
  if (vector === undefined) {
    throw new Error(`未知方向：${direction}`);
  }
  return { dx: vector.dx, dy: vector.dy };
}

export function directionFromVector(
  dx: number, dy: number,
  vectors: Readonly<Record<Direction, DirectionVector>>,
): Direction {
  const direction = (Object.entries(vectors) as [Direction, DirectionVector][])
    .find(([, vector]) => vector.dx === dx && vector.dy === dy)?.[0];
  if (direction === undefined) {
    throw new Error(`非法方向向量：(${dx}, ${dy})`);
  }
  return direction;
}

export function isDiagonal(
  direction: Direction,
  vectors: Readonly<Record<Direction, DirectionVector>>,
): boolean {
  const { dx, dy } = directionVector(direction, vectors);
  return dx !== 0 && dy !== 0;
}

export function speedForDirection(
  direction: Direction,
  vectors: Readonly<Record<Direction, DirectionVector>>,
  speed: { readonly walk: number; readonly diagonal: number },
): number {
  return isDiagonal(direction, vectors) ? speed.diagonal : speed.walk;
}

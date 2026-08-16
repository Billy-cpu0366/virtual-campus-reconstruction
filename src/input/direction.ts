import type { Direction, DirectionVector } from "./contract.js";

// 速度（FACT：单轴 150、对角 150×0.707≈106）。
export const SPEED = 150;
export const SPEED_DIAGONAL = 106;

export const DIRECTIONS: readonly Direction[] = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

// 8 方向向量（Phaser 坐标 y 向下，故 south = +y）。
const VECTORS = new Map<Direction, DirectionVector>([
  ["north", { dx: 0, dy: -1 }],
  ["north-east", { dx: 1, dy: -1 }],
  ["east", { dx: 1, dy: 0 }],
  ["south-east", { dx: 1, dy: 1 }],
  ["south", { dx: 0, dy: 1 }],
  ["south-west", { dx: -1, dy: 1 }],
  ["west", { dx: -1, dy: 0 }],
  ["north-west", { dx: -1, dy: -1 }],
]);

export function directionVector(direction: Direction): DirectionVector {
  const vector = VECTORS.get(direction);
  if (vector === undefined) {
    throw new Error(`未知方向：${direction}`);
  }
  return { dx: vector.dx, dy: vector.dy };
}

const BY_VECTOR = new Map<string, Direction>(
  [...VECTORS].map(([d, v]) => [`${v.dx},${v.dy}`, d] as const),
);

export function directionFromVector(dx: number, dy: number): Direction {
  const direction = BY_VECTOR.get(`${dx},${dy}`);
  if (direction === undefined) {
    throw new Error(`非法方向向量：(${dx}, ${dy})`);
  }
  return direction;
}

export function isDiagonal(direction: Direction): boolean {
  const { dx, dy } = directionVector(direction);
  return dx !== 0 && dy !== 0;
}

export function speedForDirection(direction: Direction): number {
  return isDiagonal(direction) ? SPEED_DIAGONAL : SPEED;
}

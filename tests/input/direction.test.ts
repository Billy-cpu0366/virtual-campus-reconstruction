import { describe, expect, it } from "vitest";

import {
  DIRECTIONS,
  directionFromVector,
  directionVector,
  isDiagonal,
  SPEED,
  SPEED_DIAGONAL,
  speedForDirection,
} from "../../src/input/index.js";

describe("8 方向常量", () => {
  it("共 8 个方向，顺序固定", () => {
    expect(DIRECTIONS).toEqual([
      "north",
      "north-east",
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
      "north-west",
    ]);
  });
});

describe("方向 → 向量", () => {
  it("8 方向向量映射", () => {
    expect(directionVector("north")).toEqual({ dx: 0, dy: -1 });
    expect(directionVector("north-east")).toEqual({ dx: 1, dy: -1 });
    expect(directionVector("east")).toEqual({ dx: 1, dy: 0 });
    expect(directionVector("south-east")).toEqual({ dx: 1, dy: 1 });
    expect(directionVector("south")).toEqual({ dx: 0, dy: 1 });
    expect(directionVector("south-west")).toEqual({ dx: -1, dy: 1 });
    expect(directionVector("west")).toEqual({ dx: -1, dy: 0 });
    expect(directionVector("north-west")).toEqual({ dx: -1, dy: -1 });
  });
});

describe("向量 → 方向", () => {
  it("8 向量可往返", () => {
    for (const d of DIRECTIONS) {
      const v = directionVector(d);
      expect(directionFromVector(v.dx, v.dy)).toBe(d);
    }
  });

  it("非法向量抛错", () => {
    expect(() => directionFromVector(0, 0)).toThrow();
    expect(() => directionFromVector(2, 0)).toThrow();
    expect(() => directionFromVector(0, 1.5)).toThrow();
  });
});

describe("对角判定与速度", () => {
  it("对角方向判定", () => {
    expect(isDiagonal("north-east")).toBe(true);
    expect(isDiagonal("south-east")).toBe(true);
    expect(isDiagonal("south-west")).toBe(true);
    expect(isDiagonal("north-west")).toBe(true);
    expect(isDiagonal("north")).toBe(false);
    expect(isDiagonal("east")).toBe(false);
    expect(isDiagonal("south")).toBe(false);
    expect(isDiagonal("west")).toBe(false);
  });

  it("速度 150 单轴 / 106 对角", () => {
    expect(SPEED).toBe(150);
    expect(SPEED_DIAGONAL).toBe(106);
    expect(speedForDirection("north")).toBe(150);
    expect(speedForDirection("north-east")).toBe(106);
    expect(speedForDirection("south-west")).toBe(106);
  });
});

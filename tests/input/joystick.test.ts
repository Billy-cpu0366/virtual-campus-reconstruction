import { describe, expect, it } from "vitest";

import {
  JOYSTICK_FORCE_MIN,
  JOYSTICK_MAIN_AXIS_RATIO,
  JOYSTICK_THRESHOLD_AXIS,
  JOYSTICK_THRESHOLD_DIAGONAL,
  joystickDirection,
  joystickParams,
} from "../../src/input/index.js";

describe("摇杆归一化（主轴判定 1.5）", () => {
  it("原点返回 null", () => {
    expect(joystickDirection(0, 0)).toBeNull();
  });

  it("纯轴 4 方向", () => {
    expect(joystickDirection(10, 0)).toBe("east");
    expect(joystickDirection(-10, 0)).toBe("west");
    expect(joystickDirection(0, -10)).toBe("north");
    expect(joystickDirection(0, 10)).toBe("south");
  });

  it("对角 4 方向", () => {
    expect(joystickDirection(10, -10)).toBe("north-east");
    expect(joystickDirection(10, 10)).toBe("south-east");
    expect(joystickDirection(-10, 10)).toBe("south-west");
    expect(joystickDirection(-10, -10)).toBe("north-west");
  });

  it("主轴比 > 1.5 归为单轴", () => {
    expect(joystickDirection(20, 10)).toBe("east");
    expect(joystickDirection(-20, -10)).toBe("west");
    expect(joystickDirection(10, 20)).toBe("south");
    expect(joystickDirection(10, -20)).toBe("north");
  });

  it("主轴比 ≤ 1.5 归为对角", () => {
    expect(joystickDirection(15, 10)).toBe("south-east");
    expect(joystickDirection(15, -10)).toBe("north-east");
  });
});

describe("摇杆参数与常量", () => {
  it("常量登记", () => {
    expect(JOYSTICK_MAIN_AXIS_RATIO).toBe(1.5);
    expect(JOYSTICK_THRESHOLD_AXIS).toBe(0.3);
    expect(JOYSTICK_THRESHOLD_DIAGONAL).toBe(0.5);
    expect(JOYSTICK_FORCE_MIN).toBe(16);
  });

  it("tablet 档参数", () => {
    expect(joystickParams("tablet")).toEqual({
      radius: 12,
      baseDiameter: 48,
      thumbDiameter: 24,
      fixed: true,
      forceMin: 16,
      position: "right-bottom",
    });
  });

  it("desktop 档参数", () => {
    expect(joystickParams("desktop")).toEqual({
      radius: 15,
      baseDiameter: 60,
      thumbDiameter: 30,
      fixed: true,
      forceMin: 16,
      position: "center-bottom",
    });
  });

  it("mobile 档参数", () => {
    expect(joystickParams("mobile")).toEqual({
      radius: 15,
      baseDiameter: 60,
      thumbDiameter: 30,
      fixed: true,
      forceMin: 16,
      position: "right-bottom",
    });
  });
});

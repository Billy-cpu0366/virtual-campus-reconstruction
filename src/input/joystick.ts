import type { DeviceKind, Direction, JoystickParams } from "./contract.js";
import { directionFromVector } from "./direction.js";

export const JOYSTICK_MAIN_AXIS_RATIO = 1.5;
// 阈值（原站值；作用单位未确认，见 SYS-INPUT 卡 §4）：本 CORE 只登记常量，不在此断言其语义。
export const JOYSTICK_THRESHOLD_AXIS = 0.3;
export const JOYSTICK_THRESHOLD_DIAGONAL = 0.5;
export const JOYSTICK_FORCE_MIN = 16;

// 摇杆归一化。
// forceX/forceY 为手指相对摇杆中心的像素偏移；原点返回 null。
export function joystickDirection(
  forceX: number,
  forceY: number,
): Direction | null {
  const ax = Math.abs(forceX);
  const ay = Math.abs(forceY);
  if (ax === 0 && ay === 0) return null;

  let dx: number;
  let dy: number;
  if (ay === 0 || ax / ay > JOYSTICK_MAIN_AXIS_RATIO) {
    dx = Math.sign(forceX);
    dy = 0;
  } else if (ax === 0 || ay / ax > JOYSTICK_MAIN_AXIS_RATIO) {
    dx = 0;
    dy = Math.sign(forceY);
  } else {
    dx = Math.sign(forceX);
    dy = Math.sign(forceY);
  }
  return directionFromVector(dx, dy);
}

// 摇杆参数。
export function joystickParams(device: DeviceKind): JoystickParams {
  if (device === "tablet") {
    return {
      radius: 12,
      baseDiameter: 48,
      thumbDiameter: 24,
      fixed: true,
      forceMin: JOYSTICK_FORCE_MIN,
      position: "right-bottom",
    };
  }
  return {
    radius: 15,
    baseDiameter: 60,
    thumbDiameter: 30,
    fixed: true,
    forceMin: JOYSTICK_FORCE_MIN,
    position: device === "desktop" ? "center-bottom" : "right-bottom",
  };
}

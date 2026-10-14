import type { DeviceKind, Direction, JoystickParams } from "./contract.js";
import { directionFromVector } from "./direction.js";

// 阈值（原站值；作用单位未确认，见 SYS-INPUT 卡 §4）：本 CORE 只登记常量，不在此断言其语义。
export const JOYSTICK_THRESHOLD_AXIS = 0.3;
export const JOYSTICK_THRESHOLD_DIAGONAL = 0.5;

// 摇杆归一化。
// forceX/forceY 为手指相对摇杆中心的像素偏移；原点返回 null。
export function joystickDirection(
  forceX: number,
  forceY: number,
  mainAxisRatio: number,
  vectors: Readonly<Record<Direction, { readonly dx: number; readonly dy: number }>>,
): Direction | null {
  const ax = Math.abs(forceX);
  const ay = Math.abs(forceY);
  if (ax === 0 && ay === 0) return null;

  let dx: number;
  let dy: number;
  if (ay === 0 || ax / ay > mainAxisRatio) {
    dx = Math.sign(forceX);
    dy = 0;
  } else if (ax === 0 || ay / ax > mainAxisRatio) {
    dx = 0;
    dy = Math.sign(forceY);
  } else {
    dx = Math.sign(forceX);
    dy = Math.sign(forceY);
  }
  return directionFromVector(dx, dy, vectors);
}

// 摇杆参数。
export function joystickParams(
  device: DeviceKind,
  devices: Readonly<Record<DeviceKind, Pick<JoystickParams,
    "radius" | "baseDiameter" | "thumbDiameter" | "position">>>,
  forceMin: number,
): JoystickParams {
  return {
    ...devices[device],
    fixed: true,
    forceMin,
  };
}

import type { Direction } from "./contract.js";

// 输入优先级（FACT：摇杆激活时键盘让位，摇杆回中恢复键盘）。
export function resolveMovement(
  keyboard: Direction | null,
  joystick: Direction | null,
  joystickActive: boolean,
): Direction | null {
  return joystickActive ? joystick : keyboard;
}

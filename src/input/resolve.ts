import type { Direction } from "./contract.js";

// 输入优先级。
export function resolveMovement(
  keyboard: Direction | null,
  joystick: Direction | null,
  joystickActive: boolean,
): Direction | null {
  return joystickActive ? joystick : keyboard;
}

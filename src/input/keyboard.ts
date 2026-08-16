import type { Direction, KeyState } from "./contract.js";

// 键盘归一化（FACT：8 方向判定，优先级 上 > 下 > 左 > 右）。
// 对角在上/下分支内先判 left 再判 right；无按键返回 null。
export function keyboardDirection(keys: KeyState): Direction | null {
  const { up, down, left, right } = keys;

  if (up) {
    if (left) return "north-west";
    if (right) return "north-east";
    return "north";
  }
  if (down) {
    if (left) return "south-west";
    if (right) return "south-east";
    return "south";
  }
  if (left) return "west";
  if (right) return "east";
  return null;
}

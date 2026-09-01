import type { Direction } from "../input/index.js";
import type { BlockedFlags } from "./contract.js";

// 撞墙反馈（FACT：方向 → body.blocked 轴映射；north→up、south→down、east→right、west→left，对角取两轴与）。
export function blockedInDirection(
  direction: Direction,
  blocked: BlockedFlags,
): boolean {
  switch (direction) {
    case "north":
      return blocked.up;
    case "south":
      return blocked.down;
    case "west":
      return blocked.left;
    case "east":
      return blocked.right;
    case "north-west":
      return blocked.up && blocked.left;
    case "north-east":
      return blocked.up && blocked.right;
    case "south-west":
      return blocked.down && blocked.left;
    case "south-east":
      return blocked.down && blocked.right;
  }
}

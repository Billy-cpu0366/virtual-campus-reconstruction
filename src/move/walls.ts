import { BRIDGES } from "../layer/index.js";

// 玩家碰撞墙层（FACT：walls + 4 桥墙层，共 5 层）。
// 层名/深度 SSOT 在 SYS-LAYER（LAYER_STRATEGIES / BRIDGES）；本常量只登记「玩家 collide 这 5 层」的关系。
export const COLLISION_WALL_LAYER_NAMES: readonly string[] = [
  "walls",
  BRIDGES.bridge1.up,
  BRIDGES.bridge1.down,
  BRIDGES.bridge2.up,
  BRIDGES.bridge2.down,
];

// walls-layer.json 网格（FACT：0=可走、1=墙，grid[y][x] 行优先，16px 一格）。
// 消费方是 NPC 寻路，不是玩家碰撞。
export const WALKABLE = 0;
export const BLOCKED = 1;

// 这格能走吗（API契约表「移动→地图」接口）；越界按不可走处理（安全默认）。
export function isWalkable(
  grid: readonly (readonly number[])[],
  x: number,
  y: number,
): boolean {
  const row = grid[y];
  return row !== undefined && row[x] === WALKABLE;
}

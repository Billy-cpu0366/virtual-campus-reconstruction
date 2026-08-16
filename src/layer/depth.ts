import type { RoofState } from "./contract.js";
import { layerStrategy } from "./strategy.js";

// 玩家常态 depth（SYS-LAYER 为深度 SSOT）。
// 注：契约表 / SYS-PLAYER 卡写的是 `500 + y*0.1`（差 +24），待对账；本 CORE 以本卡 DECISION 为准。
export function playerDepth(worldY: number): number {
  return 500 + (worldY + 24) * 0.1;
}

export const BRIDGE_PLAYER_DEPTH = 1650;
export const ROOF_FADE_MS = 300;
export const FOOTSTEP_DEPTH = 450;

// walls 层 depth 的 SSOT 在 LAYER_STRATEGIES（SYS-LAYER 图层合同）；此处派生，避免重复硬编码。
const wallsDepth = layerStrategy("walls").depth;
if (wallsDepth === undefined) {
  throw new Error("walls 层必须在 LAYER_STRATEGIES 中定义 depth");
}
export const WALLS_DEPTH = wallsDepth;

// walls 碰撞 GID（FACT：69345 强制碰撞、69346 强制不碰撞）。
export const COLLISION_GID_FORCED = 69345;
export const NON_COLLISION_GID_FORCED = 69346;

export function isForcedCollision(gid: number): boolean {
  return gid === COLLISION_GID_FORCED;
}

export function isForcedNonCollision(gid: number): boolean {
  return gid === NON_COLLISION_GID_FORCED;
}

// 屋顶淡隐/恢复：alpha 1（visible）→ 0（faded）→ 1。
export function roofAlpha(state: RoofState): number {
  return state === "visible" ? 1 : 0;
}

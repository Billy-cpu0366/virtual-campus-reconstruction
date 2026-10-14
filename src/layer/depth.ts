import type { RoofState } from "./contract.js";
import { layerStrategy } from "./strategy.js";
import type { LayerStrategy } from "./contract.js";

// 玩家常态 depth（SYS-LAYER 为深度 SSOT）。
// 注：原站与 SYS-PLAYER 卡记的是 `500 + y*0.1`，本 CORE 用的是 `500 + (y+24)*0.1`。
// 两者是刻意不同的决策口径（本 CORE 以本卡设计决定为准），不是待修的不一致。
export function playerDepth(
  worldY: number,
  base: number,
  yOffset: number,
  ratio: number,
): number {
  return base + (worldY + yOffset) * ratio;
}

// walls 层深度从 SYS-LAYER 的唯一策略表派生，不另存一份。
export function wallsDepth(
  strategiesByName: Readonly<Record<string, LayerStrategy>>,
): number {
  const depth = layerStrategy("walls", strategiesByName).depth;
  if (depth === undefined) {
    throw new Error("walls 层必须在 SYS-LAYER 策略中定义 depth");
  }
  return depth;
}

export function isForcedCollision(
  gid: number,
  collisionGidForced: number,
): boolean {
  return gid === collisionGidForced;
}

export function isForcedNonCollision(
  gid: number,
  nonCollisionGidForced: number,
): boolean {
  return gid === nonCollisionGidForced;
}

// 屋顶淡隐/恢复：alpha 1（visible）→ 0（faded）→ 1。
export function roofAlpha(state: RoofState): number {
  return state === "visible" ? 1 : 0;
}

// 沙滩换装。
//
// 原站（`chunk-WMFY56ZM.js`）玩家踩到 `walls` 层的 GID 69353 时自动脱衣换泳装，
// 离开沙滩再踩回触发块时穿回常服；触发 GID 来自 SYS-PLAYER 配置。
/** 沙滩走路动画 key。帧布局与常服的 `walk-*` 完全一致（同规格 64 帧贴图）。 */
export function beachWalkAnimation(direction: string): string {
  return `beach-walk-${direction}`;
}

// 被抓素材没有运行时消费者，保留原记录等待 SYS-ASSET 盘点。
export const HOLDING_TEXTURE = "player-holding";
export const HOLDING_DISPLAY_SIZE = 64;

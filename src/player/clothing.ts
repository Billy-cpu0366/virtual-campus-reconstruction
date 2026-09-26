// 沙滩换装。
//
// 原站（`chunk-WMFY56ZM.js`）玩家踩到 `walls` 层的 GID 69353 时自动脱衣换泳装，
// 离开沙滩再踩回 69353 时穿回常服。触发块常量在 `../layer/beach-zone.ts`。
export const BEACH_TEXTURE = "player-beach";
export const CLOTHES_OFF_TEXTURE = "player-clothes-off";

/** 脱衣 / 穿衣动画 key。两者共用同一张 16 帧贴图，后者倒放。 */
export const UNDRESS_ANIMATION = "player-undressing";
export const DRESS_ANIMATION = "player-dressing";

/** 沙滩态站着不动用的帧（朝南首帧，与常服的 `IDLE_FRAME` 同格位）。 */
export const BEACH_IDLE_FRAME = 48;

/** 沙滩走路动画 key。帧布局与常服的 `walk-*` 完全一致（同规格 64 帧贴图）。 */
export function beachWalkAnimation(direction: string): string {
  return `beach-walk-${direction}`;
}

// 换装贴图的切图参数（原站：frameWidth/Height 128、帧 0–15，脱衣用 0→13、穿衣倒放）。
export const CLOTHES_OFF_FRAME_WIDTH = 128;
export const CLOTHES_OFF_FRAME_HEIGHT = 128;
export const CLOTHES_OFF_FIRST_FRAME = 0;
export const CLOTHES_OFF_LAST_FRAME = 13;
export const CLOTHING_FRAME_RATE = 8;

// 换装尺寸。
export const CLOTHES_OFF_DISPLAY_SIZE = 64;
export const CHANGE_CLOTHES_COOLDOWN_MS = 1000;

// 被抓。
export const HOLDING_TEXTURE = "player-holding";
export const HOLDING_DISPLAY_SIZE = 64;

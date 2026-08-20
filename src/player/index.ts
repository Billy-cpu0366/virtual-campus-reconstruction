export type { IdleAction, IdleAnimation } from "./contract.js";
export {
  ANIMATION_FRAME_RATE,
  DISPLAY_SIZE,
  IDLE_FRAME,
  SPAWN_X,
  SPAWN_Y,
  SPRITESHEET_FRAMES,
  TEXTURE_PLAYER,
  WALK_FRAMES_PER_DIRECTION,
  walkFrameRange,
  walkFrameStart,
} from "./appearance.js";
export {
  IDLE_ANIMATIONS,
  IDLE_TIME_FOR_EATING,
  IDLE_TIME_FOR_SITTING,
  idleAction,
  idleAnimationCandidates,
} from "./idle.js";
export { DEFAULT_FACING, facingDirection } from "./facing.js";
export {
  CHANGE_CLOTHES_COOLDOWN_MS,
  CLOTHES_OFF_DISPLAY_SIZE,
  HOLDING_DISPLAY_SIZE,
  HOLDING_TEXTURE,
} from "./clothing.js";

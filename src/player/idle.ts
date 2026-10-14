import type { IdleAction, IdleAnimation } from "./contract.js";

// 空闲状态。
export function idleAction(
  idleMs: number,
  timeForIdleAction: number,
  timeForSitting: number,
): IdleAction {
  if (idleMs >= timeForSitting) return "sitting";
  if (idleMs >= timeForIdleAction) return "idle";
  return "none";
}

// 小动作候选。
export function idleAnimationCandidates(
  previous: IdleAnimation | undefined,
  animations: readonly IdleAnimation[],
): readonly IdleAnimation[] {
  return animations.filter((a) => a !== previous);
}

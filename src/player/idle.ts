import type { IdleAction, IdleAnimation } from "./contract.js";

// 空闲阈值。
export const IDLE_TIME_FOR_EATING = 8000; // 8s
export const IDLE_TIME_FOR_SITTING = 30000; // 30s

export const IDLE_ANIMATIONS: readonly IdleAnimation[] = [
  "eating",
  "scratching",
  "tying-shoe",
];

// 空闲状态。
export function idleAction(idleMs: number): IdleAction {
  if (idleMs >= IDLE_TIME_FOR_SITTING) return "sitting";
  if (idleMs >= IDLE_TIME_FOR_EATING) return "idle";
  return "none";
}

// 小动作候选。
export function idleAnimationCandidates(
  previous: IdleAnimation | undefined,
): readonly IdleAnimation[] {
  return IDLE_ANIMATIONS.filter((a) => a !== previous);
}

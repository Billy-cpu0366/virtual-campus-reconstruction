/**
 * SYS-ENTITY 关停步骤的唯一名称表。顺序表示完整的原版关停次序；
 * 每套配置都必须包含每个步骤恰好一次。
 */
export const ENTITY_CLEANUP_STEPS = [
  "scene-destroyed",
  "entry",
  "sprayer",
  "route-crowd",
  "static-npc",
  "static-crowd",
  "bug-crowd",
  "venue-crowd",
  "dancing-crowd",
  "stop-ai-smoke",
  "fog",
  "police-colliders",
  "vehicle",
  "factory-smoke",
  "train",
  "entry-camera",
  "entry-train",
  "camera",
  "camera-lease",
  "map",
  "zone",
  "interact",
  "content-lease",
  "roof",
  "footstep",
  "player",
  "player-visual",
  "joystick",
  "movement",
  "scheduler",
] as const;

export type EntityCleanupStep = (typeof ENTITY_CLEANUP_STEPS)[number];

export interface EntityConfigs {
  readonly cleanupOrder: readonly EntityCleanupStep[];
}

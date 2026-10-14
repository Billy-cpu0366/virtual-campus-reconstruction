import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { ENTITY_CLEANUP_STEPS, type EntityConfigs } from "./types.js";
import { ENTITY_SHAPES, type EntityConfigKey } from "./shapes.js";

export type { EntityCleanupStep, EntityConfigs } from "./types.js";
export { ENTITY_CLEANUP_STEPS } from "./types.js";

export const ENTITY_CONFIG_KEYS = Object.keys(ENTITY_SHAPES) as readonly EntityConfigKey[];

export async function loadEntityConfigs(source: ConfigSource): Promise<EntityConfigs> {
  const key: EntityConfigKey = "04-独立件/SYS-ENTITY/数据/entity-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<EntityConfigs>(key, ENTITY_SHAPES[key], file.data);
  const order = config.cleanupOrder;
  if (order.length !== ENTITY_CLEANUP_STEPS.length ||
      new Set(order).size !== ENTITY_CLEANUP_STEPS.length ||
      ENTITY_CLEANUP_STEPS.some((step) => !order.includes(step))) {
    throw new Error(`${key} 的 cleanupOrder 必须完整包含 30 个不同步骤`);
  }
  if (order[0] !== "scene-destroyed") {
    throw new Error(`${key} 的 cleanupOrder 必须先设置关停标记`);
  }
  return deepFreeze(config) as EntityConfigs;
}

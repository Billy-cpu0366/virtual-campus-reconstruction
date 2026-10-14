import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { MOVE_SHAPES, type MoveConfigKey } from "./shapes.js";
import type { MoveConfigs } from "./types.js";

export type { MoveConfigs } from "./types.js";
export const MOVE_CONFIG_KEYS = Object.keys(MOVE_SHAPES) as readonly MoveConfigKey[];

export async function loadMoveConfigs(source: ConfigSource): Promise<MoveConfigs> {
  const key: MoveConfigKey = "02-玩法线/SYS-MOVE/数据/move-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<MoveConfigs>(key, MOVE_SHAPES[key], file.data);
  if (config.body.width <= 0 || config.body.height <= 0 ||
      config.drag < 0 || config.maxVelocity <= 0 ||
      config.walkableValue === config.blockedValue ||
      config.collisionLayerNames.length === 0 ||
      new Set(config.collisionLayerNames).size !== config.collisionLayerNames.length) {
    throw new RangeError(`${key} 的碰撞尺寸、速度、网格值和碰撞层必须有效`);
  }
  return config;
}

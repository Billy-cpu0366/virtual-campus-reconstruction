import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { WORLD_SHAPES, type WorldConfigKey } from "./shapes.js";
import type { WorldConfigs } from "./types.js";

export type { WorldConfigs } from "./types.js";
export const WORLD_CONFIG_KEYS = Object.keys(WORLD_SHAPES) as readonly WorldConfigKey[];

export async function loadWorldConfigs(source: ConfigSource): Promise<WorldConfigs> {
  const key: WorldConfigKey = "01-地图线/SYS-WORLD/数据/world-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<WorldConfigs>(key, WORLD_SHAPES[key], file.data);
  if (!Number.isInteger(config.entryCorridorSamples) || config.entryCorridorSamples <= 0 ||
      !Number.isInteger(config.bridgeCheckFrames) || config.bridgeCheckFrames <= 0 ||
      !Number.isInteger(config.clearLayersPerFrame) || config.clearLayersPerFrame <= 0 ||
      config.tileQuery.layer.length === 0) {
    throw new RangeError(`${key} 的采样、帧数、清理预算和查询图层必须有效`);
  }
  return config;
}

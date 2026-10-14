import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { ZONE_SHAPES, type ZoneConfigKey } from "./shapes.js";
import type { ZoneConfigs } from "./types.js";

export type { ZoneConfigs } from "./types.js";
export const ZONE_CONFIG_KEYS = Object.keys(ZONE_SHAPES) as readonly ZoneConfigKey[];

export async function loadZoneConfigs(source: ConfigSource): Promise<ZoneConfigs> {
  const key: ZoneConfigKey = "03-内容线/SYS-ZONE/数据/zone-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<ZoneConfigs>(key, ZONE_SHAPES[key], file.data);
  if (config.interactionDistance <= 0 || config.contentUpdateIntervalMs <= 0 ||
      config.intervalMs < 0 || config.viewportPadding < 0) {
    throw new RangeError(`${key} 的时间和距离必须在合法范围内`);
  }
  const ids = config.markers.map((marker) => marker.markerId);
  if (new Set(ids).size !== ids.length) throw new Error(`${key} 有重复的 markerId`);
  return config;
}

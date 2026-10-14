import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import type { AppConfigs } from "./types.js";
import { APP_SHAPES, type AppConfigKey } from "./shapes.js";

export type { AppConfigs } from "./types.js";

export const APP_CONFIG_KEYS = Object.keys(APP_SHAPES) as readonly AppConfigKey[];

export async function loadAppConfigs(source: ConfigSource): Promise<AppConfigs> {
  const key: AppConfigKey = "04-独立件/SYS-APP/数据/app-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<AppConfigs>(key, APP_SHAPES[key], file.data);
  return deepFreeze(config) as AppConfigs;
}

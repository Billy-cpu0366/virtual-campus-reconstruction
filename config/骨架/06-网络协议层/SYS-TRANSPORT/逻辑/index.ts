import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import type { TransportConfigs } from "./types.js";
import { TRANSPORT_SHAPES, type TransportConfigKey } from "./shapes.js";

export type { TransportConfigs } from "./types.js";

export const TRANSPORT_CONFIG_KEYS = Object.keys(TRANSPORT_SHAPES) as readonly TransportConfigKey[];

export async function loadTransportConfigs(source: ConfigSource): Promise<TransportConfigs> {
  const key: TransportConfigKey = "06-网络协议层/SYS-TRANSPORT/数据/transport-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<TransportConfigs>(key, TRANSPORT_SHAPES[key], file.data);
  if (!Number.isInteger(config.timeouts.json) || config.timeouts.json <= 0) {
    throw new RangeError(`${key} 的 timeouts.json 必须是正整数毫秒数`);
  }
  return deepFreeze(config) as TransportConfigs;
}

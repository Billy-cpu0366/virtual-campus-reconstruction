import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { CHUNK_SHAPES, type ChunkConfigKey } from "./shapes.js";
import type { ChunkConfigs } from "./types.js";

export type { ChunkConfigs } from "./types.js";
export const CHUNK_CONFIG_KEYS = Object.keys(CHUNK_SHAPES) as readonly ChunkConfigKey[];

export async function loadChunkConfigs(source: ConfigSource): Promise<ChunkConfigs> {
  const key: ChunkConfigKey = "01-地图线/SYS-CHUNK/数据/chunk-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<ChunkConfigs>(key, CHUNK_SHAPES[key], file.data);
  if (!Number.isInteger(config.playerNeighborhoodRadius) ||
      !Number.isInteger(config.cameraPadding) ||
      !Number.isInteger(config.maxAttempts) || config.maxAttempts < 1 ||
      config.updateIntervalMs <= 0) {
    throw new RangeError(`${key} 的分块范围、重试次数和更新间隔必须是有效正数`);
  }
  return config;
}

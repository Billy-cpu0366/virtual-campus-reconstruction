import type { Direction } from "../../../../../src/input/index.js";
import type { IdleAnimation } from "../../../../../src/player/contract.js";
import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { PLAYER_SHAPES, type PlayerConfigKey } from "./shapes.js";
import type { PlayerConfigs } from "./types.js";

export type { PlayerConfigs, PlayerTexture } from "./types.js";
export const PLAYER_CONFIG_KEYS = Object.keys(PLAYER_SHAPES) as readonly PlayerConfigKey[];

type RawPlayerConfigs = Omit<PlayerConfigs, "idleFrame" | "spritesheet" | "beach"> & {
  readonly spritesheet: Omit<PlayerConfigs["spritesheet"], "frames">;
  readonly beach: Omit<PlayerConfigs["beach"], "idleFrame">;
};

export async function loadPlayerConfigs(source: ConfigSource): Promise<PlayerConfigs> {
  const key: PlayerConfigKey = "02-玩法线/SYS-PLAYER/数据/player-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<RawPlayerConfigs>(key, PLAYER_SHAPES[key], file.data);
  const starts = config.animation.walkFrameStart as Readonly<Record<Direction, number>>;
  const directions: readonly Direction[] = [
    "east", "north-east", "north-west", "north",
    "south-east", "south-west", "south", "west",
  ];
  const frameCount = Math.max(...directions.map((direction) => starts[direction])) +
    config.animation.walkFramesPerDirection;
  const idleFrame = starts[config.defaultFacing];
  for (const texture of config.idle.textures) {
    if (texture.key.trim() === "" || texture.url.trim() === "") {
      throw new Error(`${key} 的 idle.textures 缺少 key 或 url`);
    }
  }
  if (config.idle.timeForIdleAction > config.idle.timeForSitting) {
    throw new RangeError(`${key} 的 idle 阈值顺序无效`);
  }
  if (config.clothing.frameRange.start > config.clothing.frameRange.end) {
    throw new RangeError(`${key} 的 clothing.frameRange 无效`);
  }
  const result = {
    ...config,
    spritesheet: { ...config.spritesheet, frames: frameCount },
    idleFrame,
    beach: { ...config.beach, idleFrame },
  } as PlayerConfigs;
  return deepFreeze(result) as PlayerConfigs;
}

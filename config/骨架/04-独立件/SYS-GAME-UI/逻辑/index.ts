import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import type { GameUiConfigs } from "./types.js";
import { GAME_UI_SHAPES, type GameUiConfigKey } from "./shapes.js";

export type { GameUiConfigs } from "./types.js";

export const GAME_UI_CONFIG_KEYS = Object.keys(GAME_UI_SHAPES) as readonly GameUiConfigKey[];

export async function loadGameUiConfigs(source: ConfigSource): Promise<GameUiConfigs> {
  const key: GameUiConfigKey = "04-独立件/SYS-GAME-UI/数据/game-ui-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<GameUiConfigs>(key, GAME_UI_SHAPES[key], file.data);
  return deepFreeze(config) as GameUiConfigs;
}

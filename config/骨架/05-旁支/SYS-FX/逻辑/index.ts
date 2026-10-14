import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import type { FxConfigs } from "./types.js";
import { FX_SHAPES, type FxConfigKey } from "./shapes.js";
import { STOP_AI_SMOKE_LAYERS, STOP_AI_SMOKE_SITES } from "../../../../../src/fx/index.js";

export type {
  ConcertColorLightAnchor,
  ConcertLightingAnchor,
  ConcertLightingFxConfig,
  ConcertLaserAnchor,
  ConcertSpotlightAnchor,
  FactorySmokeFxConfig,
  FogFxConfig,
  FootstepFxConfig,
  FxConfigs,
  FxPoint,
  PlayerVisualFxConfig,
  StopAiSmokeFxConfig,
  StopAiSmokeLayerSetting,
  StopAiSmokeSiteConfig,
} from "./types.js";

export const FX_CONFIG_KEYS = Object.keys(FX_SHAPES) as readonly FxConfigKey[];

export async function loadFxConfigs(source: ConfigSource): Promise<FxConfigs> {
  const key: FxConfigKey = "05-旁支/SYS-FX/数据/fx-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<FxConfigs>(key, FX_SHAPES[key], file.data);
  if (config.fog.polygon.length !== 29 || config.fog.tint.length !== 3 ||
      config.stopAiSmoke.sites.length !== 3 || config.stopAiSmoke.layers.length !== 3 ||
      config.stopAiSmoke.tint.length !== 3 || config.concertLighting.spotlights.length !== 2 ||
      config.concertLighting.colorLights.length !== 2 || config.concertLighting.lasers.length !== 6) {
    throw new Error(`${key} 的固定实例数量与原配置不一致`);
  }
  if (new Set(config.stopAiSmoke.sites.map(({ site }) => site)).size !== STOP_AI_SMOKE_SITES.length ||
      STOP_AI_SMOKE_SITES.some(({ site }) => !config.stopAiSmoke.sites.some((item) => item.site === site)) ||
      new Set(config.stopAiSmoke.layers).size !== STOP_AI_SMOKE_LAYERS.length ||
      STOP_AI_SMOKE_LAYERS.some((layer) => !config.stopAiSmoke.layers.includes(layer))) {
    throw new Error(`${key} 的 Stop AI 烟雾站点与层名称必须各出现一次`);
  }
  return deepFreeze(config) as FxConfigs;
}

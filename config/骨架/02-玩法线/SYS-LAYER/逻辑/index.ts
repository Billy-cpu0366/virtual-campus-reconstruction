import type { LayerStrategy } from "../../../../../src/layer/contract.js";
import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { LAYER_SHAPES, type LayerConfigKey } from "./shapes.js";
import type { LayerConfigs } from "./types.js";

export type { LayerConfigs, LayerPixelRect, LayerTileRect } from "./types.js";
export const LAYER_CONFIG_KEYS = Object.keys(LAYER_SHAPES) as readonly LayerConfigKey[];

type RawLayerStrategy = Omit<LayerStrategy, "depth"> & {
  readonly depth: number | null;
};
type RawLayerConfigs = Omit<LayerConfigs, "strategies" | "strategiesByName" | "roofLayers"> & {
  readonly strategies: readonly RawLayerStrategy[];
};

export async function loadLayerConfigs(source: ConfigSource): Promise<LayerConfigs> {
  const key: LayerConfigKey = "02-玩法线/SYS-LAYER/数据/layer-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<RawLayerConfigs>(key, LAYER_SHAPES[key], file.data);
  const strategies = config.strategies.map((strategy) => Object.freeze({
    ...strategy,
    depth: strategy.depth === null ? undefined : strategy.depth,
  }));
  const strategiesByName: Record<string, LayerStrategy> = Object.create(null);
  for (const strategy of strategies) {
    if (strategiesByName[strategy.name] !== undefined) {
      throw new Error(`${key} 的图层名称重复：${strategy.name}`);
    }
    strategiesByName[strategy.name] = strategy;
  }
  const roofLayers = [
    ...config.roofGroups.concert,
    ...config.roofGroups.factory,
  ];
  if (new Set(roofLayers).size !== roofLayers.length) {
    throw new Error(`${key} 的 roofGroups 含重复图层`);
  }
  for (const name of roofLayers) {
    if (strategiesByName[name]?.role !== "dynamic-visual") {
      throw new Error(`${key} 的屋顶图层 ${name} 必须属于 dynamic-visual`);
    }
  }
  if (config.roofFadeMs < 0 || config.roofTweenEase.trim() === "") {
    throw new RangeError(`${key} 的屋顶淡隐时长和缓动名称必须有效`);
  }
  const frozenStrategiesByName = Object.freeze(strategiesByName);
  return deepFreeze({
    ...config,
    strategies,
    strategiesByName: frozenStrategiesByName,
    roofLayers,
  }) as LayerConfigs;
}

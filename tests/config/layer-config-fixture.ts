import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadLayerConfigs } from "../../config/骨架/02-玩法线/SYS-LAYER/逻辑/index.js";

export const LAYER_CONFIGS = await loadLayerConfigs(createDiskConfigSource());
export const LAYER_STRATEGIES = LAYER_CONFIGS.strategies;

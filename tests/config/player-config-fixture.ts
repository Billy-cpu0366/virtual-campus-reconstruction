import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadPlayerConfigs } from "../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";

export const PLAYER_CONFIGS = await loadPlayerConfigs(createDiskConfigSource());

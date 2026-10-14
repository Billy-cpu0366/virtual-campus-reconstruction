import defaultFxFile from "../../config/default/05-旁支/SYS-FX/数据/fx-config.json" with { type: "json" };
import type { FxConfigs } from "../../config/骨架/05-旁支/SYS-FX/逻辑/index.js";

export const FX_CONFIGS = defaultFxFile.data as FxConfigs;

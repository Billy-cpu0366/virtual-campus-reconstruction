import { CONTENT_MENU_IDS } from "../../../../../src/content/contract.js";
import type {
  ContentMenuId,
  GameUiContentPayload,
} from "../../../../../src/content/contract.js";
import { deepFreeze } from "../../../公共/deep-freeze.js";
import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { INTERACT_SHAPES, type InteractConfigKey } from "./shapes.js";
import type { InteractConfigs } from "./types.js";

export type { InteractConfigs } from "./types.js";
export const INTERACT_CONFIG_KEYS = Object.keys(INTERACT_SHAPES) as readonly InteractConfigKey[];

type RawInteractConfigs = Omit<InteractConfigs, "content"> & {
  readonly content: Readonly<Record<ContentMenuId, Omit<GameUiContentPayload, "menuId">>>;
};

export async function loadInteractConfigs(source: ConfigSource): Promise<InteractConfigs> {
  const key: InteractConfigKey = "03-内容线/SYS-INTERACT/数据/interact-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<RawInteractConfigs>(key, INTERACT_SHAPES[key], file.data);
  if (config.modal.desktopMaxHeightRatio <= 0 || config.modal.desktopMaxHeightRatio > 1 ||
      config.modal.mobileMaxHeightRatio <= 0 || config.modal.mobileMaxHeightRatio > 1) {
    throw new RangeError(`${key} 的弹窗高度比例必须在 0 到 1 之间`);
  }
  const visibleIds = config.visibleMenuIds;
  if (new Set(visibleIds).size !== visibleIds.length) {
    throw new Error(`${key} 的 visibleMenuIds 有重复菜单`);
  }
  for (const menuId of CONTENT_MENU_IDS) {
    const payload = config.content[menuId];
    if (payload.body.length === 0 || payload.body.some((line) => line.trim() === "")) {
      throw new Error(`${key} 的 ${menuId} 正文必须包含非空段落`);
    }
  }
  const content = Object.fromEntries(CONTENT_MENU_IDS.map((menuId) => [
    menuId,
    Object.freeze({ menuId, ...config.content[menuId] }),
  ])) as Record<ContentMenuId, GameUiContentPayload>;
  return deepFreeze({ ...config, content }) as InteractConfigs;
}

/**
 * 公共：所有板块都要用的零件，跟具体是哪个系统无关。
 *
 *   config-source.ts         读配置的规矩（只有形状，没有实现）
 *   fetch-config-source.ts   一个实现：运行时从网上取
 *   config-location.ts       读哪一套、根地址是什么（会随校园和部署变）
 *   validate.ts              拿形状声明去比一份数据
 *   normalize-config-file.ts 查信封、查 meta、冻结
 *   deep-freeze.ts           递归冻结
 *
 * **这里不许 import 任何一个板块的东西。** 依赖方向是单向的：
 * 板块 → 公共。反过来就会缠成一团，改一个系统牵动所有系统。
 */
export * from "./config-source.js";
export {
  CONFIG_SETS_ROOT,
  CONFIG_SET_PARAM,
  DEFAULT_CONFIG_SET,
  isConfigSetName,
  resolveConfigSet,
  configBaseUrlFor,
} from "./config-location.js";
export { deepFreeze } from "./deep-freeze.js";
export {
  createFetchConfigSource,
  configUrlFor,
  CONFIG_REQUEST_TIMEOUT_MS,
  type ConfigFetch,
  type ConfigResponseLike,
  type FetchConfigSourceOptions,
} from "./fetch-config-source.js";
export { normalizeConfigFile } from "./normalize-config-file.js";
export { validate, type Spec } from "./validate.js";

/**
 * 配置来源的另一个实现：**直接从磁盘读**，只给 node 用（测试、命令行工具）。
 *
 * 为什么不让游戏也用它：浏览器读不了本地文件，那边只能走 fetch。
 * 为什么不让它进 `骨架/公共/`：`骨架/公共/` 里的东西浏览器和 node 都要用，
 * 一旦 import 了 `node:fs`，浏览器那一侧就编不过了。所以它住在这儿。
 *
 * 它和 fetch 那个实现走的是**同一条后处理**（都调 `normalizeConfigFile`），
 * 所以测试里验过的信封规则、meta 规则、冻结保证，和线上是同一套。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ConfigError, type ConfigSource } from "../骨架/公共/config-source.js";
import { normalizeConfigFile } from "../骨架/公共/normalize-config-file.js";
import { DEFAULT_CONFIG_SET } from "../骨架/公共/config-location.js";

/** 仓库根目录。这个文件在 `config/工具/`，往上两层就是根。 */
export const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** 所有配置集住的地方。和 `骨架/公共/config-location.ts` 的网址根一一对应。 */
export const CONFIG_DIR = resolve(PROJECT_ROOT, "config");

/**
 * 一个集在磁盘上的根目录。
 *
 * 默认那一套的常量单独导出：绝大多数测试读的就是它，不必每次自己拼。
 */
export const configSetDirOf = (set: string): string =>
  resolve(CONFIG_DIR, set);

/** 默认那一套（`config/default/`）在磁盘上的根。 */
export const DEFAULT_CONFIG_SET_DIR = configSetDirOf(DEFAULT_CONFIG_SET);

export const createDiskConfigSource = (
  root: string = DEFAULT_CONFIG_SET_DIR,
): ConfigSource => ({
  async read(key: string) {
    const path = resolve(root, key);
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      throw new ConfigError(`磁盘上没有这个配置文件：${path}`, { cause: error });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch (error) {
      throw new ConfigError(`${path} 不是合法 JSON`, { cause: error });
    }
    return normalizeConfigFile(key, raw);
  },
});

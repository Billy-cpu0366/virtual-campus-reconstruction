/**
 * 配置来源的一个实现：**运行时从网上取**（第二小步起用这个，第一小步那个
 * 从打包文件里读的实现已经删掉了）。
 *
 * 它只做三件事：按 key 拼出网址、取回来、把生数据交给 `normalizeConfigFile()`。
 * 校验和冻结都在那个共用模块里——原因见它的注释（换来源时不能把保护也换掉）。
 *
 * **为什么要换成 fetch**：终点是后台管理系统。后台改的是一个文件，游戏下次
 * 刷新时去取。如果配置是构建时打包进去的，后台改了也没用——得重新构建才生效。
 * 这一条是「做完之后，改一个数不用重新构建、刷新页面就生效」的全部依据。
 *
 * 和第一小步那个实现相比，只有「怎么拿到生数据」不一样，拿到之后走的是
 * 同一条路。所以 `ConfigSource` 这个接口一行为没动，上层调用方也不用改。
 */
import { ConfigError, type ConfigSource } from "./config-source.js";
import { normalizeConfigFile } from "./normalize-config-file.js";

/** 等这么久还没回话，就当它丢了。和 `game/fetchJson.ts` 用同一个数。 */
export const CONFIG_REQUEST_TIMEOUT_MS = 15_000;

/** 只用到 Response 的这几个成员，缩小依赖面，测试也好造假的。 */
export interface ConfigResponseLike {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/**
 * 取文件的动作。默认是浏览器的 `fetch`；测试递一个假的进来，就能在
 * 不联网的前提下验证「取不到 / 取回来是坏 JSON」这些分支。
 */
export type ConfigFetch = (
  url: string,
  init: { readonly signal: AbortSignal; readonly cache: "no-cache" },
) => Promise<ConfigResponseLike>;

export interface FetchConfigSourceOptions {
  /**
   * 取文件的根地址，**末尾必须带斜杠**。key 直接拼在它后面。
   *
   * 例：`/config/default/` + `05-旁支/SYS-NPC/数据/sprayer-tuning.json`。
   * 以后后台把配置放在别的域名下，改这一个字符串就行。
   */
  readonly baseUrl: string;
  readonly fetchImpl?: ConfigFetch;
  /** 调用方自己的取消信号（比如场景销毁）。会和外层的超时合并。 */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

const defaultFetch: ConfigFetch = async (url, init) =>
  (await fetch(url, init)) as unknown as ConfigResponseLike;

/** 把一个 key 拼成网址。中文路径要转义，否则某些服务器会认不出来。 */
export const configUrlFor = (baseUrl: string, key: string): string =>
  `${baseUrl}${encodeURI(key)}`;

/**
 * 拿一个根地址，造一个来源。
 *
 * 注意这里**不需要一份「有哪些文件」的清单**——和第一小步不同。第一小步是
 * 静态导入，打包器必须先知道有哪些文件，所以非有清单不可；现在是按 key 直接
 * 取，清单就不再是「取数的前提」，只是「要取哪些」的名单，那是各系统自己的事。
 */
export const createFetchConfigSource = (
  options: FetchConfigSourceOptions,
): ConfigSource => {
  const {
    baseUrl,
    fetchImpl = defaultFetch,
    signal: outerSignal,
    timeoutMs = CONFIG_REQUEST_TIMEOUT_MS,
  } = options;

  const readOne = async (key: string): Promise<unknown> => {
    const url = configUrlFor(baseUrl, key);
    const controller = new AbortController();
    const abort = (): void => controller.abort(outerSignal?.reason);
    outerSignal?.addEventListener("abort", abort, { once: true });
    if (outerSignal?.aborted) abort();
    const timer = setTimeout(() => {
      controller.abort(
        new DOMException(`取配置超时（等了 ${timeoutMs} 毫秒）：${url}`, "TimeoutError"),
      );
    }, timeoutMs);
    let response: ConfigResponseLike;
    try {
      response = await fetchImpl(url, { signal: controller.signal, cache: "no-cache" });
    } catch (error) {
      throw new ConfigError(`取不到配置文件：${url}`, { cause: error });
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener("abort", abort);
    }
    if (!response.ok) {
      throw new ConfigError(`取配置文件失败：${url} 返回 HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new ConfigError(`${url} 的内容不是合法 JSON`, { cause: error });
    }
  };

  return {
    async read(key: string) {
      // 先查信封、查 meta、冻结，再交出去。和第一小步一样，一道工序都不少。
      return normalizeConfigFile(key, await readOne(key));
    },
  };
};

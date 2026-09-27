/**
 * 第二小步换的那个取数实现：**运行时从网上取**。
 *
 * 为什么单独立一个文件测它：它是 1.3 唯一的新机制，而且它的失败方式全是
 * 「拿不到值」——取不到、取回来是坏 JSON、服务器返回 404。这些分支在浏览器里
 * 很难手动验证（要真去拔网线），所以在这里用一个假的 fetch 全跑一遍。
 *
 * 这里**不验业务值**（那是 tests/npc/ 的事），只验这条路走不走得通、
 * 走不通时报的错对不对。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  configUrlFor,
  createFetchConfigSource,
  type ConfigFetch,
  type ConfigResponseLike,
} from "../../config/骨架/公共/fetch-config-source.js";
import { ConfigError } from "../../config/骨架/公共/config-source.js";
import { DEFAULT_CONFIG_SET_DIR } from "../../config/工具/config-source-from-disk.js";

/**
 * 取文件的根地址。**故意写死**：这个文件验的就是「网址长什么样」，
 * 拿 `configBaseUrlFor()` 现算的话，等于拿函数验函数，验不出东西。
 */
const BASE_URL = "/config/default/";

const KEY = "05-旁支/SYS-NPC/数据/sprayer-tuning.json";
const FILE = resolve(DEFAULT_CONFIG_SET_DIR, KEY);
const REAL_TEXT = readFileSync(FILE, "utf8");

const respondWith = (
  body: string,
  status = 200,
): ConfigResponseLike => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return JSON.parse(body) as unknown;
  },
});

const sourceReturning = (fetchImpl: ConfigFetch, baseUrl = BASE_URL) =>
  createFetchConfigSource({ baseUrl, fetchImpl, timeoutMs: 50 });

describe("fetch 来源：正常取到", () => {
  it("按 baseUrl + key 拼网址，取回来的内容和磁盘上一致", async () => {
    const seen: string[] = [];
    const source = sourceReturning(async (url) => {
      seen.push(url);
      return respondWith(REAL_TEXT);
    });
    const file = await source.read(KEY);
    expect(seen).toStrictEqual([configUrlFor(BASE_URL, KEY)]);
    expect(file.data).toStrictEqual(JSON.parse(REAL_TEXT).data);
  });

  it("中文路径会转义——不转义有些服务器会当成非法请求", () => {
    const url = configUrlFor(BASE_URL, KEY);
    expect(url).not.toContain("旁支");
    expect(decodeURI(url)).toBe(`${BASE_URL}${KEY}`);
  });

  it("取回来的东西照样过信封检查和冻结（和磁盘那个实现同一套）", async () => {
    const source = sourceReturning(async () => respondWith(REAL_TEXT));
    const file = await source.read(KEY);
    expect(Object.isFrozen(file)).toBe(true);
    expect(file.meta.source.length).toBeGreaterThan(0);
    expect(file.meta.verified).toBe("mixed");
  });

  it("不要缓存——后台改了配置，刷新时得拿到新的那份", async () => {
    let cacheMode: string | undefined;
    const source = createFetchConfigSource({
      baseUrl: BASE_URL,
      fetchImpl: async (_url, init) => {
        cacheMode = init.cache;
        return respondWith(REAL_TEXT);
      },
    });
    await source.read(KEY);
    expect(cacheMode).toBe("no-cache");
  });
});

describe("fetch 来源：取不到的时候", () => {
  it("服务器返回 404：报「取失败」并且带上状态码", async () => {
    const source = sourceReturning(async () => respondWith("nope", 404));
    await expect(source.read(KEY)).rejects.toThrow(/HTTP 404/);
    await expect(source.read(KEY)).rejects.toBeInstanceOf(ConfigError);
  });

  it("网络断了：报「取不到」并保留原始错误", async () => {
    const source = sourceReturning(async () => {
      throw new TypeError("Failed to fetch");
    });
    const failure = await source.read(KEY).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConfigError);
    expect((failure as ConfigError).cause).toBeInstanceOf(TypeError);
  });

  it("响应体不是合法 JSON：报错说清楚是这份文件的问题", async () => {
    const source = sourceReturning(async () => ({
      ok: true,
      status: 200,
      async json() {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    await expect(source.read(KEY)).rejects.toThrow(/不是合法 JSON/);
  });

  it("是合法 JSON 但信封不对（缺 data）：照样拦下来", async () => {
    const source = sourceReturning(async () => respondWith('{"meta":{}}'));
    await expect(source.read(KEY)).rejects.toThrow(/缺 data/);
  });

  it("等太久没回话：掐掉并报超时，不会一直挂着", async () => {
    const source = createFetchConfigSource({
      baseUrl: BASE_URL,
      timeoutMs: 20,
      fetchImpl: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason));
        }),
    });
    const failure = await source.read(KEY).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConfigError);
    expect(String((failure as ConfigError).cause)).toMatch(/超时/);
  });
});

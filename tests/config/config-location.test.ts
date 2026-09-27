/**
 * 「这一局读哪一套配置」这件事。
 *
 * 为什么单独立一个文件测它：`config/` 底下要放不止一套（`default/`、以后还有
 * `set1/`、`set2/`），读哪一套全看网址上那一个参数。这个参数的解析有两个错法，
 * 而且都是**不出声的错**：
 *
 * - 把集名拼错（`set_1`、`Set1`、`中文`）——游戏照常跑起来，只是读的是默认那套。
 * - 集名里塞进 `../` 之类——能越出 `config/` 读到别处去。
 *
 * 这两种在浏览器里都不报错，所以在这里把边界一个个钉死。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONFIG_SETS_ROOT,
  CONFIG_SET_PARAM,
  DEFAULT_CONFIG_SET,
  configBaseUrlFor,
  isConfigSetName,
  resolveConfigSet,
} from "../../config/骨架/公共/config-location.js";

/** 跑一次 `resolveConfigSet`，顺便把控制台喊的那句收下来。 */
const resolveAndWarn = (search: string): { set: string; warned: boolean } => {
  const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const set = resolveConfigSet(search);
  return { set, warned: spy.mock.calls.length > 0 };
};

afterEach(() => vi.restoreAllMocks());

describe("网址上没指明读哪一套", () => {
  it("空查询串 → 默认那套", () => {
    expect(resolveConfigSet("")).toBe(DEFAULT_CONFIG_SET);
  });

  it("只有个问号 → 默认那套", () => {
    expect(resolveConfigSet("?")).toBe(DEFAULT_CONFIG_SET);
  });

  it("有别的不相干参数、就是没有 config → 默认那套", () => {
    expect(resolveConfigSet("?foo=1&bar=2")).toBe(DEFAULT_CONFIG_SET);
  });
});

describe("网址上指明了读哪一套", () => {
  it("普通集名照原样用", () => {
    expect(resolveConfigSet("?config=set1")).toBe("set1");
  });

  it("混在别的参数里也认得出来", () => {
    expect(resolveConfigSet("?foo=1&config=set2&bar=2")).toBe("set2");
  });

  it("大写统一压成小写——磁盘上的集名只许小写", () => {
    expect(resolveConfigSet("?config=Set1")).toBe("set1");
  });

  it("前后带空格也认，不算拼错", () => {
    expect(resolveConfigSet("?config=%20set1%20")).toBe("set1");
  });

  it("减号下划线是合法的集名用字", () => {
    expect(resolveConfigSet("?config=school-1_a")).toBe("school-1_a");
  });
});

describe("集名不合格时退回默认那套，并且喊一声", () => {
  // 每一条都要求「喊了」：不喊的话，拼错的人看到游戏照常跑起来，
  // 会以为自己指定的那套生效了。
  const bad: readonly (readonly [string, string])[] = [
    ["带斜杠，想穿目录", "?config=a/b"],
    ["想往上跳", "?config=../x"],
    ["想往上跳（编码过的点）", "?config=%2E%2E%2Fx"],
    ["空值", "?config="],
    ["中文名", `?config=${encodeURIComponent("骨架")}`],
    ["中间带空格", "?config=set%201"],
    ["超长", `?config=${"a".repeat(65)}`],
    ["带点", "?config=set.1"],
  ];

  for (const [what, search] of bad) {
    it(`${what}：${search}`, () => {
      const { set, warned } = resolveAndWarn(search);
      expect(set).toBe(DEFAULT_CONFIG_SET);
      expect(warned).toBe(true);
    });
  }
});

describe("合不合集名规矩", () => {
  it("合格的：小写英文、数字、减号、下划线", () => {
    for (const name of ["default", "set1", "school-1", "a_b", "0"]) {
      expect(isConfigSetName(name)).toBe(true);
    }
  });

  it("骨架 / 文档 / 工具 都不算——这条是白捡的，不用另外维护名单", () => {
    for (const name of ["骨架", "文档", "工具"]) {
      expect(isConfigSetName(name)).toBe(false);
    }
  });

  it("大写不算——Windows 上读得到、传到 Linux 上就找不到，索性一律小写", () => {
    expect(isConfigSetName("SET1")).toBe(false);
    expect(isConfigSetName("Default")).toBe(false);
  });

  it("空串、带斜杠、带点的都不算", () => {
    for (const name of ["", "a/b", "../a", "set.1", "a b"]) {
      expect(isConfigSetName(name)).toBe(false);
    }
  });
});

describe("集名 → 取文件的根地址", () => {
  it("拼出来是「根 + 集名 + 斜杠」，末尾那个斜杠不能少", () => {
    expect(configBaseUrlFor("set1")).toBe("/config/set1/");
    expect(configBaseUrlFor(DEFAULT_CONFIG_SET)).toBe("/config/default/");
  });

  it("根地址和常量是同一个词，不会各写一份", () => {
    expect(CONFIG_SETS_ROOT).toBe("/config/");
    expect(configBaseUrlFor("x").startsWith(CONFIG_SETS_ROOT)).toBe(true);
  });

  it("参数名就是网址上那个词", () => {
    expect(CONFIG_SET_PARAM).toBe("config");
    expect(resolveConfigSet(`?${CONFIG_SET_PARAM}=set1`)).toBe("set1");
  });
});

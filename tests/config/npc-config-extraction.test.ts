/**
 * 「config/ 抽出来的那份，和源码里的那份一样吗？」——这个问题的机检答案。
 *
 * 原来分两半：数据层（NPC 的 8 个系统）、呈现层（game/ 下 7 个适配器）。
 * **两半都已经功成身退**——src/ 和 game/ 里那几份常量都删掉了，游戏改成读配置，
 * 旧值无从比起。改由 tests/npc/ 下各自的测试按「读配置 + 行为对」验收。
 *
 * 剩下的部分（形状声明、单位、校验器、可比对边界）跟接线无关，长期有效。
 */
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";


import {
  createDiskConfigSource,
  PROJECT_ROOT,
} from "../../config/工具/config-source-from-disk.js";
import {
  loadNpcConfigs,
  NPC_CONFIG_KEYS,
} from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";
import { NPC_SHAPES } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/shapes.js";
import { validate, type Spec } from "../../config/骨架/公共/validate.js";
import { ConfigError } from "../../config/骨架/公共/config-source.js";
import type { ConfigVerification, Unit } from "../../config/骨架/公共/config-source.js";

const DATA_DIR = resolve(PROJECT_ROOT, "config/default/05-旁支/SYS-NPC/数据");

/** 测试不起服务器，所以用磁盘那个实现——和线上的 fetch 实现走同一条后处理。 */
const staticSource = createDiskConfigSource();

const loaded = await loadNpcConfigs(staticSource);

// ── 1. 值和源码逐字段一样（全量，不是抽查）─────────────────────────────────

describe("配置对象每一层都冻住了（现有测试大量断言 Object.isFrozen）", () => {
  // 这一组不跟 src/ 比，只检查「读进来之后没人能偷偷改」。
  it("数组、对象、嵌套的坐标点都冻住了", () => {
    expect(Object.isFrozen(loaded.dancingCrowd)).toBe(true);
    expect(Object.isFrozen(loaded.routeCrowdConfigs)).toBe(true);
    expect(Object.isFrozen(loaded.routeCrowdConfigs[0])).toBe(true);
    expect(Object.isFrozen(loaded.routeCrowdConfigs[0]?.startTiles)).toBe(true);
    expect(Object.isFrozen(loaded.routeCrowdConfigs[0]?.startTiles[0])).toBe(
      true,
    );
    expect(Object.isFrozen(loaded.staticCrowdRegions[0])).toBe(true);
    expect(Object.isFrozen(loaded.staticCrowdRegions[0]?.outline)).toBe(true);
    expect(Object.isFrozen(loaded.staticCrowdRegions[0]?.outline[0])).toBe(true);
    expect(Object.isFrozen(loaded.venueCrowdRegions[0]?.outline[0])).toBe(true);
    expect(Object.isFrozen(loaded.sprayerConfigs[0]?.escapeRoute[0])).toBe(true);
    expect(Object.isFrozen(loaded.staticCrowdSpritePools.ordinary)).toBe(true);
    expect(Object.isFrozen(loaded.tuning)).toBe(true);
    expect(Object.isFrozen(loaded.tuning.staticCrowd)).toBe(true);
  });
});

// ── 2. 那些「比不了」的值，要明说 ────────────────────────────────────────────

describe("可比对 / 不可比对的边界写在数据里，不靠记忆", () => {
  /**
   * `exact` 是「每个值都能和源码对上」；`mixed` / `manual` 里有手抄的值。
   * 这个断言把边界钉死：将来有人新增文件忘了登记，或者偷偷改了标记，会当场失败。
   */
  const EXPECTED_EXACT = [
    "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
    "05-旁支/SYS-NPC/数据/bug-crowd-config.json",
    "05-旁支/SYS-NPC/数据/venue-crowd-regions.json",
    "05-旁支/SYS-NPC/数据/route-crowd-configs.json",
    "05-旁支/SYS-NPC/数据/static-crowd-regions.json",
    "05-旁支/SYS-NPC/数据/static-crowd-tuning.json",
    "05-旁支/SYS-NPC/数据/static-crowd-sprite-pools.json",
    "05-旁支/SYS-NPC/数据/static-npc-configs.json",
    "05-旁支/SYS-NPC/数据/sprayer-configs.json",
    "05-旁支/SYS-NPC/数据/static-npc-tuning.json",
    "05-旁支/SYS-NPC/数据/static-npc-presentation.json", // STATIC_NPC_RUNTIME_ASSETS 是导出的
    "05-旁支/SYS-NPC/数据/bug-crowd-presentation.json", // BUG_CROWD_* 七个都是导出的
  ];

  const EXPECTED_NOT_EXACT: Readonly<Record<string, ConfigVerification>> = {
    "05-旁支/SYS-NPC/数据/route-crowd-tuning.json": "mixed", // safeMargin 在源码里没导出
    "05-旁支/SYS-NPC/数据/sprayer-tuning.json": "mixed", // 两个 trigger* 写死在函数体里
    "05-旁支/SYS-NPC/数据/venue-crowd-tuning.json": "manual", // 两个 margin 在源码里没导出
    "05-旁支/SYS-NPC/数据/path-tuning.json": "manual", // 四个值都是模块私有常量
    // ── 下面 6 份来自 game/ 的适配器，不是 src/ ──────────────────────────
    "05-旁支/SYS-NPC/数据/static-crowd-presentation.json": "mixed", // 贴图清单导出了，半宽没有
    "05-旁支/SYS-NPC/数据/route-crowd-presentation.json": "mixed", // 贴图和偏移导出了，specialTextures 和铁轨带没有
    "05-旁支/SYS-NPC/数据/venue-crowd-presentation.json": "mixed", // 只有口号导出了，其余七个是模块私有
    "05-旁支/SYS-NPC/数据/sprayer-presentation.json": "mixed", // 帧规格能对，url 是从源码那句 new URL(...) 改写成运行期地址的
    "05-旁支/SYS-NPC/数据/dancing-crowd-presentation.json": "manual", // 写死在压缩成一行的函数体里
    "05-旁支/SYS-NPC/数据/static-crowd-disabled-regions.json": "manual", // 写死在调用处，原先无人记录
  };

  it("exact 的正好是这 12 个", async () => {
    const exact: string[] = [];
    for (const key of NPC_CONFIG_KEYS) {
      const file = await staticSource.read(key);
      if (file.meta.verified === "exact") exact.push(key);
    }
    expect(exact.sort()).toStrictEqual(EXPECTED_EXACT.sort());
  });

  it("not-exact 的正好是这 10 个，且理由已注明", async () => {
    const notExact: Record<string, ConfigVerification> = {};
    for (const key of NPC_CONFIG_KEYS) {
      const file = await staticSource.read(key);
      if (file.meta.verified !== "exact") notExact[key] = file.meta.verified;
      if (file.meta.verified !== "exact") {
        expect(file.meta.notes ?? []).not.toHaveLength(0);
      }
    }
    expect(notExact).toStrictEqual(EXPECTED_NOT_EXACT);
  });
});

// ── 3. 文件清单、形状声明、磁盘三边一致 ─────────────────────────────────────

describe("形状声明 / 磁盘两边一致", () => {
  it("磁盘上的文件和形状声明一一对应（没有漏登记的孤儿文件）", () => {
    const onDisk = readdirSync(DATA_DIR)
      .filter((name) => name.endsWith(".json"))
      .map((name) => `05-旁支/SYS-NPC/数据/${name}`)
      .sort();
    expect(onDisk).toStrictEqual([...NPC_CONFIG_KEYS].sort());
  });

  it("每个 meta.source 指的源码文件真的存在", async () => {
    for (const key of NPC_CONFIG_KEYS) {
      const file = await staticSource.read(key);
      const path = resolve(PROJECT_ROOT, file.meta.source);
      expect(existsSync(path), `${key} 的 source 指向不存在的 ${file.meta.source}`).toBe(
        true,
      );
    }
  });
});

// ── 4. 单位声明两边一致 ─────────────────────────────────────────────────────

/** 把一个声明归约到「它能约束的单位」。返回 undefined = 不做范围校验。 */
const unitOf = (spec: Spec): Unit | undefined => {
  switch (spec.kind) {
    case "number":
    case "point":
      return spec.unit;
    case "string":
      return "text";
    case "rangeMs":
      return "ms";
    case "rangeRatio":
      return "ratio";
    case "array":
    case "record":
      // record 的键名事先不定，但每个键的**值**规则是同一个，所以能归约。
      return unitOf(spec.of);
    case "boolean":
    case "object":
      return undefined;
  }
};

/** 顶层可能是数组（一份配置集合），要下钻到元素对象才拿得到字段。 */
const fieldsOf = (spec: Spec): Readonly<Record<string, Spec>> | undefined => {
  if (spec.kind === "object") return spec.fields;
  if (spec.kind === "array") return fieldsOf(spec.of);
  return undefined;
};

describe("meta.units 和形状声明里的单位说的一致", () => {
  for (const key of NPC_CONFIG_KEYS) {
    it(key, async () => {
      const file = await staticSource.read(key);
      const fields = fieldsOf(NPC_SHAPES[key] as Spec);
      expect(fields, `${key} 的声明应该能下钻到对象字段`).toBeDefined();
      for (const [field, declared] of Object.entries(file.meta.units ?? {})) {
        const spec = fields?.[field];
        expect(spec, `${key} 的 meta.units 声明了不存在的字段 ${field}`).toBeDefined();
        expect(
          unitOf(spec as Spec),
          `${key}.${field}：meta.units 说是 ${declared}，形状声明说是 ${unitOf(spec as Spec)}`,
        ).toBe(declared);
      }
    });
  }
});

// ── 5. 校验器真的会拦住错的东西 ─────────────────────────────────────────────

describe("校验器拦得住这些错", () => {
  /**
   * 造一个「配置来源」：**只替换目标那个文件**，其余照旧走真实来源。
   * 不能只认一个 key——loadNpcConfigs 是并行读全部 14 个文件的。
   */
  const fakeSource = (key: string, data: unknown, meta: unknown) => ({
    read: async (asked: string) =>
      asked === key
        ? { meta: meta as never, data }
        : staticSource.read(asked),
  });

  const goodMeta = {
    system: "npc",
    source: "src/npc/dancingCrowd.ts",
    sourceConstant: "DancingCrowdConfig（字段定义）",
    verified: "exact" as const,
  };

  const goodDancing = {
    minTileX: 114,
    minTileY: 100,
    maxTileX: 131,
    maxTileY: 102,
    npcCount: 8,
    depth: 500,
    scale: 0.9,
    frameRate: 6,
  };

  it("把像素坐标写进格字段 → 拦住（区间超限）", async () => {
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
          { ...goodDancing, minTileX: 1784 },
          goodMeta,
        ),
      ),
    ).rejects.toThrow(/超出 tile 的合法范围.*像素坐标写进了格字段/s);
  });

  it("枚举值写错 → 拦住", async () => {
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/venue-crowd-regions.json",
          [
            {
              id: "concert",
              type: "football-match",
              outline: [
                { x: 100, y: 100 },
                { x: 200, y: 200 },
              ],
              count: 30,
              spacing: 16,
            },
          ],
          { ...goodMeta, sourceConstant: "VENUE_CROWD_REGIONS" },
        ),
      ),
    ).rejects.toThrow(/不是合法取值/);
  });

  it("缺字段 → 拦住（默认值必须写出来）", async () => {
    const { scale: _dropped, ...withoutScale } = goodDancing;
    await expect(
      loadNpcConfigs(
        fakeSource("05-旁支/SYS-NPC/数据/dancing-crowd-config.json", withoutScale, goodMeta),
      ),
    ).rejects.toThrow(/scale 缺失/);
  });

  it("多字段 → 拦住（文件比代码新，或拼错了）", async () => {
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
          { ...goodDancing, npcCount2: 8 },
          goodMeta,
        ),
      ),
    ).rejects.toThrow(/不在声明里/);
  });

  it("区间反了 → 拦住", async () => {
    // 先确认「照原样给」是能过的——下面那次失败才一定是区间的问题，
    // 不是别的字段碰巧也错了。
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
          goodDancing,
          goodMeta,
        ),
      ),
    ).resolves.toBeDefined();

    const routeMeta = { ...goodMeta, sourceConstant: "RouteCrowdConfig（元素类型）" };
    await expect(
      loadNpcConfigs({
        read: async (key) =>
          key === "05-旁支/SYS-NPC/数据/route-crowd-configs.json"
            ? {
                meta: routeMeta as never,
                data: [
                  {
                    id: "x",
                    count: 1,
                    startTiles: [{ x: 1, y: 1 }],
                    endTiles: [{ x: 2, y: 2 }],
                    movementSpeed: 45,
                    speedVariation: { min: 1.25, max: 0.75 },
                    delay: { minMs: 0, maxMs: 0 },
                    afterDelay: { minMs: 0, maxMs: 0 },
                    goBack: false,
                    deleteAfterComplete: false,
                    randomPositions: true,
                    maxActiveInViewport: null,
                    pathRandomFactor: 0.8,
                    ignoreWalls: false,
                    completionExit: false,
                  },
                ],
              }
            : staticSource.read(key),
      }),
    ).rejects.toThrow(/区间是反的/);
  });

  it("NaN 混进来 → 拦住", async () => {
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
          { ...goodDancing, npcCount: Number.NaN },
          goodMeta,
        ),
      ),
    ).rejects.toThrow(/不许出现 NaN/);
  });

  it("meta 缺 verified → 拦住", async () => {
    const { verified: _dropped, ...metaWithoutVerified } = goodMeta;
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
          goodDancing,
          metaWithoutVerified,
        ),
      ),
    ).rejects.toThrow(/verified/);
  });

  it("单位写了个不认识的词 → 拦住", async () => {
    await expect(
      loadNpcConfigs(
        fakeSource(
          "05-旁支/SYS-NPC/数据/dancing-crowd-config.json",
          goodDancing,
          { ...goodMeta, units: { minTileX: "瓦片" } },
        ),
      ),
    ).rejects.toThrow(/不是合法单位/);
  });

  it("报错都用 ConfigError，好和代码 bug 区分开", async () => {
    await expect(
      loadNpcConfigs(
        fakeSource("05-旁支/SYS-NPC/数据/dancing-crowd-config.json", { ...goodDancing, depth: "500" }, goodMeta),
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

// ── 6. record 形状：键名不写死 ──────────────────────────────────────────────
//
// 「按人群组 id 查偏移量」这种字段，键名是换皮的人会自己加的。
// 这类字段必须用 record 而不是 object——用 object 的话，他加一组人群
// 就得来改 TypeScript，等于这份配置没抽出来。

describe("record 形状：键名不写死，值的规则照样管", () => {
  const spec: Spec = { kind: "record", of: { kind: "number", unit: "pixel" } };

  it("加一个没见过的键 → 通过", () => {
    expect(validate("偏移", spec, { "main-crowd": 16, "brand-new-group": 8 })).toStrictEqual({
      "main-crowd": 16,
      "brand-new-group": 8,
    });
  });

  it("值是文本 → 拦住", () => {
    expect(() => validate("偏移", spec, { "main-crowd": "16" })).toThrow(ConfigError);
  });

  it("值超出单位范围 → 拦住", () => {
    expect(() => validate("偏移", spec, { "main-crowd": 99999 })).toThrow(/超出 pixel 的合法范围/);
  });

  it("传了个数组 → 拦住（数组不是字典）", () => {
    expect(() => validate("偏移", spec, [16, 8])).toThrow(/应该是对象/);
  });

  it("和 object 的分界：多一个键，object 拦、record 放", () => {
    const strict: Spec = { kind: "object", fields: { "main-crowd": { kind: "number" } } };
    expect(() => validate("偏移", strict, { "main-crowd": 16, "brand-new-group": 8 })).toThrow(
      /不在声明里/,
    );
    expect(() => validate("偏移", spec, { "main-crowd": 16, "brand-new-group": 8 })).not.toThrow();
  });

  it("空字典 → 通过（一组都没有也是合法状态）", () => {
    expect(validate("偏移", spec, {})).toStrictEqual({});
  });
});

// ── 7. 呈现层：这一半也已经退场 ───────────────────────────────────────────
//
// 原先是「配置里那几份呈现表，和 game/ 下 7 个适配器里导出的常量一样吗」。
// 现在 game/ 那几份常量删掉了、改成读配置，旧值无从比起——
// 和上半节同一套办法：改由 tests/npc/ 下各自的测试按「读配置 + 行为对」验收。

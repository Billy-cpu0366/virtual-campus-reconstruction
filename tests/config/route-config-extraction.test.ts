/**
 * SYS-ROUTE 这四份配置的「机检」答案：形状声明、单位、磁盘三边对得上吗，
 * 校验器是不是真的拦得住写错的文件。
 *
 * 和 `npc-config-extraction.test.ts` 同一套路，只是这一块还没走到「删掉 src/ 原值」
 * 那一步，所以这里不比对数值——**数值的验收在接线之后换成「改一个数、刷新页面能看见」**。
 */
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDiskConfigSource,
  PROJECT_ROOT,
} from "../../config/工具/config-source-from-disk.js";
import {
  loadRouteConfigs,
  ROUTE_CONFIG_KEYS,
} from "../../config/骨架/05-旁支/SYS-ROUTE/逻辑/index.js";
import { ROUTE_SHAPES } from "../../config/骨架/05-旁支/SYS-ROUTE/逻辑/shapes.js";
import { validate, type Spec } from "../../config/骨架/公共/validate.js";
import { ConfigError } from "../../config/骨架/公共/config-source.js";
import type { Unit } from "../../config/骨架/公共/config-source.js";

const DATA_DIR = resolve(PROJECT_ROOT, "config/default/05-旁支/SYS-ROUTE/数据");

/** 测试不起服务器，所以用磁盘那个实现——和线上的 fetch 实现走同一条后处理。 */
const staticSource = createDiskConfigSource();

const loaded = await loadRouteConfigs(staticSource);

// ── 1. 读回来的东西是对的 ───────────────────────────────────────────────────

describe("读回来的值", () => {
  it("火车那一份，10 个标量和 4 段挡路区间都在", () => {
    expect(loaded.train).toStrictEqual({
      startX: 2480,
      endX: 480,
      y: 310,
      exitDistance: 4000,
      entryDurationMs: 5000,
      holdDurationMs: 3000,
      departureDurationMs: 9000,
      tileSize: 16,
      collisionTop: 323,
      collisionBottom: 359,
      collisionXZones: [
        { left: 0, right: 365 },
        { left: 360, right: 720 },
        { left: 715, right: 1078 },
        { left: 1073, right: 1435 },
      ],
    });
  });

  it("挡路的相邻两段是故意重叠的，不是首尾相接", () => {
    // 改成首尾相接会在交接处露出一格宽的缝——这条断言就是钉死别顺手「修正」它。
    const zones = loaded.train.collisionXZones;
    for (let index = 1; index < zones.length; index += 1) {
      const previous = zones[index - 1];
      const current = zones[index];
      expect(previous?.right).toBeGreaterThan(current?.left ?? Number.NaN);
    }
  });

  it("火车显示缩放是 1.025（源码那串算式算出来的值）", () => {
    expect(loaded.presentation.train.presentationScale).toBe(1.025);
    expect(loaded.presentation.train.presentationScale).toBe((1 / 3) * 0.75 * 4.1);
  });

  it("直升机停在像素 (504, 1288)，也就是网格 (31, 80)", () => {
    expect(loaded.vehicle.helicopter.position).toStrictEqual({ x: 504, y: 1288 });
    expect(loaded.vehicle.helicopter.position.x).toBe(31 * 16 + 8);
    expect(loaded.vehicle.helicopter.position.y).toBe(80 * 16 + 8);
  });

  it("三辆警车的位置和帧号", () => {
    expect(loaded.vehicle.police.positions).toStrictEqual([
      { x: 1704, y: 1331, frame: 3 },
      { x: 1800, y: 1315, frame: 6 },
      { x: 1752, y: 1347, frame: 4 },
    ]);
    // 警车的 y 比「格 × 16 + 8」少 5 像素，那是源码里写死的位置修正。
    expect(loaded.vehicle.police.positions[0]?.y).toBe(83 * 16 + 8 - 5);
    expect(loaded.vehicle.police.positions[1]?.y).toBe(82 * 16 + 8 - 5);
    expect(loaded.vehicle.police.positions[2]?.y).toBe(84 * 16 + 8 - 5);
  });

  it("五片桨叶的角度，片数就是数组长度", () => {
    expect(loaded.vehicle.helicopter.bladeAnglesDegrees).toStrictEqual([
      0, 72, 144, 216, 288,
    ]);
  });

  it("五张贴图各自的 key 和地址", () => {
    expect(loaded.presentation.vehicle.policeBody).toStrictEqual({
      key: "car-police",
      url: "/sprites/cars/car-police.webp",
      frameWidth: 84,
      frameHeight: 84,
    });
    expect(loaded.presentation.vehicle.helicopterRotorMain).toStrictEqual({
      key: "npc-helicopter-rotor-main",
      url: "/sprites/npc-helicopter-rotor-main.webp",
    });
  });
});

describe("配置对象每一层都冻住了", () => {
  it("数组、对象、嵌套的点和尺寸都冻住了", () => {
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.train)).toBe(true);
    expect(Object.isFrozen(loaded.train.collisionXZones)).toBe(true);
    expect(Object.isFrozen(loaded.train.collisionXZones[0])).toBe(true);
    expect(Object.isFrozen(loaded.vehicle)).toBe(true);
    expect(Object.isFrozen(loaded.vehicle.helicopter)).toBe(true);
    expect(Object.isFrozen(loaded.vehicle.helicopter.position)).toBe(true);
    expect(Object.isFrozen(loaded.vehicle.helicopter.bladeAnglesDegrees)).toBe(true);
    expect(Object.isFrozen(loaded.vehicle.police.positions)).toBe(true);
    expect(Object.isFrozen(loaded.vehicle.police.positions[0])).toBe(true);
    expect(Object.isFrozen(loaded.presentation)).toBe(true);
    expect(Object.isFrozen(loaded.presentation.vehicle)).toBe(true);
  });
});

// ── 2. 那几份「值从哪儿来」的标记要准 ──────────────────────────────────────

describe("四份文件的出处标记", () => {
  /**
   * `exact` = 每个值都能和源码的导出逐一对上。
   * 这个断言把边界钉死：将来有人偷偷改了标记，或者新增文件忘了登记，会当场失败。
   *
   * 这四份全都是 `exact`——来源都是导出的模块常量，能逐字段比对。
   * 火车那两份来自 `src/route/train.ts`，车辆那两份来自 `game/PhaserVehicleRuntime.ts`。
   */
  const EXPECTED_EXACT: readonly string[] = [
    "05-旁支/SYS-ROUTE/数据/train-config.json",
    "05-旁支/SYS-ROUTE/数据/train-presentation.json",
    "05-旁支/SYS-ROUTE/数据/vehicle-config.json",
    "05-旁支/SYS-ROUTE/数据/vehicle-presentation.json",
  ];

  it("exact 的正好是这 4 个", async () => {
    const exact: string[] = [];
    for (const key of ROUTE_CONFIG_KEYS) {
      const file = await staticSource.read(key);
      if (file.meta.verified === "exact") exact.push(key);
    }
    expect(exact.sort()).toStrictEqual([...EXPECTED_EXACT].sort());
    expect(ROUTE_CONFIG_KEYS).toHaveLength(EXPECTED_EXACT.length);
  });

  it("不是 exact 的一律要写清理由（现在一个都没有）", async () => {
    for (const key of ROUTE_CONFIG_KEYS) {
      const file = await staticSource.read(key);
      if (file.meta.verified === "exact") continue;
      expect(
        file.meta.notes ?? [],
        `${key} 标了非 exact，却没写为什么`,
      ).not.toHaveLength(0);
    }
  });

  it("每份都写了 meta.source，而且那个文件真的存在", async () => {
    for (const key of ROUTE_CONFIG_KEYS) {
      const file = await staticSource.read(key);
      expect(file.meta.system).toBe("route");
      const path = resolve(PROJECT_ROOT, file.meta.source);
      expect(
        existsSync(path),
        `${key} 的 source 指向不存在的 ${file.meta.source}`,
      ).toBe(true);
    }
  });
});

// ── 3. 文件清单、形状声明、磁盘三边一致 ─────────────────────────────────────

describe("形状声明 / 磁盘两边一致", () => {
  it("磁盘上的文件和形状声明一一对应（没有漏登记的孤儿文件）", () => {
    const onDisk = readdirSync(DATA_DIR)
      .filter((name) => name.endsWith(".json"))
      .map((name) => `05-旁支/SYS-ROUTE/数据/${name}`)
      .sort();
    expect(onDisk).toStrictEqual([...ROUTE_CONFIG_KEYS].sort());
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
  for (const key of ROUTE_CONFIG_KEYS) {
    it(key, async () => {
      const file = await staticSource.read(key);
      const fields = fieldsOf(ROUTE_SHAPES[key] as Spec);
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
   * 不能只认一个 key——loadRouteConfigs 是并行读全部 4 个文件的。
   */
  const fakeSource = (key: string, data: unknown, meta: unknown) => ({
    read: async (asked: string) =>
      asked === key ? { meta: meta as never, data } : staticSource.read(asked),
  });

  const TRAIN_KEY = "05-旁支/SYS-ROUTE/数据/train-config.json";
  const goodMeta = {
    system: "route",
    source: "src/route/train.ts",
    sourceConstant: "TRAIN_START_X 等模块常量",
    verified: "exact" as const,
  };
  const goodTrain = {
    startX: 2480,
    endX: 480,
    y: 310,
    exitDistance: 4000,
    entryDurationMs: 5000,
    holdDurationMs: 3000,
    departureDurationMs: 9000,
    tileSize: 16,
    collisionTop: 323,
    collisionBottom: 359,
    collisionXZones: [{ left: 0, right: 365 }],
  };

  it("照原样给 → 通过（下面几次失败才一定是那一处的问题）", async () => {
    await expect(
      loadRouteConfigs(fakeSource(TRAIN_KEY, goodTrain, goodMeta)),
    ).resolves.toBeDefined();
  });

  it("像素值大到不像像素 → 拦住（区间超限）", async () => {
    await expect(
      loadRouteConfigs(
        fakeSource(TRAIN_KEY, { ...goodTrain, endX: 3000 }, goodMeta),
      ),
    ).rejects.toThrow(/超出 pixel 的合法范围/);
  });

  it("缺字段 → 拦住（默认值必须写出来）", async () => {
    const { tileSize: _dropped, ...withoutTileSize } = goodTrain;
    await expect(
      loadRouteConfigs(fakeSource(TRAIN_KEY, withoutTileSize, goodMeta)),
    ).rejects.toThrow(/tileSize 缺失/);
  });

  it("多字段 → 拦住（文件比代码新，或拼错了）", async () => {
    await expect(
      loadRouteConfigs(
        fakeSource(TRAIN_KEY, { ...goodTrain, startX2: 2480 }, goodMeta),
      ),
    ).rejects.toThrow(/不在声明里/);
  });

  it("NaN 混进来 → 拦住", async () => {
    await expect(
      loadRouteConfigs(
        fakeSource(TRAIN_KEY, { ...goodTrain, y: Number.NaN }, goodMeta),
      ),
    ).rejects.toThrow(/不许出现 NaN/);
  });

  it("报错都用 ConfigError，好和代码 bug 区分开", async () => {
    await expect(
      loadRouteConfigs(
        fakeSource(TRAIN_KEY, { ...goodTrain, y: "310" }, goodMeta),
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("meta 缺 verified → 拦住", async () => {
    const { verified: _dropped, ...metaWithoutVerified } = goodMeta;
    await expect(
      loadRouteConfigs(fakeSource(TRAIN_KEY, goodTrain, metaWithoutVerified)),
    ).rejects.toThrow(/verified/);
  });

  it("车辆那份的键名是代码写死的，加一个角色 → 拦住", async () => {
    await expect(
      loadRouteConfigs({
        read: async (key) =>
          key === "05-旁支/SYS-ROUTE/数据/vehicle-presentation.json"
            ? {
                meta: {
                  system: "route",
                  source: "game/PhaserVehicleRuntime.ts",
                  sourceConstant: "VEHICLE_RUNTIME_ASSETS",
                  verified: "exact",
                } as never,
                data: {
                  helicopterBody: {
                    key: "a",
                    url: "/a.webp",
                    frameWidth: 84,
                    frameHeight: 84,
                  },
                  helicopterRotorBack: { key: "b", url: "/b.webp" },
                  helicopterRotorMain: { key: "c", url: "/c.webp" },
                  helicopterHighResolution: { key: "d", url: "/d.webp" },
                  policeBody: {
                    key: "e",
                    url: "/e.webp",
                    frameWidth: 84,
                    frameHeight: 84,
                  },
                  brandNewRole: { key: "f", url: "/f.webp" },
                },
              }
            : staticSource.read(key),
      }),
    ).rejects.toThrow(/不在声明里/);
  });

  it("整张图和切片图是两种规格：多写、少写都要拦住", () => {
    const asset = ROUTE_SHAPES[
      "05-旁支/SYS-ROUTE/数据/vehicle-presentation.json"
    ] as Spec;
    const fields = fieldsOf(asset);
    const whole = fields?.["helicopterRotorMain"] as Spec;
    const sheet = fields?.["helicopterBody"] as Spec;

    // 整张图：只有 key 和 url，多写 frameWidth 就是写错了。
    expect(() =>
      validate("贴图", whole, { key: "a", url: "/a.webp" }),
    ).not.toThrow();
    expect(() =>
      validate("贴图", whole, { key: "a", url: "/a.webp", frameWidth: 84 }),
    ).toThrow(/不在声明里/);

    // 切片图：frameWidth / frameHeight 是必填的，少写动画就加载不出来。
    expect(() =>
      validate("贴图", sheet, {
        key: "a",
        url: "/a.webp",
        frameWidth: 84,
        frameHeight: 84,
      }),
    ).not.toThrow();
    expect(() =>
      validate("贴图", sheet, { key: "a", url: "/a.webp" }),
    ).toThrow(/frameWidth 缺失/);
    expect(() =>
      validate("贴图", sheet, {
        key: "a",
        url: "/a.webp",
        frameWidth: -1,
        frameHeight: 84,
      }),
    ).toThrow(/超出 pixel 的合法范围/);
  });
});

// ── 6. 偏移量可以是负数 ─────────────────────────────────────────────────────

describe("偏移量允许负数，位置不允许", () => {
  it("主旋翼偏移 y = -20 能过（它不是世界坐标）", () => {
    expect(loaded.vehicle.helicopter.mainRotorOffset.y).toBe(-20);
    expect(loaded.vehicle.helicopter.tailRotorOffsetEast.x).toBe(-36);
  });

  it("换成世界坐标的字段写负数 → 拦住", async () => {
    const vehicleKey = "05-旁支/SYS-ROUTE/数据/vehicle-config.json";
    const raw = (await staticSource.read(vehicleKey)).data as Record<string, unknown>;
    await expect(
      loadRouteConfigs({
        read: async (key) =>
          key === vehicleKey
            ? {
                meta: {
                  system: "route",
                  source: "game/PhaserVehicleRuntime.ts",
                  sourceConstant: "VEHICLE_RUNTIME_ASSETS",
                  verified: "exact",
                } as never,
                data: {
                  ...raw,
                  police: {
                    ...(raw["police"] as Record<string, unknown>),
                    positions: [{ x: -100, y: 1331, frame: 3 }],
                  },
                },
              }
            : staticSource.read(key),
      }),
    ).rejects.toThrow(/超出 pixel 的合法范围/);
  });

  it("桨叶角度用的是无单位数字（0 也是合法值）", () => {
    const vehicle = ROUTE_SHAPES["05-旁支/SYS-ROUTE/数据/vehicle-config.json"] as Spec;
    const heli = fieldsOf(vehicle)?.["helicopter"] as Spec;
    expect(fieldsOf(heli)?.["bladeAnglesDegrees"]).toStrictEqual({
      kind: "array",
      of: { kind: "number" },
    });
  });
});

// ── 7. 形状声明的类型闸门 ───────────────────────────────────────────────────

describe("形状声明的键和加载器的键是同一批", () => {
  it("ROUTE_CONFIG_KEYS 就是 ROUTE_SHAPES 的键", () => {
    expect([...ROUTE_CONFIG_KEYS].sort()).toStrictEqual(
      Object.keys(ROUTE_SHAPES).sort(),
    );
  });

  it("读出来的对象就是 RouteConfigs 那三组", () => {
    expect(Object.keys(loaded).sort()).toStrictEqual([
      "presentation",
      "train",
      "vehicle",
    ]);
    expect(Object.keys(loaded.presentation).sort()).toStrictEqual([
      "train",
      "vehicle",
    ]);
  });
});

/**
 * 配置校验：拿一份「形状声明」去比一份实际数据。
 *
 * 校验什么、为什么：
 *   1. **字段齐全**——缺字段说明文件是残缺的，别让它带着 undefined 跑下去。
 *   2. **类型正确**——字符串当数字用，算出来的坐标是 NaN，人不会消失、会飘到天边。
 *      这类错误不报，只是在几秒后表现为「有个 NPC 不见了」，极难查。
 *   3. **枚举合法**——`"crowdUp"` 和 `"crowd_up"` 差一个字符，行为完全不同（静默）。
 *   4. **单位范围**——格单位的值必须 0..140，像素单位必须 0..2240。
 *      这条专门拦「单位搞反了」：把像素坐标当格坐标写进 startTiles，会得到
 *      一个 1784 格的坐标，那是地图外面 12 倍远的地方。
 *   5. **不许有声明外的字段**——多出来的字段说明文件比代码新（或者拼错了），
 *      两种情况都该当场停下。
 *
 * `object` 和 `record` 的区别，用错会让换皮的人改不动文件：
 *   `object` 字段名是写死的（`{minSpacing, coffeeMinSpacing}`），多一个键就报错；
 *   `record` 键名事先不定（`{"main-crowd": 16, "beach_crowd_walk": 8}`），
 *           有几个键都行，每个键的值按同一个规则校验。
 * 判据：这个键名是**代码定死的**，还是**换皮的人会自己加一个**？
 * 后者必须用 `record`——否则他加一条就得来改 TypeScript，等于没抽出配置。
 */
import { ConfigError, type Unit } from "./config-source.js";

/** 数值单位的合法区间。没列的单位（ratio / text）不做区间检查。 */
const UNIT_RANGES: Partial<Record<Unit, { readonly min: number; readonly max: number }>> = {
  tile: { min: 0, max: 140 }, // 世界 140×140 格
  pixel: { min: 0, max: 2240 }, // 世界 2240×2240 像素（140 × 16）
  ms: { min: 0, max: Number.POSITIVE_INFINITY },
  pxPerSec: { min: 0, max: Number.POSITIVE_INFINITY },
  count: { min: 0, max: Number.POSITIVE_INFINITY },
  perFrame: { min: 0, max: Number.POSITIVE_INFINITY },
};

export type Spec =
  | {
      readonly kind: "number";
      readonly unit?: Unit;
      readonly optional?: boolean;
      /**
       * 允许 `null`。用于「有限制 / 不限」这种二选一的字段——
       * JSON 没有 `undefined`，源码里的 `undefined` 导出时写成了 `null`
       * （见 routeCrowd 的 maxActiveInViewport）。加载器负责把 `null` 还原成 `undefined`。
       */
      readonly nullable?: boolean;
    }
  | {
      readonly kind: "string";
      readonly optional?: boolean;
      readonly oneOf?: readonly string[];
    }
  | { readonly kind: "boolean"; readonly optional?: boolean }
  /** `{x, y}` 点。unit 决定两个分量各自的范围。 */
  | { readonly kind: "point"; readonly unit: Unit; readonly optional?: boolean }
  /** `{minMs, maxMs}` 毫秒区间。 */
  | { readonly kind: "rangeMs"; readonly optional?: boolean }
  /** `{min, max}` 乘数区间。 */
  | { readonly kind: "rangeRatio"; readonly optional?: boolean }
  | { readonly kind: "array"; readonly of: Spec; readonly optional?: boolean }
  /** 键名事先不定的字典，例如「按人群组 id 查偏移量」。每个键的值都按 `of` 校验。 */
  | { readonly kind: "record"; readonly of: Spec; readonly optional?: boolean }
  | {
      readonly kind: "object";
      readonly fields: Readonly<Record<string, Spec>>;
      readonly optional?: boolean;
    };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const describe = (spec: Spec): string => {
  switch (spec.kind) {
    case "number":
      return spec.unit === undefined ? "数字" : `数字(${spec.unit})`;
    case "string":
      return spec.oneOf === undefined ? "文本" : `文本(${spec.oneOf.join("|")})`;
    case "boolean":
      return "真假";
    case "point":
      return `点(${spec.unit})`;
    case "rangeMs":
      return "毫秒区间";
    case "rangeRatio":
      return "乘数区间";
    case "array":
      return `${describe(spec.of)}的数组`;
    case "record":
      return `${describe(spec.of)}的字典`;
    case "object":
      return "对象";
  }
};

/** 单个数：类型 → 有限性 → 区间。 */
const checkNumber = (
  path: string,
  value: unknown,
  unit: Unit | undefined,
): number => {
  if (typeof value !== "number") {
    throw new ConfigError(
      `${path} 应该是${unit === undefined ? "数字" : `数字(${unit})`}，实际是 ${typeof value}`,
    );
  }
  if (!Number.isFinite(value)) {
    throw new ConfigError(`${path} 是 ${value}——配置里不许出现 NaN / Infinity`);
  }
  if (unit !== undefined) {
    const range = UNIT_RANGES[unit];
    if (range !== undefined && (value < range.min || value > range.max)) {
      const hint =
        unit === "tile" && value > range.max
          ? "——数值大到不像格坐标，是不是把像素坐标写进了格字段？"
          : unit === "pixel" && value < 16
          ? "——数值小得像格坐标，是不是把格坐标写进了像素字段？"
          : "";
      throw new ConfigError(
        `${path} = ${value} 超出 ${unit} 的合法范围 ${range.min}..${range.max}${hint}`,
      );
    }
  }
  return value;
};

/**
 * 按声明校验一份数据。通过就返回原数据（不改动），不通过就抛 ConfigError。
 * 错误信息里带字段路径，方便直接定位到 JSON 的哪一行。
 */
export function validate<T>(path: string, spec: Spec, value: unknown): T {
  const optional = "optional" in spec && spec.optional === true;
  if (value === null && spec.kind === "number" && spec.nullable === true) {
    return value as T;
  }
  if (value === undefined || value === null) {
    if (optional) return value as T;
    throw new ConfigError(`${path} 缺失（这个字段是必填的；源码里的默认值必须在文件里写出来）`);
  }

  switch (spec.kind) {
    case "number":
      return checkNumber(path, value, spec.unit) as T;

    case "string": {
      if (typeof value !== "string") {
        throw new ConfigError(`${path} 应该是${describe(spec)}，实际是 ${typeof value}`);
      }
      if (spec.oneOf !== undefined && !spec.oneOf.includes(value)) {
        throw new ConfigError(
          `${path} = ${JSON.stringify(value)} 不是合法取值，只能是 ${spec.oneOf
            .map((item) => JSON.stringify(item))
            .join(" / ")}`,
        );
      }
      return value as T;
    }

    case "boolean":
      if (typeof value !== "boolean") {
        throw new ConfigError(`${path} 应该是真假值，实际是 ${typeof value}`);
      }
      return value as T;

    case "point": {
      if (!isObject(value)) throw new ConfigError(`${path} 应该是 {x, y} 对象`);
      const keys = Object.keys(value).sort().join(",");
      if (keys !== "x,y") {
        throw new ConfigError(`${path} 的键应该是 x 和 y，实际是 ${keys}`);
      }
      checkNumber(`${path}.x`, value["x"], spec.unit);
      checkNumber(`${path}.y`, value["y"], spec.unit);
      return value as T;
    }

    case "rangeMs":
    case "rangeRatio": {
      const minKey = spec.kind === "rangeMs" ? "minMs" : "min";
      const maxKey = spec.kind === "rangeMs" ? "maxMs" : "max";
      if (!isObject(value)) {
        throw new ConfigError(`${path} 应该是 {${minKey}, ${maxKey}} 对象`);
      }
      const unit: Unit | undefined = spec.kind === "rangeMs" ? "ms" : undefined;
      const min = checkNumber(`${path}.${minKey}`, value[minKey], unit);
      const max = checkNumber(`${path}.${maxKey}`, value[maxKey], unit);
      if (min > max) {
        throw new ConfigError(`${path} 的下限 ${min} 大于上限 ${max}——区间是反的`);
      }
      return value as T;
    }

    case "array": {
      if (!Array.isArray(value)) throw new ConfigError(`${path} 应该是数组`);
      value.forEach((item, index) => {
        validate(`${path}[${index}]`, spec.of, item);
      });
      return value as T;
    }

    case "record": {
      if (!isObject(value)) {
        throw new ConfigError(`${path} 应该是对象（键名不定，值的规则由声明给定）`);
      }
      for (const [key, item] of Object.entries(value)) {
        validate(`${path}.${key}`, spec.of, item);
      }
      return value as T;
    }

    case "object": {
      if (!isObject(value)) throw new ConfigError(`${path} 应该是对象`);
      for (const [key, fieldSpec] of Object.entries(spec.fields)) {
        validate(path === "" ? key : `${path}.${key}`, fieldSpec, value[key]);
      }
      for (const key of Object.keys(value)) {
        if (!(key in spec.fields)) {
          throw new ConfigError(
            `${path === "" ? key : `${path}.${key}`} 不在声明里——文件比代码新，或者字段名拼错了`,
          );
        }
      }
      return value as T;
    }
  }
}

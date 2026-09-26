/**
 * 把一份「刚从文件里读出来的生数据」整理成可信的配置：查信封、查 meta、冻住。
 *
 * **为什么这是一个独立模块、而不是写在某个来源实现里**：
 * 一开始它写在 static-config-source.ts 里。那意味着「校验 meta」变成了那个实现的
 * 内部行为——换个来源（第二小步的运行时 fetch、再往后后台下发的配置）就绕过去了，
 * 而且不会有任何报错，只会静默地少一层保护。
 * 校验是**契约**，不是某个实现的细节，所以它得住在加载路径上，任何来源都要过。
 *
 * 冻结同理：现有测试大量断言 `Object.isFrozen`，这个保证不该取决于配置从哪来。
 * 重复冻结是幂等的，所以来源和加载器都调用一次没有代价。
 */
import {
  ConfigError,
  type ConfigMeta,
  type ConfigVerification,
  type RawConfigFile,
  type Unit,
} from "./config-source.js";
import { deepFreeze } from "./deep-freeze.js";

const VERIFICATIONS: readonly ConfigVerification[] = ["exact", "mixed", "manual"];

/** `meta.units` 的合法取值。必须和 `config-source.ts` 的 Unit 类型保持一致。 */
const UNIT_VALUES: readonly Unit[] = [
  "tile",
  "pixel",
  "ms",
  "pxPerSec",
  "ratio",
  "count",
  "perFrame",
  "text",
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (
  path: string,
  source: Record<string, unknown>,
  key: string,
): string => {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) {
    const detail = value === undefined ? "缺失" : `是 ${JSON.stringify(value)}`;
    throw new ConfigError(`${path}.${key} 应该是非空文本，实际${detail}`);
  }
  return value;
};

/**
 * meta 只有五个字段，而且 `units` 的**键名是各配置自己的字段名**（预列举不出来），
 * 所以直接手写校验，比造一个「允许任意键」的通用声明干净。
 */
const checkMeta = (path: string, value: unknown): ConfigMeta => {
  if (!isPlainObject(value)) {
    throw new ConfigError(`${path} 缺 meta——不知道它是从哪来的`);
  }
  requireString(path, value, "system");
  requireString(path, value, "source");
  requireString(path, value, "sourceConstant");

  const verified = value["verified"];
  if (!VERIFICATIONS.includes(verified as ConfigVerification)) {
    throw new ConfigError(
      `${path}.verified 应该是 ${VERIFICATIONS.join(" / ")} 之一（说明这份文件的值可不可信），实际是 ${JSON.stringify(verified)}`,
    );
  }

  const units = value["units"];
  if (units !== undefined) {
    if (!isPlainObject(units)) {
      throw new ConfigError(`${path}.units 应该是「字段名 → 单位」的对象`);
    }
    for (const [field, unit] of Object.entries(units)) {
      if (typeof unit !== "string" || !UNIT_VALUES.includes(unit as Unit)) {
        throw new ConfigError(
          `${path}.units.${field} = ${JSON.stringify(unit)} 不是合法单位，只能是 ${UNIT_VALUES.join(" / ")}`,
        );
      }
    }
  }

  const notes = value["notes"];
  if (notes !== undefined) {
    if (!Array.isArray(notes) || notes.some((note) => typeof note !== "string")) {
      throw new ConfigError(`${path}.notes 应该是文本数组`);
    }
  }

  return value as unknown as ConfigMeta;
};

/**
 * 生数据（`{meta, data}`）→ 可信配置。不通过就抛 ConfigError。
 *
 * 注意它**不做字段级校验**——那要知道每个配置的形状，属于各系统自己的事
 * （见 05-旁支/SYS-NPC/逻辑/shapes.ts）。这里只管「文件格式对不对」。
 */
export const normalizeConfigFile = (
  key: string,
  raw: unknown,
): RawConfigFile => {
  if (!isPlainObject(raw)) {
    throw new ConfigError(`${key} 的外层应该是 {meta, data} 对象`);
  }
  if (!("data" in raw)) {
    throw new ConfigError(`${key} 缺 data`);
  }
  const meta = checkMeta(`${key}.meta`, raw["meta"]);
  return deepFreeze({ meta, data: raw["data"] });
};

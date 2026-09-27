/**
 * 「配置从哪来」的接口。
 *
 * 这里只定形状，不实现。实现放在同目录的 `static-config-source.ts`。
 *
 * 为什么值得单独立一个文件：读配置的方式以后会变（现在是编译期打包进来，
 * 将来是运行时 fetch，再往后可能带一个后台下发）。变的是**怎么读**，
 * 不变的是**读出来的东西长什么样**。把这句话固化成接口，换读法时
 * 上面的调用方一行都不用改。
 *
 * 注意 `read()` 返回 Promise：即使今天读的是打包进来的 JSON、同步就能拿到，
 * 接口也必须是异步的。否则第二小步换成 fetch 时，所有调用方都要从
 * 「拿值」改成「等值」，那就是一次全量返工——而现在只是一次实现替换。
 */

/**
 * 字段单位。加载器靠它做取值范围校验（见 config/文档/配置格式规范.md 第四节）。
 *
 * 单位必须是枚举、不能是自由文本——「世界像素（不是格）」这种话是给人读的，
 * 机器读不了，也就没法拿它当校验依据。人话说明写在 meta.notes 里。
 */
export type Unit =
  | "tile" // 格，必须落在 0..140
  | "pixel" // 世界像素，必须落在 0..2240
  | "ms" // 毫秒，必须 >= 0
  | "pxPerSec" // 像素/秒，必须 >= 0
  | "ratio" // 乘数/比例，无单位
  | "count" // 个数，必须 >= 0
  | "perFrame" // 每帧多少，必须 >= 0
  | "text"; // 文本（贴图 key 之类）

/**
 * 这份文件里的值可不可信。
 *
 *   `exact`  —— 每个值都是从源码的导出直接取的，能逐字段比对
 *   `mixed`  —— 一部分能比对，一部分在源码里没导出、是手抄的
 *   `manual` —— 全部是手抄的，比对不了
 *
 * 为什么要标：手抄的值和抽出来的值**长得一模一样**，不标就会以为
 * 「这份已经抽干净了」。标出来才知道哪儿还有活没干完。
 */
export type ConfigVerification = "exact" | "mixed" | "manual";

/** 配置文件的出处说明。不是装饰——对不上时靠它回去查原始代码。 */
export interface ConfigMeta {
  readonly system: string;
  readonly source: string;
  readonly sourceConstant: string;
  readonly verified: ConfigVerification;
  /** 字段名 → 单位。没列的字段不做范围校验。 */
  readonly units?: Readonly<Record<string, Unit>>;
  /** 人话说明。单位、坑、已知缺口都写这儿。 */
  readonly notes?: readonly string[];
}

/** 一个配置文件读出来的原始形态：出处 + 数据。数据还没做任何解释。 */
export interface RawConfigFile {
  readonly meta: ConfigMeta;
  readonly data: unknown;
}

/**
 * 配置来源。`key` = **相对 `config/<集名>/` 的真实路径**，
 * 例如 `"05-旁支/SYS-NPC/数据/dancing-crowd-config.json"`。
 * 换哪一套校园都不改 key——换的是外面那层根地址（见 `config-location.ts`）。
 *
 * 为什么用真实路径、不另造一套简写：读法是会换的（打包 → fetch → 后台下发）。
 * 只要是真实路径，任何读法都能直接拿它去取文件，不需要在中间加一层「翻译」。
 * 多一层翻译，就多一个两边对不上的地方。
 */
export interface ConfigSource {
  read(key: string): Promise<RawConfigFile>;
}

/** 配置读不动时抛这个，别抛裸 Error——调用方要能分辨「配置问题」和「代码 bug」。 */
export class ConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConfigError";
  }
}

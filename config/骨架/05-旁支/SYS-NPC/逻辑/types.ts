/**
 * SYS-NPC 的配置类型。
 *
 * **这个文件从头到尾都是转发**：类型定义在 src/npc/ 里，这里只把「配置用得到的
 * 那些」挑出来重新导出。这样做是有意的，而且**会一直是转发**，不会变成定义。
 *
 * 为什么不能搬过来：类型是 src/ 的代码要用的东西，而 src/ 不许反过来认 config/
 * ——反过来认，config/ 就成了 src/ 的依赖，删掉 config/ 源码就编不过，那它就不是
 * 「配置」而是「源码的一部分」了。同理，config/ 的类型也只能从 src/ 转出来，
 * 不能自己抄一遍：抄一遍就有两个真相，改一边忘一边必出事。
 *
 * 所以规矩是：**一个类型只有一个出处，就是 src/。** 这个文件只是换个名字再导出。
 */
export type {
  /** 静态 NPC：站着不动的特殊角色 */
  StaticNpcConfig,
  StaticNpcFrameDuration,
  /** 静态人群：散布在区域里的路人 */
  StaticCrowdRegion,
  StaticCrowdRegionType,
  StaticCrowdPoint,
  StaticCrowdSpritePools,
  /** 路线人群：在路上走的 */
  RouteCrowdConfig,
  RouteCrowdTile,
  RouteCrowdRange,
  RouteCrowdDelayRange,
  /** 虫子群 */
  BugCrowdConfig,
  BugCrowdRange,
  BugCrowdPoint,
  /** 跳舞人群 */
  DancingCrowdConfig,
  DancingDirection,
  /** 场馆人群 */
  VenueRegion,
  VenuePoint,
  /** 喷水器 */
  SprayerConfig,
  SprayerPoint,
} from "../../../../../src/npc/index.js";

// ── 呈现层配置的类型（不是转发，是在这里定义的）────────────────────────────
//
// 上面那一批是 `src/npc/` 里已经有的类型，这里只转发。
// 下面这一批**在 src/ 里没有对应物**——它们的来源是 `game/` 下那几个
// Phaser 适配器，那儿的值是 `as const` 字面量或模块私有常量，没有导出的
// interface 可以转发。
//
// 所以就在这里定义。定义时要**照着源码里的字面量写**，不能凭印象：
// 结构对不上，接线时编译会炸；少写一个字段，校验就漏掉一个。

/** 静态 NPC 的贴图规格：一张大图里每小格多大、一共几帧、从哪儿下载。 */
export interface StaticNpcPresentationAsset {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  /**
   * 这张图上一共几帧，也就是动画循环播几帧。
   *
   * 原先这个数写死在 `game/PhaserStaticNpcRuntime.ts` 的 `animationFrames()` 里
   * （`Array.from({ length: 16 })`）。换一张帧数不同的图，人照样出现，只是动画
   * 播不全——**不报错，看着不对**，所以得有个地方能改。
   */
  readonly frameCount: number;
}

/** 喷水器的贴图规格。比静态 NPC 多三个字段：第几帧到第几帧、每秒放几帧。 */
export interface SprayerPresentationAsset {
  readonly key: string;
  /**
   * 网页上的取图地址，和其它几份呈现层表一样。
   *
   * 原先这里记的是 `sourceFile`（项目根目录下的文件路径），由
   * `PhaserSprayerRuntime` 用 `new URL(\`../${sourceFile}\`, import.meta.url)` 现拼
   * 地址。**打包器认不出那种写法**——动态拼出来的路径它静态分析不了，会把它换成
   * 一张「根目录下有哪些文件」的查表，而那张表里没有贴图，于是地址取到空值，
   * 图片一次都没请求，Phaser 登记不到贴图，整个动态世界起不来。改成运行期地址后
   * 和其它系统走同一条路。
   */
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly startFrame: number;
  readonly endFrame: number;
  /** 这张图上的动画每秒放几帧。两张图各一份——站着喷水和跑动本来就是两套动画。 */
  readonly frameRate: number;
}

/** 虫子群「长什么样」。`facingFrameStart` 的键是方向名，值是起始帧号。 */
export interface BugCrowdPresentation {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly frameRate: number;
  readonly displayScale: number;
  readonly origin: { readonly x: number; readonly y: number };
  readonly facingFrameStart: Readonly<Record<string, number>>;
}

/** 静态人群「用哪些贴图、怎么判定在不在屏幕里」。 */
export interface StaticCrowdPresentation {
  readonly defaultTexture: string;
  readonly extraTextures: readonly string[];
  readonly textureFrameWidth: number;
  readonly textureFrameHeight: number;
  readonly npcHalfSize: number;
  readonly lookAroundIntervalMs: number;
  /**
   * 每帧最多让几个人新出现，防止一次涌出一大片卡帧。
   *
   * 和 `VenueCrowdPresentation` 里那个同名的项是一回事——原先只有场馆人群
   * 那边可配，静态人群这半边写死在 `game/PhaserStaticCrowdRuntime.ts` 里
   * （`created >= 16`），同样的担忧、两种做法。
   */
  readonly maxCreatePerSync: number;
}

/**
 * 铁轨带的矩形范围（世界像素）。
 *
 * 这是**一个世界事实**，不是某一类 NPC 的属性：普通路人不能站在铁轨上，
 * 走到带子里会被弹到带外。**路线人群和静态人群共用同一份值**——所以它只住在
 * `route-crowd-presentation.json` 一处，静态人群那侧从同一份读，不另抄一份。
 */
export interface TrackBand {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** 路线人群「用哪些贴图、显示上怎么错开」。两个字典的键都是人群组 id。 */
export interface RouteCrowdPresentation {
  readonly textures: readonly string[];
  readonly specialTextures: Readonly<Record<string, readonly string[]>>;
  readonly visualOffsets: Readonly<Record<string, number>>;
  readonly textureFrameWidth: number;
  readonly textureFrameHeight: number;
  /** 见 `TrackBand`：静态人群读的是同一份。 */
  readonly trackBand: TrackBand;
}

/** 抗议者头顶气泡的样式。原先全写死在代码里。 */
export interface SpeechBubbleStyle {
  readonly fontFamily: string;
  readonly fontStyle: string;
  readonly color: string;
  readonly backgroundColor: string;
  readonly fontSizePx: number;
  readonly wordWrapWidthPx: number;
  readonly padding: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly align: string;
  readonly offsetYFromSpritePx: number;
}

/** 场馆人群「长什么样、喊什么」。 */
export interface VenueCrowdPresentation {
  readonly npcTexture: string;
  readonly protesterAsset: {
    readonly key: string;
    readonly url: string;
    readonly frameWidth: number;
    readonly frameHeight: number;
  };
  readonly npcHalfSize: number;
  readonly protesterHalfSize: number;
  readonly slogans: readonly string[];
  readonly speechMaxVisible: number;
  readonly speechInitialDelayMs: number;
  readonly speechDurationMs: number;
  readonly speechIntervalMs: number;
  readonly maxCreatePerSync: number;
  readonly maxConcurrentActs: number;
  readonly actCapableEveryNth: number;
  readonly speechBubble: SpeechBubbleStyle;
}

/** 跳舞人群的贴图怎么找、怎么切。 */
export interface DancingCrowdPresentation {
  readonly textureKeyPrefix: string;
  readonly textureUrlPrefix: string;
  readonly textureUrlSuffix: string;
  readonly textureFrameWidth: number;
  readonly textureFrameHeight: number;
  readonly animationFrameStart: number;
  readonly animationFrameEnd: number;
}

/** 这个校园里哪几块区域不站路人。序号对应 `static-crowd-regions.json`。 */
export interface StaticCrowdDisabledRegions {
  readonly disabledRegionIndexes: readonly number[];
}

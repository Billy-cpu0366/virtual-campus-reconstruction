/**
 * SYS-NPC 的「调参」类型。
 *
 * 和 types.ts 不同：这些类型在 src/ 里**没有对应物**。源码里它们是一堆各自独立的
 * 模块级常量（`const X = 300`），从来没有被组织成一个对象。这里第一次给它们形状。
 *
 * 为什么要给形状：后台要按面板改它们，面板就得知道有哪几个框、每个框什么类型。
 * 散着的常量做不到这件事。
 */

/** 寻路允许的一个方向。dx/dy 是格偏移量，cost 是走这一格的代价（直向 1、斜向 1.41）。 */
export interface PathDirection {
  readonly dx: number;
  readonly dy: number;
  readonly cost: number;
}

/** 静态人群的调参。`factor` 是「每格撒几个人」，不是「一共几个人」。 */
export interface StaticCrowdTuning {
  readonly factor: number;
  readonly upFactor: number;
  readonly viewportMargin: number;
  readonly minSpacing: number;
  readonly coffeeMinSpacing: number;
  readonly stopAiBackgroundRegionIndex: number;
  readonly stopAiBackgroundCount: number;
  readonly maxPlacementAttemptsPerInstance: number;
  readonly footballCount: number;
  readonly coffeeRegionIndexes: readonly number[];
  readonly activeRegionExtraMargin: number;
  readonly footballRegionIndexes: readonly number[];
  readonly beachRegionIndexes: readonly number[];
  readonly stationRegionIndexes: readonly number[];
}

export interface StaticNpcTuning {
  readonly viewportMargin: number;
}

export interface RouteCrowdTuning {
  readonly baseSpeed: number;
  readonly startBatchSize: number;
  readonly safeMargin: number;
}

export interface SprayerTuning {
  readonly fleeSpeed: number;
  readonly groupDelay: number;
  readonly sprayDelayMax: number;
  readonly triggerVerticalMaxTiles: number;
  readonly triggerHorizontalTiles: number;
}

export interface VenueCrowdTuning {
  readonly prewarmMargin: number;
  readonly recycleMargin: number;
  readonly maxPlacementAttempts: number;
}

export interface PathTuning {
  readonly tileSize: number;
  readonly iterationsPerStep: number;
  readonly maxIterations: number;
  readonly directions: readonly PathDirection[];
}

/** 一个校园的全部 NPC 调参。 */
export interface NpcTuning {
  readonly staticCrowd: StaticCrowdTuning;
  readonly staticNpc: StaticNpcTuning;
  readonly routeCrowd: RouteCrowdTuning;
  readonly sprayer: SprayerTuning;
  readonly venueCrowd: VenueCrowdTuning;
  readonly path: PathTuning;
}

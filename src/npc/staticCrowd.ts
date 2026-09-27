export type StaticCrowdRegionType = "crowd" | "crowd_up";
export type StaticCrowdCategory = "ordinary" | "beach" | "football";
export type StaticCrowdDirection =
  | "east" | "north-east" | "north" | "north-west"
  | "west" | "south-west" | "south" | "south-east";

export interface StaticCrowdPoint {
  readonly x: number;
  readonly y: number;
}

export interface StaticCrowdRegion {
  readonly regionIndex: number;
  readonly tileCount: number;
  readonly type: StaticCrowdRegionType;
  readonly id?: string;
  readonly outline: readonly StaticCrowdPoint[];
}

export interface StaticCrowdSpritePools {
  readonly ordinary: readonly string[];
  readonly beach: readonly string[];
  readonly football: readonly string[];
}

export interface StaticCrowdViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface StaticCrowdInstanceSnapshot {
  readonly id: string;
  readonly regionIndex: number;
  readonly position: StaticCrowdPoint;
  readonly spriteKey: string;
  readonly category: StaticCrowdCategory;
  readonly direction: StaticCrowdDirection;
  readonly materialized: boolean;
}

export interface StaticCrowdRegionSnapshot {
  readonly region: StaticCrowdRegion;
  readonly requestedCount: number;
  readonly instances: readonly StaticCrowdInstanceSnapshot[];
}

export interface StaticCrowdSnapshot {
  readonly instances: readonly StaticCrowdInstanceSnapshot[];
  readonly regions: readonly StaticCrowdRegionSnapshot[];
}

/**
 * 静态人群的调参，全部来自 `static-crowd-tuning.json`。
 *
 * 每一项都**必须**由调用方递进来：少给一项就编译不过。这样改配置的人不会被
 * 「代码里还留着一份旧值」骗到。
 */
export interface StaticCrowdRuntimeTuning {
  /** 普通区域「每格撒几个人」。 */
  readonly factor: number;
  /** 抬头上看的区域（crowd_up）每格撒几个人——比普通区域密。 */
  readonly upFactor: number;
  /** 视口外这么远范围内的区域都算「可能要出现」，单位像素。 */
  readonly viewportMargin: number;
  /** 同区域内两个人最少隔多远，单位像素。 */
  readonly minSpacing: number;
  /** 咖啡座那两片区域专用的最小间距——椅子之间本来就宽，比别处大一截。 */
  readonly coffeeMinSpacing: number;
  /** 只站固定人数的那个区域的序号。 */
  readonly stopAiBackgroundRegionIndex: number;
  /** 那个区域站几个人。 */
  readonly stopAiBackgroundCount: number;
  /** 给一个人找位置最多试几次。试满还没找到就放弃这个区域剩下的名额。 */
  readonly maxPlacementAttemptsPerInstance: number;
  /** 两支足球队各站几个人——足球区域的密度不按面积算，是定死的。 */
  readonly footballCount: number;
  /** 哪两片（或几片）区域算咖啡座：用咖啡座那套更宽的间距。 */
  readonly coffeeRegionIndexes: readonly number[];
  /** 已经出现过、还没离开视口的区域，在 `viewportMargin` 之上再多留这么多像素。 */
  readonly activeRegionExtraMargin: number;
  /** 哪几片是足球队：站固定人数，贴图也换成球员那组。 */
  readonly footballRegionIndexes: readonly number[];
  /** 哪几片是沙滩人群：贴图从沙滩那组挑。 */
  readonly beachRegionIndexes: readonly number[];
  /** 哪几片在车站：朝向只在东、东南、南、西南、西里选，不朝北。 */
  readonly stationRegionIndexes: readonly number[];
}

export interface StaticCrowdRuntimeOptions {
  readonly random?: () => number;
  /** 46 个区域——来自 `static-crowd-regions.json`。 */
  readonly regions: readonly StaticCrowdRegion[];
  /** 三组贴图 key，按区域类别挑——来自 `static-crowd-sprite-pools.json`。 */
  readonly spritePools: StaticCrowdSpritePools;
  /** 哪几块地方不站人——来自 `static-crowd-disabled-regions.json`。 */
  readonly disabledRegionIndexes: readonly number[];
  /** 调参——来自 `static-crowd-tuning.json`。 */
  readonly tuning: StaticCrowdRuntimeTuning;
}



function boundsFor(region: StaticCrowdRegion): {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
} {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const point of region.outline) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return { left, top, width: right - left, height: bottom - top };
}

export function staticCrowdRequestedCount(
  region: StaticCrowdRegion,
  tuning: StaticCrowdRuntimeTuning,
): number {
  if (tuning.footballRegionIndexes.includes(region.regionIndex)) {
    return tuning.footballCount;
  }
  if (region.regionIndex === tuning.stopAiBackgroundRegionIndex) {
    return tuning.stopAiBackgroundCount;
  }
  const factor = region.type === "crowd_up"
    ? tuning.upFactor
    : tuning.factor;
  const bounds = boundsFor(region);
  return Math.max(5, Math.floor(bounds.width * bounds.height * factor));
}

function pointOnSegment(point: StaticCrowdPoint, a: StaticCrowdPoint, b: StaticCrowdPoint): boolean {
  const cross = (point.x - a.x) * (b.y - a.y) -
    (point.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > 1e-9) return false;
  return point.x >= Math.min(a.x, b.x) - 1e-9 &&
    point.x <= Math.max(a.x, b.x) + 1e-9 &&
    point.y >= Math.min(a.y, b.y) - 1e-9 &&
    point.y <= Math.max(a.y, b.y) + 1e-9;
}

function pointInPolygon(point: StaticCrowdPoint, outline: readonly StaticCrowdPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = outline.length - 1;
    index < outline.length;
    previous = index++) {
    const current = outline[index]!;
    const before = outline[previous]!;
    if (pointOnSegment(point, before, current)) return true;
    const crosses = (current.y > point.y) !== (before.y > point.y);
    if (crosses && point.x <
      (before.x - current.x) * (point.y - current.y) /
        (before.y - current.y) + current.x) {
      inside = !inside;
    }
  }
  return inside;
}

function normalizedRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999999999, Math.max(0, value));
}

function categoryFor(
  region: StaticCrowdRegion,
  tuning: StaticCrowdRuntimeTuning,
): StaticCrowdCategory {
  if (tuning.footballRegionIndexes.includes(region.regionIndex)) {
    return "football";
  }
  if (tuning.beachRegionIndexes.includes(region.regionIndex)) return "beach";
  return "ordinary";
}

function directionsFor(
  region: StaticCrowdRegion,
  tuning: StaticCrowdRuntimeTuning,
): readonly StaticCrowdDirection[] {
  if (region.type === "crowd_up") return ["north-east", "north", "north-west"];
  if (tuning.stationRegionIndexes.includes(region.regionIndex)) {
    return ["east", "south-east", "south", "south-west", "west"];
  }
  return ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
}

function freezeInstance(instance: StaticCrowdInstanceSnapshot): StaticCrowdInstanceSnapshot {
  return Object.freeze({
    ...instance,
    position: Object.freeze({ ...instance.position }),
  });
}

function emptySnapshot(): StaticCrowdSnapshot {
  return Object.freeze({
    instances: Object.freeze([]),
    regions: Object.freeze([]),
  });
}

type Placement = Omit<StaticCrowdInstanceSnapshot, "materialized">;

function isCoffeeRegion(
  regionIndex: number,
  coffeeRegionIndexes: readonly number[],
): boolean {
  return coffeeRegionIndexes.includes(regionIndex);
}

/**
 * 两片**不同**的咖啡座之间，要隔得比别处宽。
 *
 * 「哪几片算咖啡座」由配置给（`coffeeRegionIndexes`），所以「两片咖啡座之间」
 * 就是「两个序号都在这个名单里、而且不是同一片」。
 */
function crossRegionMinSpacing(
  firstRegionIndex: number,
  secondRegionIndex: number,
  coffeeMinSpacing: number,
  coffeeRegionIndexes: readonly number[],
): number | undefined {
  const isTargetPair = firstRegionIndex !== secondRegionIndex &&
    isCoffeeRegion(firstRegionIndex, coffeeRegionIndexes) &&
    isCoffeeRegion(secondRegionIndex, coffeeRegionIndexes);
  return isTargetPair ? coffeeMinSpacing : undefined;
}

function makePlacements(
  regions: readonly StaticCrowdRegion[],
  random: () => number,
  spritePools: StaticCrowdSpritePools,
  tuning: StaticCrowdRuntimeTuning,
  disabledRegionIndexes: ReadonlySet<number>,
): readonly Placement[] {
  const placements: Placement[] = [];
  for (const region of regions) {
    if (disabledRegionIndexes.has(region.regionIndex)) continue;
    const bounds = boundsFor(region);
    const category = categoryFor(region, tuning);
    const sprites = spritePools[category];
    const directions = directionsFor(region, tuning);
    const count = staticCrowdRequestedCount(region, tuning);
    const regionPlacements: StaticCrowdPoint[] = [];
    const attempts = Math.max(
      1,
      Math.floor(tuning.maxPlacementAttemptsPerInstance),
    );

    for (let index = 0; index < count; index += 1) {
      let position: StaticCrowdPoint | undefined;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = {
          x: bounds.left + bounds.width * normalizedRandom(random),
          y: bounds.top + bounds.height * normalizedRandom(random),
        };
        if (!pointInPolygon(candidate, region.outline)) continue;
        const withinRegionSpacing = isCoffeeRegion(
          region.regionIndex,
          tuning.coffeeRegionIndexes,
        )
          ? tuning.coffeeMinSpacing
          : tuning.minSpacing;
        if (regionPlacements.some((placed) =>
          Math.hypot(placed.x - candidate.x, placed.y - candidate.y) <
            withinRegionSpacing)) continue;
        if (placements.some((placed) => {
          const minimum = crossRegionMinSpacing(
            region.regionIndex,
            placed.regionIndex,
            tuning.coffeeMinSpacing,
            tuning.coffeeRegionIndexes,
          );
          return minimum !== undefined &&
            Math.hypot(
              placed.position.x - candidate.x,
              placed.position.y - candidate.y,
            ) < minimum;
        })) continue;
        position = candidate;
        break;
      }
      if (position === undefined) break;
      regionPlacements.push(position);
      const sprite = sprites[Math.floor(normalizedRandom(random) * sprites.length)] ??
        sprites[0]!;
      const direction = directions[
        Math.floor(normalizedRandom(random) * directions.length)
      ]!;
      placements.push(Object.freeze({
        id: `${region.regionIndex}:${regionPlacements.length - 1}`,
        regionIndex: region.regionIndex,
        position: Object.freeze(position),
        spriteKey: sprite,
        category,
        direction,
      }));
    }
  }
  return Object.freeze(placements);
}

/** Deterministic owner for the 46 source-backed static crowd regions. */
export class StaticCrowdRuntime {
  private readonly regions: readonly StaticCrowdRegion[];
  private readonly random: () => number;
  private readonly spritePools: StaticCrowdSpritePools;
  private readonly tuning: StaticCrowdRuntimeTuning;
  private readonly disabledRegionIndexes: ReadonlySet<number>;
  private placements: readonly Placement[] | undefined;
  private readonly activeRegionIndexes = new Set<number>();
  private started = false;
  private dead = false;
  private current: StaticCrowdSnapshot = emptySnapshot();

  constructor(options: StaticCrowdRuntimeOptions) {
    this.regions = options.regions;
    this.random = options.random ?? Math.random;
    this.spritePools = options.spritePools;
    this.tuning = options.tuning;
    this.disabledRegionIndexes = new Set(options.disabledRegionIndexes);
  }

  get snapshot(): StaticCrowdSnapshot {
    return this.current;
  }

  get startedState(): boolean {
    return this.started;
  }

  start(viewport: StaticCrowdViewport | undefined): StaticCrowdSnapshot {
    if (this.dead) return this.current;
    this.started = true;
    if (this.placements === undefined) {
      this.placements = makePlacements(
        this.regions,
        this.random,
        this.spritePools,
        this.tuning,
        this.disabledRegionIndexes,
      );
    }
    return this.tick(viewport);
  }

  tick(viewport: StaticCrowdViewport | undefined): StaticCrowdSnapshot {
    if (this.dead || !this.started || viewport === undefined) return this.current;
    for (const region of this.regions) {
      const regionBounds = boundsFor(region);
      const margin = this.activeRegionIndexes.has(region.regionIndex)
        ? this.tuning.viewportMargin + this.tuning.activeRegionExtraMargin
        : this.tuning.viewportMargin;
      const intersects = regionBounds.left <= viewport.left + viewport.width + margin &&
        regionBounds.left + regionBounds.width >= viewport.left - margin &&
        regionBounds.top <= viewport.top + viewport.height + margin &&
        regionBounds.top + regionBounds.height >= viewport.top - margin;
      if (intersects) this.activeRegionIndexes.add(region.regionIndex);
      else this.activeRegionIndexes.delete(region.regionIndex);
    }
    const instances = Object.freeze(this.placements!.map((placement) =>
      freezeInstance({
        ...placement,
        materialized: this.activeRegionIndexes.has(placement.regionIndex),
      }),
    ));
    const regions = Object.freeze(this.regions.map((region) => {
      const regionInstances = Object.freeze(instances.filter((instance) =>
        instance.regionIndex === region.regionIndex));
      return Object.freeze({
        region,
        requestedCount: staticCrowdRequestedCount(region, this.tuning),
        instances: regionInstances,
      });
    }));
    this.current = Object.freeze({ instances, regions });
    return this.current;
  }

  cancel(): StaticCrowdSnapshot {
    this.started = false;
    this.activeRegionIndexes.clear();
    this.current = emptySnapshot();
    return this.current;
  }

  shutdown(): StaticCrowdSnapshot {
    this.dead = true;
    return this.cancel();
  }
}

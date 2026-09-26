import type { VenuePoint, VenueRegion } from "./venueCrowd.js";

export interface VenueCrowdInstance {
  readonly id: string;
  readonly regionId: string;
  readonly position: VenuePoint;
  readonly materialized: boolean;
}
export interface VenueCrowdSnapshot {
  readonly instances: readonly VenueCrowdInstance[];
}

/**
 * 撒人需要的全部外部输入。
 *
 * `tuning` 里两项是「区域靠近屏幕多远就提前准备好、走远多远才撤掉」，单位是像素；
 * 还有一项是「给一个人找位置最多试几次」。名字照配置文件的字段名写，
 * 这样调用方能把读出来的那份对象原样递进来。
 */
export interface VenueCrowdRuntimeOptions {
  readonly regions: readonly VenueRegion[];
  readonly tuning: {
    readonly prewarmMargin: number;
    readonly recycleMargin: number;
    readonly maxPlacementAttempts: number;
  };
  readonly random?: () => number;
}

type View = { left: number; top: number; width: number; height: number };
type RegionBounds = { left: number; top: number; right: number; bottom: number };

const bounds = (outline: readonly VenuePoint[]): RegionBounds => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of outline) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return { left, top, right, bottom };
};

const intersects = (region: RegionBounds, view: View, margin: number): boolean =>
  region.left <= view.left + view.width + margin &&
  region.right >= view.left - margin &&
  region.top <= view.top + view.height + margin &&
  region.bottom >= view.top - margin;

const inside = (point: VenuePoint, outline: readonly VenuePoint[]): boolean => {
  let hit = false;
  for (let index = 0, prior = outline.length - 1; index < outline.length; prior = index++) {
    const current = outline[index]!;
    const previous = outline[prior]!;
    if (
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x < (previous.x - current.x) * (point.y - current.y) /
        (previous.y - current.y) + current.x
    ) hit = !hit;
  }
  return hit;
};

/** One-time placement owner with region-level prewarm and delayed recycling. */
export class VenueCrowdRuntime {
  private items: VenueCrowdInstance[] = [];
  private readonly activeRegions = new Set<string>();
  private begun = false;
  private readonly regions: readonly VenueRegion[];
  private readonly tuning: VenueCrowdRuntimeOptions["tuning"];
  private readonly random: () => number;

  constructor(options: VenueCrowdRuntimeOptions) {
    this.regions = options.regions;
    this.tuning = options.tuning;
    this.random = options.random ?? Math.random;
  }

  start(view?: View): VenueCrowdSnapshot {
    if (!this.begun) {
      this.begun = true;
      const attempts = Math.max(1, Math.floor(this.tuning.maxPlacementAttempts));
      for (const region of this.regions) {
        const regionBounds = bounds(region.outline);
        const placed: VenuePoint[] = [];
        for (let index = 0; index < region.count; index += 1) {
          let found: VenuePoint | undefined;
          for (let tries = 0; tries < attempts; tries += 1) {
            const point = {
              x: regionBounds.left + (regionBounds.right - regionBounds.left) * this.random(),
              y: regionBounds.top + (regionBounds.bottom - regionBounds.top) * this.random(),
            };
            if (
              inside(point, region.outline) &&
              placed.every((other) => Math.hypot(other.x - point.x, other.y - point.y) >= region.spacing)
            ) {
              found = point;
              break;
            }
          }
          if (found === undefined) break;
          placed.push(found);
          this.items.push({
            id: `${region.id}:${index}`,
            regionId: region.id,
            position: found,
            materialized: false,
          });
        }
      }
    }
    return this.tick(view);
  }

  tick(view?: View): VenueCrowdSnapshot {
    if (view !== undefined) {
      for (const region of this.regions) {
        const margin = this.activeRegions.has(region.id)
          ? this.tuning.recycleMargin
          : this.tuning.prewarmMargin;
        if (intersects(bounds(region.outline), view, margin)) this.activeRegions.add(region.id);
        else this.activeRegions.delete(region.id);
      }
      this.items = this.items.map((item) => ({
        ...item,
        materialized: this.activeRegions.has(item.regionId),
      }));
    }
    return this.snapshot;
  }

  get snapshot(): VenueCrowdSnapshot {
    return Object.freeze({
      instances: Object.freeze(this.items.map((item) => Object.freeze({
        ...item,
        position: Object.freeze({ ...item.position }),
      }))),
    });
  }

  shutdown(): void {
    this.items = [];
    this.activeRegions.clear();
    this.begun = false;
  }
}

import { VENUE_CROWD_REGIONS, type VenuePoint } from "./venueCrowd.js";

export interface VenueCrowdInstance {
  readonly id: string;
  readonly regionId: string;
  readonly position: VenuePoint;
  readonly materialized: boolean;
}
export interface VenueCrowdSnapshot {
  readonly instances: readonly VenueCrowdInstance[];
}
type View = { left: number; top: number; width: number; height: number };
type RegionBounds = { left: number; top: number; right: number; bottom: number };

const VENUE_PREWARM_MARGIN = 400;
const VENUE_RECYCLE_MARGIN = 500;

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

  constructor(private readonly random: () => number = Math.random) {}

  start(view?: View): VenueCrowdSnapshot {
    if (!this.begun) {
      this.begun = true;
      for (const region of VENUE_CROWD_REGIONS) {
        const regionBounds = bounds(region.outline);
        const placed: VenuePoint[] = [];
        for (let index = 0; index < region.count; index += 1) {
          let found: VenuePoint | undefined;
          for (let tries = 0; tries < 20; tries += 1) {
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
      for (const region of VENUE_CROWD_REGIONS) {
        const margin = this.activeRegions.has(region.id)
          ? VENUE_RECYCLE_MARGIN
          : VENUE_PREWARM_MARGIN;
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

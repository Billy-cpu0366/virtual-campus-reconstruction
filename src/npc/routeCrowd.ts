export type RouteCrowdState = "delay" | "moving" | "returning" | "gone";

export interface RouteCrowdTile {
  readonly x: number;
  readonly y: number;
}

export interface RouteCrowdDelayRange {
  readonly minMs: number;
  readonly maxMs: number;
}

export interface RouteCrowdRange {
  readonly min: number;
  readonly max: number;
}

export interface RouteCrowdConfig {
  readonly id: string;
  readonly count: number;
  readonly tileCandidates: readonly RouteCrowdTile[];
  readonly speedVariation: RouteCrowdRange;
  readonly delay: RouteCrowdDelayRange;
  readonly goBack: boolean;
  readonly deleteAfterComplete: boolean;
}

export interface RouteCrowdPathRequest {
  readonly start: RouteCrowdTile;
  readonly end: RouteCrowdTile;
}

export type RouteCrowdPathPoint = RouteCrowdTile;

export interface RouteCrowdPathProvider {
  findPath(request: RouteCrowdPathRequest): readonly RouteCrowdPathPoint[] | null;
}

export type RouteCrowdPathProviderLike =
  | RouteCrowdPathProvider
  | ((request: RouteCrowdPathRequest) => readonly RouteCrowdPathPoint[] | null);

export interface RouteCrowdViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface RouteCrowdInstanceSnapshot {
  id: string;
  state: RouteCrowdState;
  position: RouteCrowdTile;
  generation: number;
  materialized: boolean;
  visible: boolean;
  destroyed: boolean;
}

export interface RouteCrowdSnapshot {
  readonly instances: readonly RouteCrowdInstanceSnapshot[];
}

export type RouteCrowdStartResult =
  | { readonly ok: true; readonly created: number; readonly pathFailures: number }
  | { readonly ok: false; readonly reason: "shutdown" };

export interface RouteCrowdRuntimeOptions {
  readonly random?: () => number;
  readonly configs?: readonly RouteCrowdConfig[];
  readonly pathProvider: RouteCrowdPathProviderLike;
  readonly baseSpeed?: number;
}

export const ROUTE_CROWD_BASE_SPEED = 48;
export const ROUTE_CROWD_TILE_SIZE = 16;

const group = (id: string, count: number): RouteCrowdConfig =>
  Object.freeze({
    id,
    count,
    // Temporary evidence placeholder. Each public group must replace this with
    // its own source-backed route before the production probe can pass.
    tileCandidates: Object.freeze([{ x: 31, y: 81 }, { x: 73, y: 133 }]),
    speedVariation: Object.freeze({ min: 0.8, max: 1.2 }),
    delay: Object.freeze({ minMs: 0, maxMs: 2_000 }),
    goBack: true,
    deleteAfterComplete: false,
  });

export const ROUTE_CROWD_CONFIGS = Object.freeze([
  group("main-crowd", 10),
  group("loop-crowd", 10),
  group("drinkers", 5),
  group("concert-crowd", 40),
  group("vertical-crowd", 10),
  group("vertical-crowd-reverse", 10),
  group("walking-crowd", 8),
  group("outside-concert1", 10),
  Object.freeze({
    ...group("crowd-train", 10),
    goBack: false,
    deleteAfterComplete: true,
  }),
]);

type Item = RouteCrowdInstanceSnapshot & {
  readonly config: RouteCrowdConfig;
  readonly forwardPath: readonly RouteCrowdTile[];
  path: readonly RouteCrowdTile[];
  waypointIndex: number;
  delayAt: number;
  speed: number;
  start: RouteCrowdTile;
};

function pathOf(
  provider: RouteCrowdPathProviderLike,
  request: RouteCrowdPathRequest,
): readonly RouteCrowdPathPoint[] | null {
  return typeof provider === "function"
    ? provider(request)
    : provider.findPath(request);
}

function randomIn(range: RouteCrowdRange, random: () => number): number {
  return range.min + (range.max - range.min) * random();
}

function randomDelayIn(
  range: RouteCrowdDelayRange,
  random: () => number,
): number {
  return range.minMs + (range.maxMs - range.minMs) * random();
}

function pointInViewport(point: RouteCrowdTile, viewport: RouteCrowdViewport): boolean {
  return (
    point.x >= viewport.left &&
    point.x <= viewport.left + viewport.width &&
    point.y >= viewport.top &&
    point.y <= viewport.top + viewport.height
  );
}

function pathIntersectsViewport(
  path: readonly RouteCrowdTile[],
  viewport: RouteCrowdViewport,
): boolean {
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  return (
    Math.max(...xs) >= viewport.left &&
    Math.min(...xs) <= viewport.left + viewport.width &&
    Math.max(...ys) >= viewport.top &&
    Math.min(...ys) <= viewport.top + viewport.height
  );
}

/** Deterministic owner for one bounded, source-backed route-crowd batch. */
export class RouteCrowdRuntime {
  private items: Item[] = [];
  private dead = false;
  private begun = false;
  private last = 0;

  constructor(private readonly options: RouteCrowdRuntimeOptions) {}

  get started(): boolean {
    return this.begun;
  }

  get snapshot(): RouteCrowdSnapshot {
    return {
      instances: this.items.map(({ config, forwardPath, path, waypointIndex, delayAt, speed, start, ...item }) => ({
        ...item,
      })),
    };
  }

  start(now: number, viewport?: RouteCrowdViewport): RouteCrowdStartResult {
    if (this.dead) return { ok: false, reason: "shutdown" };

    this.items = [];
    let pathFailures = 0;
    const configs = this.options.configs ?? ROUTE_CROWD_CONFIGS;
    const random = this.options.random ?? Math.random;
    const baseSpeed = this.options.baseSpeed ?? ROUTE_CROWD_BASE_SPEED;

    for (const config of configs) {
      for (let index = 0; index < config.count; index += 1) {
        const startTile = config.tileCandidates[
          Math.floor(random() * config.tileCandidates.length)
        ]!;
        const endTile = config.tileCandidates[
          Math.floor(random() * config.tileCandidates.length)
        ]!;
        const path = pathOf(this.options.pathProvider, {
          start: {
            x: startTile.x * ROUTE_CROWD_TILE_SIZE,
            y: startTile.y * ROUTE_CROWD_TILE_SIZE,
          },
          end: {
            x: endTile.x * ROUTE_CROWD_TILE_SIZE,
            y: endTile.y * ROUTE_CROWD_TILE_SIZE,
          },
        });
        if (path === null || path.length === 0) {
          pathFailures += 1;
          continue;
        }

        const start = path[0]!;
        this.items.push({
          id: `${config.id}:${index}`,
          state: "delay",
          position: start,
          generation: 0,
          materialized: true,
          visible: true,
          destroyed: false,
          config,
          forwardPath: path,
          path,
          waypointIndex: 1,
          delayAt: now + randomDelayIn(config.delay, random),
          speed: baseSpeed * randomIn(config.speedVariation, random),
          start,
        });
      }
    }

    this.begun = this.items.length > 0;
    this.last = now;
    this.applyView(viewport);
    return { ok: true, created: this.items.length, pathFailures };
  }

  tick(now: number, viewport?: RouteCrowdViewport): RouteCrowdSnapshot {
    const elapsedMs = Math.max(0, now - this.last);
    this.last = now;

    for (const item of this.items) {
      let remainingMs = elapsedMs;
      while (remainingMs > 0 && item.state !== "gone") {
        if (item.state === "delay") {
          if (now < item.delayAt) break;
          const tickStartedAt = now - remainingMs;
          remainingMs = Math.max(0, remainingMs - (item.delayAt - tickStartedAt));
          item.state = "moving";
          continue;
        }
        if (item.state === "moving" || item.state === "returning") {
          const target = item.path[item.waypointIndex];
          if (target === undefined) {
            this.completePath(item, now);
            continue;
          }
          const distance = Math.hypot(
            target.x - item.position.x,
            target.y - item.position.y,
          );
          if (distance === 0) {
            item.waypointIndex += 1;
            continue;
          }
          const availableDistance = item.speed * remainingMs / 1_000;
          if (availableDistance < distance) {
            const factor = availableDistance / distance;
            item.position = {
              x: item.position.x + (target.x - item.position.x) * factor,
              y: item.position.y + (target.y - item.position.y) * factor,
            };
            remainingMs = 0;
            continue;
          }
          item.position = target;
          item.waypointIndex += 1;
          remainingMs -= distance / item.speed * 1_000;
          if (item.path[item.waypointIndex] === undefined) {
            this.completePath(item, now);
          }
        }
      }
    }

    this.applyView(viewport);
    return this.snapshot;
  }

  cancel(): RouteCrowdSnapshot {
    this.items = [];
    this.begun = false;
    return this.snapshot;
  }

  shutdown(): RouteCrowdSnapshot {
    this.dead = true;
    return this.cancel();
  }

  private completePath(item: Item, now: number): void {
    if (item.state === "moving" && item.config.goBack) {
      item.state = "returning";
      item.path = [...item.forwardPath].reverse();
      item.waypointIndex = 1;
      return;
    }
    if (item.state === "returning") {
      this.restart(item, now);
      return;
    }
    if (item.config.deleteAfterComplete) {
      item.state = "gone";
      item.destroyed = true;
      return;
    }
    this.restart(item, now);
  }

  private restart(item: Item, now: number): void {
    item.state = "delay";
    item.generation += 1;
    item.position = item.start;
    item.path = item.forwardPath;
    item.waypointIndex = 1;
    item.delayAt = now + item.config.delay.minMs;
  }

  private applyView(viewport?: RouteCrowdViewport): void {
    if (viewport === undefined) return;
    for (const item of this.items) {
      const intersects = pathIntersectsViewport(item.path, viewport);
      item.materialized = item.state !== "gone" && intersects;
      item.visible = item.materialized && pointInViewport(item.position, viewport);
      item.destroyed = item.state === "gone";
    }
  }
}

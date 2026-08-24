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
  readonly startTiles: readonly RouteCrowdTile[];
  readonly endTiles: readonly RouteCrowdTile[];
  readonly movementSpeed: number;
  readonly speedVariation: RouteCrowdRange;
  readonly delay: RouteCrowdDelayRange;
  readonly afterDelay: RouteCrowdDelayRange;
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

export type RouteCrowdBatchedStartResult =
  | {
      readonly ok: true;
      readonly complete: boolean;
      readonly created: number;
      readonly pathFailures: number;
    }
  | { readonly ok: false; readonly reason: "shutdown" };

export interface RouteCrowdRuntimeOptions {
  readonly random?: () => number;
  readonly configs?: readonly RouteCrowdConfig[];
  readonly pathProvider: RouteCrowdPathProviderLike;
  readonly baseSpeed?: number;
}

export const ROUTE_CROWD_BASE_SPEED = 48;
export const ROUTE_CROWD_TILE_SIZE = 16;
export const ROUTE_CROWD_START_BATCH_SIZE = 1;

const tiles = (values: readonly (readonly [number, number])[]) =>
  Object.freeze(values.map(([x, y]) => Object.freeze({ x, y })));

const group = (
  id: string,
  count: number,
  startTiles: readonly (readonly [number, number])[],
  endTiles: readonly (readonly [number, number])[],
  movementSpeed: number,
  variation: number,
  delay: RouteCrowdDelayRange,
  afterDelay: RouteCrowdDelayRange,
  goBack: boolean,
  deleteAfterComplete = false,
): RouteCrowdConfig => Object.freeze({
  id,
  count,
  startTiles: tiles(startTiles),
  endTiles: tiles(endTiles),
  movementSpeed,
  speedVariation: Object.freeze({ min: 1 - variation, max: 1 + variation }),
  delay: Object.freeze(delay),
  afterDelay: Object.freeze(afterDelay),
  goBack,
  deleteAfterComplete,
});

// FACT: `chunk-WMFY56ZM.js` byte 328000–332000 public crowd registration.
export const ROUTE_CROWD_CONFIGS = Object.freeze([
  group("main-crowd", 10, [[31, 81], [32, 81], [33, 81]], [[73, 133]], 45, .25, { minMs: 0, maxMs: 0 }, { minMs: 2_000, maxMs: 2_000 }, false),
  group("loop-crowd", 10, [[55, 18], [62, 18]], [[21, 86], [55, 86], [112, 48], [116, 85]], 45, .2, { minMs: 0, maxMs: 0 }, { minMs: 1_000, maxMs: 1_000 }, true),
  group("drinkers", 5, [[55, 86], [50, 85]], [[87, 55], [85, 55]], 45, .2, { minMs: 4_000, maxMs: 10_000 }, { minMs: 4_000, maxMs: 10_000 }, false),
  group("concert_crowd", 40, [[105, 51], [135, 50], [136, 36], [106, 37]], [[108, 45], [128, 47], [129, 39]], 40, .25, { minMs: 0, maxMs: 3_000 }, { minMs: 1_000, maxMs: 1_000 }, false),
  group("vertical-crowd", 10, [[85, 56], [86, 56], [87, 56]], [[85, 86], [86, 86], [87, 86]], 40, .2, { minMs: 0, maxMs: 7_000 }, { minMs: 1_000, maxMs: 1_000 }, false),
  group("vertical-crowd-reverse", 10, [[87, 86], [88, 86], [89, 86]], [[87, 56], [88, 56], [89, 56]], 40, .2, { minMs: 0, maxMs: 7_000 }, { minMs: 2_000, maxMs: 2_000 }, false),
  group("walking-crowd", 8, [[35, 108], [16, 115], [36, 121], [48, 120]], [[108, 99], [86, 104]], 45, .15, { minMs: 0, maxMs: 35_000 }, { minMs: 2_000, maxMs: 2_000 }, false),
  group("outside_concert1", 10, [[115, 109], [123, 110], [130, 108]], [[120, 114], [137, 106], [138, 96]], 35, .5, { minMs: 0, maxMs: 3_000 }, { minMs: 1_000, maxMs: 1_000 }, false),
  group("crowd-train", 10, Array.from({ length: 22 }, (_, index) => [63 + index, 19] as const), [[68, 121], [8, 100], [36, 117], [129, 108], [106, 46], [21, 86]], 35, .2, { minMs: 2_400, maxMs: 2_400 }, { minMs: 0, maxMs: 0 }, false, true),
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

type PendingStart = {
  readonly config: RouteCrowdConfig;
  readonly index: number;
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
  private pendingStarts: PendingStart[] | undefined;
  private batchedStartNow = 0;
  private batchedStartGeneration = 0;
  private batchedCreated = 0;
  private batchedPathFailures = 0;

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

    this.beginBatchedStart(now);
    while (this.pendingStarts !== undefined) {
      this.processBatchedStart(viewport, Number.POSITIVE_INFINITY);
    }
    return {
      ok: true,
      created: this.items.length,
      pathFailures: this.batchedPathFailures,
    };
  }

  /** Process at most one route creation for a frame-driven production start. */
  startBatched(
    now: number,
    viewport?: RouteCrowdViewport,
  ): RouteCrowdBatchedStartResult {
    if (this.dead) return { ok: false, reason: "shutdown" };
    if (this.pendingStarts === undefined) this.beginBatchedStart(now);
    return this.processBatchedStart(viewport, ROUTE_CROWD_START_BATCH_SIZE);
  }

  private beginBatchedStart(now: number): void {
    this.batchedStartGeneration += 1;
    this.pendingStarts = [];
    for (const config of this.options.configs ?? ROUTE_CROWD_CONFIGS) {
      for (let index = 0; index < config.count; index += 1) {
        this.pendingStarts.push({ config, index });
      }
    }
    this.items = [];
    this.begun = false;
    this.last = now;
    this.batchedStartNow = now;
    this.batchedCreated = 0;
    this.batchedPathFailures = 0;
  }

  private processBatchedStart(
    viewport: RouteCrowdViewport | undefined,
    batchSize: number,
  ): RouteCrowdBatchedStartResult {
    const pendingStarts = this.pendingStarts;
    if (pendingStarts === undefined) {
      return {
        ok: true,
        complete: true,
        created: this.batchedCreated,
        pathFailures: this.batchedPathFailures,
      };
    }
    const generation = this.batchedStartGeneration;
    const random = this.options.random ?? Math.random;
    const baseSpeed = this.options.baseSpeed ?? ROUTE_CROWD_BASE_SPEED;
    let processed = 0;
    while (processed < batchSize && pendingStarts.length > 0) {
      const pending = pendingStarts.shift()!;
      const startTile = pending.config.startTiles[
        Math.floor(random() * pending.config.startTiles.length)
      ]!;
      const endTile = pending.config.endTiles[
        Math.floor(random() * pending.config.endTiles.length)
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
      if (generation !== this.batchedStartGeneration || this.pendingStarts === undefined) {
        return {
          ok: true,
          complete: true,
          created: this.batchedCreated,
          pathFailures: this.batchedPathFailures,
        };
      }
      if (path === null || path.length === 0) {
        this.batchedPathFailures += 1;
        processed += 1;
        continue;
      }

      const start = path[0]!;
      this.items.push({
        id: `${pending.config.id}:${pending.index}`,
        state: "delay",
        position: start,
        generation: 0,
        materialized: true,
        visible: true,
        destroyed: false,
        config: pending.config,
        forwardPath: path,
        path,
        waypointIndex: 1,
        delayAt: this.batchedStartNow + randomDelayIn(pending.config.delay, random),
        speed: (pending.config.movementSpeed ?? baseSpeed) * randomIn(
          pending.config.speedVariation,
          random,
        ),
        start,
      });
      this.batchedCreated += 1;
      processed += 1;
    }

    const complete = pendingStarts.length === 0;
    this.applyView(viewport);
    if (complete) {
      this.pendingStarts = undefined;
      this.begun = this.items.length > 0;
      this.last = this.batchedStartNow;
    }
    return {
      ok: true,
      complete,
      created: this.batchedCreated,
      pathFailures: this.batchedPathFailures,
    };
  }

  tick(now: number, viewport?: RouteCrowdViewport): RouteCrowdSnapshot {
    if (this.pendingStarts !== undefined) return this.snapshot;
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
    this.batchedStartGeneration += 1;
    this.pendingStarts = undefined;
    this.items = [];
    this.begun = false;
    this.batchedCreated = 0;
    this.batchedPathFailures = 0;
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
    item.delayAt = now + randomDelayIn(
      item.config.afterDelay,
      this.options.random ?? Math.random,
    );
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

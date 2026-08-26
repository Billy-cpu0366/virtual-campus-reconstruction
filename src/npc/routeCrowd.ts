export type RouteCrowdState = "delay" | "moving" | "returning" | "waiting" | "gone";

export type RouteCrowdFacing =
  | "east" | "north-east" | "north-west" | "north"
  | "south-east" | "south-west" | "south" | "west";

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
  readonly randomPositions: boolean;
  readonly maxActiveInViewport: number | undefined;
  readonly pathRandomFactor: number;
  readonly ignoreWalls: boolean;
}

export interface RouteCrowdPathRequest {
  readonly start: RouteCrowdTile;
  readonly end: RouteCrowdTile;
  readonly randomSeed?: number;
  readonly randomFactor?: number;
  readonly ignoreWalls?: boolean;
  readonly allowBlockedEndpoints?: boolean;
}

export type RouteCrowdPathPoint = RouteCrowdTile;

export type RouteCrowdPathResult = readonly RouteCrowdPathPoint[] | null | undefined;

export interface RouteCrowdPathProvider {
  findPath(request: RouteCrowdPathRequest): RouteCrowdPathResult;
}

export type RouteCrowdPathProviderLike =
  | RouteCrowdPathProvider
  | ((request: RouteCrowdPathRequest) => RouteCrowdPathResult);

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
  facing: RouteCrowdFacing;
  alpha: number;
  pathId: string;
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
  /** Returns true when the next world-position waypoint is temporarily occupied. */
  readonly isBlocked?: (point: RouteCrowdTile) => boolean;
}

export const ROUTE_CROWD_BASE_SPEED = 48;
export const ROUTE_CROWD_TILE_SIZE = 16;
export const ROUTE_CROWD_START_BATCH_SIZE = 4;

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
  deleteAfterComplete: boolean,
  randomPositions: boolean,
  maxActiveInViewport: number | undefined,
  pathRandomFactor = .8,
  ignoreWalls = false,
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
  randomPositions,
  maxActiveInViewport,
  pathRandomFactor,
  ignoreWalls,
});

// FACT: `chunk-WMFY56ZM.js` byte 328000–332000 public crowd registration.
export const ROUTE_CROWD_CONFIGS = Object.freeze([
  group("main-crowd", 10, [[31, 81], [32, 81], [33, 81]], [[73, 133]], 45, .25, { minMs: 0, maxMs: 0 }, { minMs: 2_000, maxMs: 2_000 }, false, false, true, 25),
  group("loop-crowd", 10, [[55, 18], [62, 18]], [[21, 86], [55, 86], [112, 48], [116, 85]], 45, .2, { minMs: 0, maxMs: 0 }, { minMs: 1_000, maxMs: 1_000 }, true, false, true, 10),
  group("drinkers", 5, [[55, 86], [50, 85]], [[87, 55], [85, 55]], 45, .2, { minMs: 4_000, maxMs: 10_000 }, { minMs: 4_000, maxMs: 10_000 }, false, false, true, 5, 1),
  group("concert_crowd", 40, [[105, 51], [135, 50], [136, 36], [106, 37]], [[108, 45], [128, 47], [129, 39]], 40, .25, { minMs: 0, maxMs: 3_000 }, { minMs: 1_000, maxMs: 1_000 }, false, false, true, 40),
  group("beach_crowd_walk", 4, [[96, 119]], [[68, 134]], 35, .2, { minMs: 0, maxMs: 0 }, { minMs: 0, maxMs: 0 }, true, false, true, 4),
  group("vertical-crowd", 10, [[85, 56], [86, 56], [87, 56]], [[85, 86], [86, 86], [87, 86]], 40, .2, { minMs: 0, maxMs: 7_000 }, { minMs: 1_000, maxMs: 1_000 }, false, false, true, 20, 0, true),
  group("vertical-crowd-reverse", 10, [[87, 86], [88, 86], [89, 86]], [[87, 56], [88, 56], [89, 56]], 40, .2, { minMs: 0, maxMs: 7_000 }, { minMs: 2_000, maxMs: 2_000 }, false, false, true, 20, .2, true),
  group("walking-crowd", 8, [[35, 108], [16, 115], [36, 121], [48, 120]], [[108, 99], [86, 104]], 45, .15, { minMs: 0, maxMs: 35_000 }, { minMs: 2_000, maxMs: 2_000 }, false, false, true, undefined, 1),
  group("hazmat-crowd", 8, [[13, 126], [19, 124]], [[5, 133], [11, 132], [8, 131]], 45, .15, { minMs: 0, maxMs: 10_000 }, { minMs: 2_000, maxMs: 2_000 }, true, false, true, undefined),
  group("outside_concert1", 10, [[115, 109], [123, 110], [130, 108]], [[120, 114], [137, 106], [138, 96]], 35, .5, { minMs: 0, maxMs: 3_000 }, { minMs: 1_000, maxMs: 1_000 }, false, false, true, undefined),
  group("crowd-train", 10, Array.from({ length: 22 }, (_, index) => [63 + index, 19] as const), [[68, 121], [8, 100], [36, 117], [129, 108], [106, 46], [21, 86]], 35, .2, { minMs: 2_400, maxMs: 2_400 }, { minMs: 0, maxMs: 0 }, false, true, false, 10),
]);

type CompletionAction = "delete" | "restart";

type Item = RouteCrowdInstanceSnapshot & {
  readonly config: RouteCrowdConfig;
  readonly forwardPath: readonly RouteCrowdTile[];
  path: readonly RouteCrowdTile[];
  waypointIndex: number;
  delayAt: number;
  speed: number;
  start: RouteCrowdTile;
  waitingFrom: "moving" | "returning" | undefined;
  completionAction: CompletionAction | undefined;
  everMaterialized: boolean;
  capSuppressed: boolean;
};

type PendingStart = {
  readonly config: RouteCrowdConfig;
  readonly index: number;
  readonly startTile: RouteCrowdTile;
  readonly endTile: RouteCrowdTile;
};

function pathOf(
  provider: RouteCrowdPathProviderLike,
  request: RouteCrowdPathRequest,
): RouteCrowdPathResult {
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

function facingForDelta(
  deltaX: number,
  deltaY: number,
  fallback: RouteCrowdFacing,
): RouteCrowdFacing {
  const x = Math.sign(deltaX);
  const y = Math.sign(deltaY);
  if (x === 0 && y === 0) return fallback;
  if (x > 0 && y === 0) return "east";
  if (x > 0 && y < 0) return "north-east";
  if (x < 0 && y < 0) return "north-west";
  if (x === 0 && y < 0) return "north";
  if (x > 0 && y > 0) return "south-east";
  if (x < 0 && y > 0) return "south-west";
  if (x === 0 && y > 0) return "south";
  return "west";
}

const ROUTE_CROWD_SAFE_MARGIN = 100;

function pointInSafeRange(
  point: RouteCrowdTile,
  viewport: RouteCrowdViewport,
): boolean {
  return point.x >= viewport.left - ROUTE_CROWD_SAFE_MARGIN &&
    point.x <= viewport.left + viewport.width + ROUTE_CROWD_SAFE_MARGIN &&
    point.y >= viewport.top - ROUTE_CROWD_SAFE_MARGIN &&
    point.y <= viewport.top + viewport.height + ROUTE_CROWD_SAFE_MARGIN;
}

function pointInViewport(
  point: RouteCrowdTile,
  viewport: RouteCrowdViewport,
): boolean {
  return point.x >= viewport.left &&
    point.x <= viewport.left + viewport.width &&
    point.y >= viewport.top &&
    point.y <= viewport.top + viewport.height;
}

function pathIntersectsSafeRange(
  path: readonly RouteCrowdTile[],
  viewport: RouteCrowdViewport,
): boolean {
  if (path.length === 0) return false;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of path) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return left <= viewport.left + viewport.width + ROUTE_CROWD_SAFE_MARGIN &&
    right >= viewport.left - ROUTE_CROWD_SAFE_MARGIN &&
    top <= viewport.top + viewport.height + ROUTE_CROWD_SAFE_MARGIN &&
    bottom >= viewport.top - ROUTE_CROWD_SAFE_MARGIN;
}

function shuffledIndexes(length: number, random: () => number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap]!, indexes[index]!];
  }
  return indexes;
}

function pointKey(point: RouteCrowdTile): string {
  return `${point.x}:${point.y}`;
}

/** Deterministic owner for one bounded, source-backed route-crowd batch. */
export class RouteCrowdRuntime {
  private items: Item[] = [];
  private dead = false;
  private begun = false;
  private last = 0;
  private readonly pausedConfigIds = new Set<string>();
  private pendingStarts: PendingStart[] | undefined;
  private batchedStartNow = 0;
  private batchedStartGeneration = 0;
  private batchedCreated = 0;
  private batchedPathFailures = 0;
  private readonly occupiedStarts = new Map<string, Set<string>>();
  private readonly createdByGroup = new Map<string, number>();

  constructor(private readonly options: RouteCrowdRuntimeOptions) {}

  get started(): boolean {
    return this.begun;
  }

  get pausedGroups(): readonly string[] {
    return Object.freeze([...this.pausedConfigIds].sort());
  }

  get snapshot(): RouteCrowdSnapshot {
    return {
      instances: this.items.map(({
        config,
        forwardPath,
        path,
        waypointIndex,
        delayAt,
        speed,
        start,
        waitingFrom,
        completionAction,
        everMaterialized,
        capSuppressed,
        ...item
      }) => ({
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

  /** Process a bounded group of incremental path steps per production frame. */
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
    const random = this.options.random ?? Math.random;
    for (const config of this.options.configs ?? ROUTE_CROWD_CONFIGS) {
      const startTiles = [...config.startTiles];
      for (let index = startTiles.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [startTiles[index], startTiles[swap]] = [startTiles[swap]!, startTiles[index]!];
      }
      const candidateCount = Math.min(
        config.count * 3,
        startTiles.length * config.endTiles.length,
      );
      const candidates: PendingStart[] = Array.from(
        { length: candidateCount },
        (_, index) => ({
          config,
          index,
          startTile: startTiles[index % startTiles.length]!,
          endTile: config.endTiles[index % config.endTiles.length]!,
        }),
      );
      for (let index = candidates.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [candidates[index], candidates[swap]] = [candidates[swap]!, candidates[index]!];
      }
      this.pendingStarts.push(...candidates);
    }
    this.items = [];
    this.begun = false;
    this.last = now;
    this.batchedStartNow = now;
    this.batchedCreated = 0;
    this.batchedPathFailures = 0;
    this.occupiedStarts.clear();
    this.createdByGroup.clear();
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
      const createdForGroup = this.createdByGroup.get(pending.config.id) ?? 0;
      const startTile = pending.startTile;
      const endTile = pending.endTile;
      const path = pathOf(this.options.pathProvider, {
        start: {
          x: startTile.x * ROUTE_CROWD_TILE_SIZE,
          y: startTile.y * ROUTE_CROWD_TILE_SIZE,
        },
        end: {
          x: endTile.x * ROUTE_CROWD_TILE_SIZE,
          y: endTile.y * ROUTE_CROWD_TILE_SIZE,
        },
        randomSeed: startTile.x * 1_000 + startTile.y * 100 + endTile.x * 10 + endTile.y + pending.index * 7_919,
        randomFactor: pending.config.pathRandomFactor,
        ignoreWalls: pending.config.ignoreWalls,
        allowBlockedEndpoints: true,
      });
      if (generation !== this.batchedStartGeneration || this.pendingStarts === undefined) {
        return {
          ok: true,
          complete: true,
          created: this.batchedCreated,
          pathFailures: this.batchedPathFailures,
        };
      }
      if (path === undefined) {
        pendingStarts.unshift(pending);
        processed += 1;
        continue;
      }
      if (path === null || path.length === 0) {
        this.batchedPathFailures += 1;
        processed += 1;
        continue;
      }
      if (createdForGroup >= pending.config.count) {
        processed += 1;
        continue;
      }

      const occupied = this.occupiedStarts.get(pending.config.id) ?? new Set<string>();
      this.occupiedStarts.set(pending.config.id, occupied);
      const waypointCount = path.length > 1 ? path.length - 1 : path.length;
      const candidates = pending.config.randomPositions
        ? shuffledIndexes(waypointCount, random)
        : [0];
      const startWaypointIndex = candidates.find((index) =>
        !occupied.has(pointKey(path[index]!)),
      ) ?? candidates[0]!;
      const start = { ...path[startWaypointIndex]! };
      const routePath = path.slice(startWaypointIndex);
      occupied.add(pointKey(start));
      const next = routePath[1];
      const pathId = `${startTile.x}_${startTile.y}_${endTile.x}_${endTile.y}_v${pending.index}`;
      this.items.push({
        id: `${pending.config.id}:${createdForGroup}`,
        state: "delay",
        position: start,
        generation: 0,
        materialized: false,
        visible: false,
        destroyed: false,
        facing: next === undefined
          ? "south"
          : facingForDelta(next.x - start.x, next.y - start.y, "south"),
        alpha: 1,
        pathId,
        config: pending.config,
        forwardPath: routePath,
        path: routePath,
        waypointIndex: 1,
        delayAt: this.batchedStartNow + randomDelayIn(pending.config.delay, random),
        speed: (pending.config.movementSpeed ?? baseSpeed) * randomIn(
          pending.config.speedVariation,
          random,
        ),
        start,
        waitingFrom: undefined,
        completionAction: undefined,
        everMaterialized: false,
        capSuppressed: false,
      });
      this.createdByGroup.set(pending.config.id, createdForGroup + 1);
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
      if (this.pausedConfigIds.has(item.config.id)) continue;
      if (item.completionAction !== undefined && viewport === undefined) {
        this.resolveCompletion(item, now);
      }
      let remainingMs = elapsedMs;
      while (remainingMs > 0 && item.state !== "gone") {
        if (item.state === "delay") {
          if (now < item.delayAt) break;
          const tickStartedAt = now - remainingMs;
          remainingMs = Math.max(0, remainingMs - (item.delayAt - tickStartedAt));
          item.state = item.waitingFrom ?? "moving";
          item.waitingFrom = undefined;
          continue;
        }
        if (item.state === "waiting") {
          const target = item.path[item.waypointIndex];
          if (target === undefined || this.options.isBlocked?.(target) === true) break;
          item.state = item.waitingFrom ?? "moving";
          item.waitingFrom = undefined;
          continue;
        }
        if (item.state === "moving" || item.state === "returning") {
          const target = item.path[item.waypointIndex];
          if (target === undefined) {
            this.completePath(item, now, viewport);
            continue;
          }
          if (this.options.isBlocked?.(target) === true) {
            item.waitingFrom = item.state;
            item.state = "waiting";
            break;
          }
          const deltaX = target.x - item.position.x;
          const deltaY = target.y - item.position.y;
          item.facing = facingForDelta(deltaX, deltaY, item.facing);
          const distance = Math.hypot(deltaX, deltaY);
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
            this.completePath(item, now - remainingMs, viewport);
          }
        }
      }
    }

    this.applyView(viewport);
    return this.snapshot;
  }

  pauseGroup(id: string): void {
    if (!this.dead) this.pausedConfigIds.add(id);
  }

  resumeGroup(id: string): void {
    this.pausedConfigIds.delete(id);
  }

  cancel(): RouteCrowdSnapshot {
    this.batchedStartGeneration += 1;
    this.pendingStarts = undefined;
    this.items = [];
    this.begun = false;
    this.batchedCreated = 0;
    this.batchedPathFailures = 0;
    this.occupiedStarts.clear();
    this.createdByGroup.clear();
    this.pausedConfigIds.clear();
    return this.snapshot;
  }

  shutdown(): RouteCrowdSnapshot {
    this.dead = true;
    return this.cancel();
  }

  private completePath(
    item: Item,
    now: number,
    viewport?: RouteCrowdViewport,
  ): void {
    if (item.state === "moving" && item.config.goBack) {
      item.state = "delay";
      item.path = [...item.forwardPath].reverse();
      item.waypointIndex = 1;
      item.waitingFrom = "returning";
      item.delayAt = now + randomDelayIn(
        item.config.afterDelay,
        this.options.random ?? Math.random,
      );
      return;
    }

    const action: CompletionAction = item.state === "returning" ||
      !item.config.deleteAfterComplete
      ? "restart"
      : "delete";
    item.state = "gone";
    item.waitingFrom = undefined;
    item.completionAction = action;
    if (viewport === undefined) this.resolveCompletion(item, now);
  }

  private resolveCompletion(item: Item, now: number): void {
    const action = item.completionAction;
    item.completionAction = undefined;
    if (action === "restart") this.restart(item, now);
  }

  private restart(item: Item, now: number): void {
    item.state = "delay";
    item.alpha = 1;
    item.generation += 1;
    item.position = item.start;
    item.path = item.forwardPath;
    item.waypointIndex = 1;
    item.waitingFrom = undefined;
    item.delayAt = now + randomDelayIn(
      item.config.afterDelay,
      this.options.random ?? Math.random,
    );
  }

  private applyView(viewport?: RouteCrowdViewport): void {
    if (viewport === undefined) return;
    const activeByGroup = new Map<string, number>();
    const safe = (item: Item): boolean => pointInSafeRange(item.position, viewport);
    const upcoming = (item: Item): boolean => pathIntersectsSafeRange(
      [item.position, ...item.path.slice(item.waypointIndex)],
      viewport,
    );

    for (const item of this.items) {
      if (item.completionAction !== undefined &&
          !safe(item) && !pointInSafeRange(item.start, viewport)) {
        this.resolveCompletion(item, this.last);
      }
    }

    for (const item of this.items) {
      const inSafeRange = safe(item);
      const hasUpcomingSafeRange = upcoming(item);
      const retained = item.materialized && (
        inSafeRange ||
        hasUpcomingSafeRange ||
        item.completionAction !== undefined
      );
      if (retained) {
        item.visible = true;
        item.alpha = 1;
        item.destroyed = false;
        activeByGroup.set(
          item.config.id,
          (activeByGroup.get(item.config.id) ?? 0) + 1,
        );
        continue;
      }

      item.materialized = false;
      item.visible = false;
      item.alpha = 1;
      const restartStillInSafeRange = item.completionAction !== undefined &&
        pointInSafeRange(item.start, viewport);
      item.destroyed = item.everMaterialized &&
        !inSafeRange && !hasUpcomingSafeRange && !restartStillInSafeRange;
    }

    for (const item of this.items) {
      if (item.materialized) continue;
      const canPresent = item.state !== "gone" ||
        item.completionAction === "restart";
      if (!canPresent || (!safe(item) && !upcoming(item))) continue;
      const active = activeByGroup.get(item.config.id) ?? 0;
      const cap = item.config.maxActiveInViewport;
      if (cap !== undefined && active >= cap) {
        item.capSuppressed = true;
        continue;
      }
      if (item.capSuppressed && pointInViewport(item.position, viewport)) {
        continue;
      }
      item.materialized = true;
      item.visible = true;
      item.alpha = 1;
      item.destroyed = false;
      item.everMaterialized = true;
      item.capSuppressed = false;
      activeByGroup.set(item.config.id, active + 1);
    }
  }
}

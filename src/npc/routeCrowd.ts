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
  /** Keep a completed one-way item alive while it exits offscreen. */
  readonly completionExit: boolean;
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

export interface RouteCrowdSpacingRule {
  readonly minDistance: number;
  readonly isInScope: (point: RouteCrowdTile) => boolean;
  readonly externalPoints?: () => readonly RouteCrowdTile[];
  readonly maxInstancesByConfig?: Readonly<Record<string, number>>;
  readonly allowedConfigIdsInScope?: readonly string[];
  readonly fixedStartWaypointByConfig?: Readonly<Record<string, number>>;
  readonly fixedStartWaypointRatiosByConfig?: Readonly<Record<string, readonly number[]>>;
  readonly fixedDelayByConfig?: Readonly<Record<string, number>>;
  readonly checkMovement?: boolean;
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

/**
 * 路线人群需要的外部输入。
 *
 * 除了 `random` / `pathProvider` / `isBlocked` / `visualSpacing` 这几个「怎么算」的
 * 注入点，其余**都必填**：它们原先各自有一个模块级默认值（`ROUTE_CROWD_CONFIGS`、
 * `ROUTE_CROWD_BASE_SPEED`、`ROUTE_CROWD_START_BATCH_SIZE`、`ROUTE_CROWD_SAFE_MARGIN`），
 * 那四份默认值就是被搬走的配置。留着默认值等于「没给配置也能跑」——路上会静悄悄地
 * 少几组人，比直接报错难查。
 */
export interface RouteCrowdRuntimeOptions {
  readonly random?: () => number;
  readonly configs: readonly RouteCrowdConfig[];
  readonly pathProvider: RouteCrowdPathProviderLike;
  /** 配置里没单独写 movementSpeed 的那几组用这个速度，单位像素每秒。 */
  readonly baseSpeed: number;
  /** 开局每帧最多算几条路径。一次全算完会在开场卡一大下。 */
  readonly startBatchSize: number;
  /** 视口外这么远的范围内都算「可能要出现」，单位像素。 */
  readonly safeMargin: number;
  /** Returns true when the next world-position waypoint is temporarily occupied. */
  readonly isBlocked?: (point: RouteCrowdTile) => boolean;
  /** Optional local visual spacing rule for a bounded route area. */
  readonly visualSpacing?: RouteCrowdSpacingRule;
}

export const ROUTE_CROWD_TILE_SIZE = 16;

type CompletionAction = "delete" | "restart";

type Item = RouteCrowdInstanceSnapshot & {
  readonly config: RouteCrowdConfig;
  readonly forwardPath: readonly RouteCrowdTile[];
  readonly restartPath: readonly RouteCrowdTile[];
  readonly exitPath: readonly RouteCrowdTile[];
  readonly restartPosition: RouteCrowdTile;
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

function pointInSafeRange(
  point: RouteCrowdTile,
  viewport: RouteCrowdViewport,
  safeMargin: number,
): boolean {
  return point.x >= viewport.left - safeMargin &&
    point.x <= viewport.left + viewport.width + safeMargin &&
    point.y >= viewport.top - safeMargin &&
    point.y <= viewport.top + viewport.height + safeMargin;
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
  safeMargin: number,
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
  return left <= viewport.left + viewport.width + safeMargin &&
    right >= viewport.left - safeMargin &&
    top <= viewport.top + viewport.height + safeMargin &&
    bottom >= viewport.top - safeMargin;
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
        restartPath,
        exitPath,
        restartPosition,
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
    return this.processBatchedStart(viewport, this.options.startBatchSize);
  }

  private beginBatchedStart(now: number): void {
    this.batchedStartGeneration += 1;
    this.pendingStarts = [];
    const random = this.options.random ?? Math.random;
    for (const config of this.options.configs) {
      const startTiles = [...config.startTiles];
      for (let index = startTiles.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [startTiles[index], startTiles[swap]] = [startTiles[swap]!, startTiles[index]!];
      }
      // Keep the source-sized candidate pool. Scoped spacing can reject a
      // candidate, but must not multiply path jobs to manufacture capacity.
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
    const baseSpeed = this.options.baseSpeed;
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
      const fixedStartWaypointRatio = this.options.visualSpacing
        ?.fixedStartWaypointRatiosByConfig?.[pending.config.id]
        ?.[createdForGroup];
      const fixedStartWaypoint = this.options.visualSpacing
        ?.fixedStartWaypointByConfig?.[pending.config.id];
      const forcedStartWaypoint = fixedStartWaypointRatio === undefined
        ? fixedStartWaypoint
        : Math.floor(
          Math.min(1, Math.max(0, fixedStartWaypointRatio)) *
          Math.max(0, waypointCount - 1),
        );
      const candidates = forcedStartWaypoint === undefined
        ? pending.config.randomPositions
          ? shuffledIndexes(waypointCount, random)
          : [0]
        : [Math.min(
          Math.max(0, Math.floor(forcedStartWaypoint)),
          Math.max(0, waypointCount - 1),
        )];
      const startWaypointIndex = candidates.find((index) =>
        !occupied.has(pointKey(path[index]!)),
      ) ?? candidates[0]!;
      const start = { ...path[startWaypointIndex]! };
      const instanceId = `${pending.config.id}:${createdForGroup}`;
      if (!this.hasSpacingRouteCapacity(pending.config.id, path) ||
        !this.hasVisualSpacing(undefined, start, pending.config.id, instanceId)) {
        processed += 1;
        continue;
      }
      const routePath = path.slice(startWaypointIndex);
      const restartPath = path;
      const exitPath = [...path].reverse();
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
        restartPath,
        exitPath,
        restartPosition: { ...path[0]! },
        path: routePath,
        waypointIndex: 1,
        delayAt: this.batchedStartNow + (
          this.options.visualSpacing?.fixedDelayByConfig?.[pending.config.id] ??
          randomDelayIn(pending.config.delay, random)
        ),
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
          if (target === undefined || this.options.isBlocked?.(target) === true ||
            !this.hasVisualSpacing(item, target, item.config.id, item.id)) break;
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
          if (this.options.isBlocked?.(target) === true ||
            !this.hasVisualSpacing(item, target, item.config.id, item.id)) {
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

  private hasSpacingRouteCapacity(
    configId: string,
    path: readonly RouteCrowdTile[],
  ): boolean {
    const rule = this.options.visualSpacing;
    const limit = rule?.maxInstancesByConfig?.[configId];
    if (rule === undefined || !path.some((point) => rule.isInScope(point))) {
      return true;
    }
    if (rule.allowedConfigIdsInScope !== undefined &&
      !rule.allowedConfigIdsInScope.includes(configId)) {
      return false;
    }
    if (limit === undefined) return true;
    const active = this.items.filter((item) => item.config.id === configId &&
      (item.forwardPath.some((point) => rule.isInScope(point)) ||
        rule.isInScope(item.position))).length;
    return active < Math.max(0, Math.floor(limit));
  }

  private hasVisualSpacing(
    item: Item | undefined,
    point: RouteCrowdTile,
    configId: string,
    instanceId: string,
  ): boolean {
    const rule = this.options.visualSpacing;
    if (rule === undefined || rule.checkMovement === false ||
      !rule.isInScope(point)) return true;
    const distance = (left: RouteCrowdTile, right: RouteCrowdTile): number =>
      Math.hypot(left.x - right.x, left.y - right.y);
    for (const other of this.items) {
      if (other === item || !rule.isInScope(other.position)) continue;
      if (other.id === instanceId && other.config.id === configId) continue;
      if (distance(point, other.position) < rule.minDistance) return false;
    }
    for (const external of rule.externalPoints?.() ?? []) {
      if (distance(point, external) < rule.minDistance) return false;
    }
    return true;
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
    if (item.state === "moving" && item.config.completionExit) {
      // Completion-exit routes reverse the full source path, not only the
      // randomized visible suffix, so the restart point stays offscreen.
      item.start = item.restartPosition;
      item.path = item.exitPath;
      item.waypointIndex = 1;
      item.state = "returning";
      item.waitingFrom = undefined;
      return;
    }
    if (item.state === "moving" && item.config.goBack) {
      item.path = [...item.forwardPath].reverse();
      item.waypointIndex = 1;
      item.state = "delay";
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
    item.position = item.restartPosition;
    item.start = item.restartPosition;
    item.path = item.restartPath;
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
    const safe = (item: Item): boolean =>
      pointInSafeRange(item.position, viewport, this.options.safeMargin);
    const upcoming = (item: Item): boolean => pathIntersectsSafeRange(
      [item.position, ...item.path.slice(item.waypointIndex)],
      viewport,
      this.options.safeMargin,
    );

    for (const item of this.items) {
      const restartAvailable = this.options.visualSpacing !== undefined &&
        this.hasVisualSpacing(
          undefined,
          item.restartPosition,
          item.config.id,
          item.id,
        );
      const completionOffscreen = !safe(item) &&
        (!pointInSafeRange(item.start, viewport, this.options.safeMargin) || restartAvailable);
      if (item.completionAction !== undefined && completionOffscreen) {
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
        pointInSafeRange(item.start, viewport, this.options.safeMargin);
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

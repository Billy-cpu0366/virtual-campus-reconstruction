export const SPRAYER_TILE_SIZE = 16;
export const SPRAYER_FLEE_SPEED = 140;
export const SPRAYER_GROUP_DELAY = 300;
export const SPRAYER_SPRAY_DELAY_MAX = 3_000;

export interface SprayerPoint {
  readonly x: number;
  readonly y: number;
}

export interface SprayerConfig {
  readonly id: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly depth: number;
  readonly scale: number;
  readonly frameRate: number;
  readonly escapeRoute: readonly SprayerPoint[];
}

const route = (...points: readonly [number, number][]): readonly SprayerPoint[] =>
  Object.freeze(
    points.map(([x, y]) => Object.freeze({ x, y })),
  );

/** The four coordinates and routes observed in the public Bundle. */
export const SPRAYER_CONFIGS: readonly SprayerConfig[] = Object.freeze([
  {
    id: "sprayer-60-25",
    tileX: 60,
    tileY: 25,
    depth: 500,
    scale: 0.9,
    frameRate: 6,
    escapeRoute: route(
      [60, 25],
      [60, 26],
      [0, 26],
    ),
  },
  {
    id: "sprayer-67-25",
    tileX: 67,
    tileY: 25,
    depth: 500,
    scale: 0.9,
    frameRate: 6,
    escapeRoute: route(
      [67, 25],
      [67, 26],
      [56, 26],
      [55, 27],
      [55, 35],
      [45, 35],
      [41, 39],
      [41, 87],
      [45, 91],
      [47, 91],
      [47, 98],
      [46, 99],
      [46, 102],
      [40, 108],
      [39, 108],
      [36, 111],
      [35, 111],
      [34, 112],
      [24, 112],
      [23, 111],
      [22, 111],
      [21, 110],
      [15, 110],
      [14, 111],
      [8, 111],
    ),
  },
  {
    id: "sprayer-71-25",
    tileX: 71,
    tileY: 25,
    depth: 500,
    scale: 0.9,
    frameRate: 6,
    escapeRoute: route(
      [71, 25],
      [71, 26],
      [79, 26],
      [80, 27],
      [80, 35],
      [90, 35],
      [91, 36],
      [91, 38],
      [92, 39],
      [92, 40],
      [102, 40],
      [103, 39],
      [111, 39],
    ),
  },
  {
    id: "sprayer-78-25",
    tileX: 78,
    tileY: 25,
    depth: 500,
    scale: 0.9,
    frameRate: 6,
    escapeRoute: route(
      [78, 25],
      [78, 26],
      [79, 26],
      [79, 35],
      [66, 35],
      [66, 42],
      [53, 55],
      [53, 56],
      [52, 56],
      [50, 58],
      [50, 77],
      [45, 82],
      [45, 91],
      [47, 91],
      [48, 92],
      [48, 98],
      [49, 99],
      [53, 99],
      [54, 100],
      [54, 103],
      [71, 103],
      [73, 105],
      [90, 105],
      [92, 103],
      [102, 103],
      [109, 110],
      [122, 110],
    ),
  },
].map((config) => Object.freeze(config)));

export type SprayerState = "idle" | "fleeing" | "gone" | "cancelled" | "shutdown";

export interface SprayerPlayerPosition {
  readonly x: number;
  readonly y: number;
}

export interface SprayerResourceAvailability {
  readonly idleTexture: boolean;
  readonly runningTexture: boolean;
}

export type SprayerStartFailure =
  | "shutdown"
  | "already-running"
  | "missing-idle-texture"
  | "missing-running-texture";

export type SprayerStartResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: SprayerStartFailure };

export interface SprayerSnapshot {
  readonly id: string;
  readonly state: SprayerState;
  readonly position: SprayerPoint;
  readonly sprayReady: boolean;
  readonly fleeAt: number | null;
  readonly routeDistance: number;
  readonly routeLength: number;
}

export interface SprayerGroupSnapshot {
  readonly started: boolean;
  readonly shutdown: boolean;
  readonly triggeredAt: number | null;
  readonly instances: readonly SprayerSnapshot[];
}

export interface SprayerRuntimeOptions {
  readonly random?: () => number;
  readonly speed?: number;
  readonly tileSize?: number;
}

interface SprayerInstance {
  readonly config: SprayerConfig;
  readonly routePixels: readonly SprayerPoint[];
  readonly routeLength: number;
  readonly readyAt: number;
  position: SprayerPoint;
  state: SprayerState;
  fleeAt: number | undefined;
  fleeStartedAt: number | undefined;
  routeDistance: number;
}

function clampRandom(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 0.999999999999);
}

function distance(a: SprayerPoint, b: SprayerPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAtDistance(
  points: readonly SprayerPoint[],
  requestedDistance: number,
): SprayerPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  const first = points[0];
  if (first === undefined) return { x: 0, y: 0 };
  if (points.length === 1 || requestedDistance <= 0) return first;

  let remaining = requestedDistance;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous === undefined || current === undefined) continue;
    const segmentLength = distance(previous, current);
    if (segmentLength === 0) continue;
    if (remaining <= segmentLength) {
      const ratio = remaining / segmentLength;
      return {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      };
    }
    remaining -= segmentLength;
  }
  return points[points.length - 1] ?? first;
}

function routeLength(points: readonly SprayerPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous !== undefined && current !== undefined) {
      total += distance(previous, current);
    }
  }
  return total;
}

function isInsideTrigger(
  instance: SprayerInstance,
  player: SprayerPlayerPosition,
  tileSize: number,
): boolean {
  if (instance.state !== "idle") return false;
  const playerTileY = Math.round(player.y / tileSize);
  const verticalDelta = playerTileY - instance.config.tileY;
  return (
    verticalDelta >= 0 &&
    verticalDelta <= 2 &&
    Math.abs(player.x - instance.position.x) / tileSize <= 2
  );
}

/**
 * Dedicated state owner for the four public sprayers.
 * It uses caller-supplied timestamps instead of installing timers, which keeps
 * cancellation and fake-clock verification deterministic.
 */
export class SprayerGroupRuntime {
  private readonly random: () => number;
  private readonly speed: number;
  private readonly tileSize: number;
  private instances: SprayerInstance[] = [];
  private startedState = false;
  private shutdownState = false;
  private triggeredAtState: number | undefined;
  private lastNow = 0;

  constructor(options: SprayerRuntimeOptions = {}) {
    this.random = options.random ?? Math.random;
    this.speed = options.speed ?? SPRAYER_FLEE_SPEED;
    this.tileSize = options.tileSize ?? SPRAYER_TILE_SIZE;
  }

  get started(): boolean {
    return this.startedState;
  }

  get isShutdown(): boolean {
    return this.shutdownState;
  }

  get snapshot(): SprayerGroupSnapshot {
    return Object.freeze({
      started: this.startedState,
      shutdown: this.shutdownState,
      triggeredAt: this.triggeredAtState ?? null,
      instances: Object.freeze(this.instances.map((instance) => this.snapshotOf(instance))),
    });
  }

  start(
    nowMs: number,
    resources: SprayerResourceAvailability = {
      idleTexture: true,
      runningTexture: true,
    },
  ): SprayerStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    if (this.startedState && this.instances.some((instance) => instance.state === "idle" || instance.state === "fleeing")) {
      return { ok: false, reason: "already-running" };
    }
    if (!resources.idleTexture) return { ok: false, reason: "missing-idle-texture" };
    if (!resources.runningTexture) return { ok: false, reason: "missing-running-texture" };

    this.lastNow = nowMs;
    this.instances = SPRAYER_CONFIGS.map((config) => {
      const routePixels = Object.freeze(
        config.escapeRoute.map((point) =>
          Object.freeze({
            x: point.x * this.tileSize,
            y: point.y * this.tileSize,
          }),
        ),
      );
      return {
        config,
        routePixels,
        routeLength: routeLength(routePixels),
        readyAt: nowMs + clampRandom(this.random()) * SPRAYER_SPRAY_DELAY_MAX,
        position: routePixels[0] ?? { x: config.tileX * this.tileSize, y: config.tileY * this.tileSize },
        state: "idle",
        fleeAt: undefined,
        fleeStartedAt: undefined,
        routeDistance: 0,
      };
    });
    this.startedState = true;
    this.triggeredAtState = undefined;
    return { ok: true };
  }

  tick(nowMs: number, player?: SprayerPlayerPosition): SprayerGroupSnapshot {
    if (!this.startedState || this.shutdownState) return this.snapshot;
    this.lastNow = Math.max(this.lastNow, nowMs);
    if (player !== undefined) this.triggerGroupIfNeeded(this.lastNow, player);

    for (const instance of this.instances) {
      if (instance.state === "idle" && instance.fleeAt !== undefined && this.lastNow >= instance.fleeAt) {
        instance.state = "fleeing";
        instance.fleeStartedAt = instance.fleeAt;
      }
      if (instance.state !== "fleeing" || instance.fleeStartedAt === undefined) continue;

      instance.routeDistance = Math.min(
        instance.routeLength,
        Math.max(0, this.lastNow - instance.fleeStartedAt) * this.speed / 1_000,
      );
      instance.position = pointAtDistance(instance.routePixels, instance.routeDistance);
      if (instance.routeDistance >= instance.routeLength) {
        instance.state = "gone";
      }
    }
    return this.snapshot;
  }

  cancel(): SprayerGroupSnapshot {
    if (this.shutdownState) return this.snapshot;
    for (const instance of this.instances) {
      if (instance.state === "idle" || instance.state === "fleeing") {
        instance.state = "cancelled";
      }
    }
    this.startedState = false;
    return this.snapshot;
  }

  shutdown(): SprayerGroupSnapshot {
    if (this.shutdownState) return this.snapshot;
    this.cancel();
    this.shutdownState = true;
    for (const instance of this.instances) instance.state = "shutdown";
    return this.snapshot;
  }

  private triggerGroupIfNeeded(nowMs: number, player: SprayerPlayerPosition): void {
    if (this.triggeredAtState !== undefined) return;
    const trigger = this.instances.some((instance) =>
      isInsideTrigger(instance, player, this.tileSize),
    );
    if (!trigger) return;

    const active = this.instances
      .filter((instance) => instance.state === "idle")
      .sort((left, right) =>
        Math.abs(left.position.x - player.x) - Math.abs(right.position.x - player.x),
      );
    this.triggeredAtState = nowMs;
    active.forEach((instance, index) => {
      instance.fleeAt = nowMs + index * SPRAYER_GROUP_DELAY;
    });
  }

  private snapshotOf(instance: SprayerInstance): SprayerSnapshot {
    return Object.freeze({
      id: instance.config.id,
      state: instance.state,
      position: Object.freeze({ ...instance.position }),
      sprayReady: instance.readyAt <= this.lastNow,
      fleeAt: instance.fleeAt ?? null,
      routeDistance: instance.routeDistance,
      routeLength: instance.routeLength,
    });
  }
}

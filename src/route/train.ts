export const TRAIN_START_X = 2_480;
export const TRAIN_END_X = 480;
export const TRAIN_Y = 310;
export const TRAIN_EXIT_DISTANCE = 4_000;
export const TRAIN_ENTRY_DURATION = 5_000;
export const TRAIN_HOLD_DURATION = 3_000;
export const TRAIN_DEPARTURE_DURATION = 9_000;
export const TRAIN_TILE_SIZE = 16;
// Starts below the spawn player's foot body so an arriving train cannot begin with overlap.
export const TRAIN_COLLISION_TOP = 323;
export const TRAIN_COLLISION_BOTTOM = 359;

export const TRAIN_COLLISION_X_ZONES = Object.freeze([
  Object.freeze({ left: 0, right: 365 }),
  Object.freeze({ left: 360, right: 720 }),
  Object.freeze({ left: 715, right: 1078 }),
  Object.freeze({ left: 1073, right: 1435 }),
]);

export type TrainRouteState =
  | "idle"
  | "arriving"
  | "holding"
  | "departing"
  | "complete"
  | "cancelled"
  | "shutdown";

export interface TrainCollisionRect {
  readonly localLeft: number;
  readonly localRight: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly blockedCells: readonly string[];
}

export interface TrainRouteSnapshot {
  readonly state: TrainRouteState;
  readonly x: number;
  readonly y: number;
  readonly collisionRects: readonly TrainCollisionRect[];
  readonly startedAt: number | null;
  readonly holdUntil: number | null;
}

export interface TrainRouteOptions {
  readonly collisionScale?: number;
  readonly tileSize?: number;
}

function cubicEaseOut(progress: number): number {
  const remaining = 1 - progress;
  return 1 - remaining * remaining * remaining;
}

function quadEaseIn(progress: number): number {
  return progress * progress;
}

function clampProgress(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Deterministic route owner for the public crowdTrain movement. */
export class TrainRouteRuntime {
  private readonly collisionScale: number;
  private readonly tileSize: number;
  private stateState: TrainRouteState = "idle";
  private xState = TRAIN_START_X;
  private startedAtState: number | undefined;
  private holdUntilState: number | undefined;
  private lastNow = 0;

  constructor(options: TrainRouteOptions = {}) {
    this.collisionScale =
      Number.isFinite(options.collisionScale) && options.collisionScale! > 0
        ? options.collisionScale!
        : 1;
    this.tileSize = options.tileSize ?? TRAIN_TILE_SIZE;
  }

  get state(): TrainRouteState {
    return this.stateState;
  }

  get isShutdown(): boolean {
    return this.stateState === "shutdown";
  }

  get snapshot(): TrainRouteSnapshot {
    return Object.freeze({
      state: this.stateState,
      x: this.xState,
      y: TRAIN_Y,
      collisionRects: this.collisionRects,
      startedAt: this.startedAtState ?? null,
      holdUntil: this.holdUntilState ?? null,
    });
  }

  get collisionRects(): readonly TrainCollisionRect[] {
    return Object.freeze(
      TRAIN_COLLISION_X_ZONES.map(({ left: localLeft, right: localRight }) => {
        const left = this.xState + localLeft * this.collisionScale;
        const right = this.xState + localRight * this.collisionScale;
        const top = TRAIN_COLLISION_TOP;
        const bottom = TRAIN_COLLISION_BOTTOM;
        const leftTile = Math.floor(left / this.tileSize);
        const rightTile = Math.floor((right - Number.EPSILON) / this.tileSize);
        const topTile = Math.floor(top / this.tileSize);
        const bottomTile = Math.floor((bottom - Number.EPSILON) / this.tileSize);
        const blockedCells: string[] = [];
        for (let tileX = leftTile; tileX <= rightTile; tileX += 1) {
          for (let tileY = topTile; tileY <= bottomTile; tileY += 1) {
            blockedCells.push(`${tileX},${tileY}`);
          }
        }
        return Object.freeze({
          localLeft,
          localRight,
          left,
          right,
          top,
          bottom,
          centerX: (left + right) / 2,
          centerY: (top + bottom) / 2,
          width: right - left,
          height: bottom - top,
          blockedCells: Object.freeze(blockedCells),
        });
      }),
    );
  }

  start(nowMs: number): boolean {
    if (this.stateState === "shutdown") return false;
    if (
      this.stateState === "arriving" ||
      this.stateState === "holding" ||
      this.stateState === "departing"
    ) {
      return false;
    }
    this.stateState = "arriving";
    this.xState = TRAIN_START_X;
    this.startedAtState = nowMs;
    this.holdUntilState = undefined;
    this.lastNow = nowMs;
    return true;
  }

  tick(nowMs: number): TrainRouteSnapshot {
    if (this.stateState === "shutdown" || this.stateState === "idle") {
      return this.snapshot;
    }
    this.lastNow = Math.max(this.lastNow, nowMs);
    const now = this.lastNow;
    const startedAt = this.startedAtState ?? now;
    const arrivalAt = startedAt + TRAIN_ENTRY_DURATION;

    if (this.stateState === "arriving") {
      if (now < arrivalAt) {
        const progress = clampProgress((now - startedAt) / TRAIN_ENTRY_DURATION);
        this.xState =
          TRAIN_START_X +
          (TRAIN_END_X - TRAIN_START_X) * cubicEaseOut(progress);
        return this.snapshot;
      }
      this.xState = TRAIN_END_X;
      this.stateState = "holding";
      this.holdUntilState = arrivalAt + TRAIN_HOLD_DURATION;
    }

    const holdUntil = this.holdUntilState ?? arrivalAt + TRAIN_HOLD_DURATION;
    if (this.stateState === "holding") {
      this.xState = TRAIN_END_X;
      if (now < holdUntil) return this.snapshot;
      this.stateState = "departing";
    }

    const departureStart = holdUntil;
    const departureEnd = departureStart + TRAIN_DEPARTURE_DURATION;
    if (this.stateState === "departing") {
      if (now < departureEnd) {
        const progress = clampProgress(
          (now - departureStart) / TRAIN_DEPARTURE_DURATION,
        );
        this.xState =
          TRAIN_END_X - TRAIN_EXIT_DISTANCE * quadEaseIn(progress);
        return this.snapshot;
      }
      this.xState = TRAIN_END_X - TRAIN_EXIT_DISTANCE;
      this.stateState = "complete";
    }
    return this.snapshot;
  }

  cancel(nowMs: number = this.lastNow): TrainRouteSnapshot {
    if (this.stateState === "shutdown") return this.snapshot;
    this.tick(nowMs);
    if (
      this.stateState === "arriving" ||
      this.stateState === "holding" ||
      this.stateState === "departing"
    ) {
      this.stateState = "cancelled";
    }
    return this.snapshot;
  }

  shutdown(nowMs: number = this.lastNow): TrainRouteSnapshot {
    if (this.stateState === "shutdown") return this.snapshot;
    this.cancel(nowMs);
    this.stateState = "shutdown";
    return this.snapshot;
  }
}

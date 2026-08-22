export const TRAIN_START_X = 2_480;
export const TRAIN_END_X = 480;
export const TRAIN_Y = 310;
export const TRAIN_EXIT_DISTANCE = 4_000;
export const TRAIN_ENTRY_DURATION = 5_000;
export const TRAIN_HOLD_DURATION = 3_000;
export const TRAIN_DEPARTURE_DURATION = 9_000;
export const TRAIN_TILE_SIZE = 16;
export const TRAIN_COLLISION_ROW = 20;
export const TRAIN_COLLISION_ROW_RADIUS = 2;
export const TRAIN_COLLISION_CENTER_Y =
  TRAIN_COLLISION_ROW * TRAIN_TILE_SIZE + TRAIN_TILE_SIZE / 2;
export const TRAIN_DEFAULT_COLLISION_WIDTH = 1;

export type TrainRouteState =
  | "idle"
  | "arriving"
  | "holding"
  | "departing"
  | "complete"
  | "cancelled"
  | "shutdown";

export interface TrainCollisionBand {
  readonly left: number;
  readonly right: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly leftTile: number;
  readonly rightTile: number;
  readonly blockedCells: readonly string[];
}

export interface TrainRouteSnapshot {
  readonly state: TrainRouteState;
  readonly x: number;
  readonly y: number;
  readonly collisionBand: TrainCollisionBand;
  readonly startedAt: number | null;
  readonly holdUntil: number | null;
}

export interface TrainRouteOptions {
  readonly collisionWidth?: number;
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
  private collisionWidth: number;
  private readonly tileSize: number;
  private stateState: TrainRouteState = "idle";
  private xState = TRAIN_START_X;
  private startedAtState: number | undefined;
  private holdUntilState: number | undefined;
  private lastNow = 0;

  constructor(options: TrainRouteOptions = {}) {
    this.collisionWidth = options.collisionWidth ?? TRAIN_DEFAULT_COLLISION_WIDTH;
    this.tileSize = options.tileSize ?? TRAIN_TILE_SIZE;
  }

  get state(): TrainRouteState {
    return this.stateState;
  }

  get isShutdown(): boolean {
    return this.stateState === "shutdown";
  }

  setCollisionWidth(width: number): void {
    if (Number.isFinite(width) && width > 0) this.collisionWidth = width;
  }

  get snapshot(): TrainRouteSnapshot {
    return Object.freeze({
      state: this.stateState,
      x: this.xState,
      y: TRAIN_Y,
      collisionBand: this.collisionBand,
      startedAt: this.startedAtState ?? null,
      holdUntil: this.holdUntilState ?? null,
    });
  }

  get collisionBand(): TrainCollisionBand {
    const left = this.xState;
    const right = this.xState + this.collisionWidth;
    const leftTile = Math.floor(left / this.tileSize);
    const rightTile = Math.floor(right / this.tileSize);
    const rows: string[] = [];
    for (
      let tileX = leftTile;
      tileX <= rightTile;
      tileX += 1
    ) {
      for (
        let tileY = TRAIN_COLLISION_ROW - TRAIN_COLLISION_ROW_RADIUS;
        tileY <= TRAIN_COLLISION_ROW + TRAIN_COLLISION_ROW_RADIUS;
        tileY += 1
      ) {
        rows.push(`${tileX},${tileY}`);
      }
    }
    const height = (TRAIN_COLLISION_ROW_RADIUS * 2 + 1) * this.tileSize;
    return Object.freeze({
      left,
      right,
      centerX: left + this.collisionWidth / 2,
      centerY: TRAIN_COLLISION_CENTER_Y,
      width: this.collisionWidth,
      height,
      leftTile,
      rightTile,
      blockedCells: Object.freeze(rows),
    });
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

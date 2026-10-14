/**
 * 这一段挡路的横向区间。`left` / `right` 是**火车没动时**的本地坐标，
 * 实际挡哪几格要用「当前 x + 本地坐标 × 缩放」现算。
 */
export interface TrainCollisionZone {
  readonly left: number;
  readonly right: number;
}

/**
 * 一列火车的全部数值。原先它们是这个模块里的一排常量（`TRAIN_START_X` 等 10 个），
 * 现在搬去了 `config/<集名>/05-旁支/SYS-ROUTE/数据/train-config.json`，由外面递进来。
 *
 * 字段一个没改名、一个没改类型，只是换了住址。为什么非搬不可：这几个数决定火车
 * 走多远、停多久、挡哪几格，每个校园的轨道长度都不一样。
 */
export interface TrainConfig {
  readonly startX: number;
  readonly endX: number;
  readonly y: number;
  readonly exitDistance: number;
  readonly entryDurationMs: number;
  readonly holdDurationMs: number;
  readonly departureDurationMs: number;
  readonly tileSize: number;
  readonly collisionTop: number;
  readonly collisionBottom: number;
  readonly collisionXZones: readonly TrainCollisionZone[];
}

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

/**
 * 火车需要的外部输入。两个字段都**必须**由调用方给。
 *
 * `collisionScale` 原先是个可选字段，不给就按 1 算；`tileSize` 更有一个模块常量的
 * 默认值。两个默认值现在都拿掉了，理由和 SYS-NPC 那边一样：留着默认值等于
 * 「没给配置也能跑」，而那时候火车照样开、只是挡路的范围和该挡的对不上——
 * 不报错，看着不对，比直接编译不过难查得多。
 */
export interface TrainRouteOptions {
  readonly collisionScale: number;
  readonly config: TrainConfig;
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
  private readonly config: TrainConfig;
  private stateState: TrainRouteState = "idle";
  private xState: number;
  private startedAtState: number | undefined;
  private holdUntilState: number | undefined;
  private lastNow = 0;

  constructor(options: TrainRouteOptions) {
    this.collisionScale =
      Number.isFinite(options.collisionScale) && options.collisionScale > 0
        ? options.collisionScale
        : 1;
    this.config = options.config;
    // 「还没出发时停在哪儿」也是配置里的值，所以放在构造函数里赋——字段初始值
    // 那会儿 `this.config` 还没拿到。
    this.xState = this.config.startX;
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
      y: this.config.y,
      collisionRects: this.collisionRects,
      startedAt: this.startedAtState ?? null,
      holdUntil: this.holdUntilState ?? null,
    });
  }

  get collisionRects(): readonly TrainCollisionRect[] {
    return Object.freeze(
      this.config.collisionXZones.map(({ left: localLeft, right: localRight }) => {
        const left = this.xState + localLeft * this.collisionScale;
        const right = this.xState + localRight * this.collisionScale;
        const top = this.config.collisionTop;
        const bottom = this.config.collisionBottom;
        const leftTile = Math.floor(left / this.config.tileSize);
        const rightTile = Math.floor(
          (right - Number.EPSILON) / this.config.tileSize,
        );
        const topTile = Math.floor(top / this.config.tileSize);
        const bottomTile = Math.floor(
          (bottom - Number.EPSILON) / this.config.tileSize,
        );
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
    this.xState = this.config.startX;
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
    const arrivalAt = startedAt + this.config.entryDurationMs;

    if (this.stateState === "arriving") {
      if (now < arrivalAt) {
        const progress = clampProgress(
          (now - startedAt) / this.config.entryDurationMs,
        );
        this.xState =
          this.config.startX +
          (this.config.endX - this.config.startX) * cubicEaseOut(progress);
        return this.snapshot;
      }
      this.xState = this.config.endX;
      this.stateState = "holding";
      this.holdUntilState = arrivalAt + this.config.holdDurationMs;
    }

    const holdUntil =
      this.holdUntilState ?? arrivalAt + this.config.holdDurationMs;
    if (this.stateState === "holding") {
      this.xState = this.config.endX;
      if (now < holdUntil) return this.snapshot;
      this.stateState = "departing";
    }

    const departureStart = holdUntil;
    const departureEnd = departureStart + this.config.departureDurationMs;
    if (this.stateState === "departing") {
      if (now < departureEnd) {
        const progress = clampProgress(
          (now - departureStart) / this.config.departureDurationMs,
        );
        this.xState =
          this.config.endX - this.config.exitDistance * quadEaseIn(progress);
        return this.snapshot;
      }
      this.xState = this.config.endX - this.config.exitDistance;
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

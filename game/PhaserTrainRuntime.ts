import { playerDepth } from "../src/layer/index.js";
import {
  TRAIN_END_X,
  TRAIN_ENTRY_DURATION,
  TRAIN_HOLD_DURATION,
  TRAIN_START_X,
  TRAIN_Y,
  TrainRouteRuntime,
  type TrainCollisionRect,
} from "../src/route/index.js";

export const TRAIN_RUNTIME_ASSET = Object.freeze({
  key: "train",
  url: new URL("../src/route/assets/train.webp", import.meta.url).href,
});

const TRAIN_SCALE = (1 / 3) * 0.75 * 4.1;
export const TRAIN_PRESENTATION_DEPTH = playerDepth(TRAIN_Y);

type TrainListener = (...args: unknown[]) => void;

export interface PhaserTrainLoaderLike {
  image(key: string, url: string): unknown;
}

export interface PhaserTrainTextureManagerLike {
  exists(key: string): boolean;
}

export interface PhaserTrainSpriteLike {
  x: number;
  y: number;
  readonly displayWidth?: number;
  readonly displayHeight?: number;
  setOrigin(x: number, y: number): this;
  setScale(value: number): this;
  setDepth(value: number): this;
  setAlpha(value: number): this;
  destroy(): void;
}

export interface PhaserTrainCollisionShapeLike {
  setPosition(x: number, y: number): this;
  setSize(width: number, height: number): this;
  readonly body?: {
    setSize?(width: number, height: number): unknown;
    updateFromGameObject?: () => void;
  };
  destroy(): void;
}

export interface PhaserTrainEventsLike {
  on(event: string, listener: TrainListener, context?: unknown): PhaserTrainEventsLike;
  off(event: string, listener: TrainListener, context?: unknown): PhaserTrainEventsLike;
}

export interface PhaserTrainSceneLike {
  readonly load: PhaserTrainLoaderLike;
  readonly textures: PhaserTrainTextureManagerLike;
  readonly add: {
    sprite(x: number, y: number, texture: string): PhaserTrainSpriteLike;
    rectangle(
      x: number,
      y: number,
      width: number,
      height: number,
      color?: number,
      alpha?: number,
    ): PhaserTrainCollisionShapeLike;
  };
  readonly physics?: {
    readonly add?: {
      existing(target: PhaserTrainCollisionShapeLike, isStatic?: boolean): void;
    };
  };
  readonly events: PhaserTrainEventsLike;
}

export interface PhaserTrainBlockingZonePort {
  setTrainBlockingZone(cells: readonly string[] | null): void;
}

export interface PhaserTrainViewport {
  readonly left: number;
  readonly width: number;
}

export type PhaserTrainCollisionCleanup = () => void;
export type PhaserTrainCollisionConnector = (
  shape: PhaserTrainCollisionShapeLike,
) => PhaserTrainCollisionCleanup;

export interface PhaserTrainRuntimeOptions {
  readonly blockingZone?: PhaserTrainBlockingZonePort;
  readonly connectCollision?: PhaserTrainCollisionConnector;
  readonly viewport?: () => PhaserTrainViewport | undefined;
  /** 设计决定：emitted once when the existing route enters departure. */
  readonly onDeparture?: () => void;
  /** 设计决定：emitted when the train leaves the current viewport or completes. */
  readonly onLeaveViewport?: () => void;
  readonly onComplete?: () => void;
  readonly onError?: (reason: string) => void;
}

export type PhaserTrainStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "shutdown"
        | "already-running"
        | "missing-texture"
        | "sprite-create-failed";
    };

function eventTime(args: readonly unknown[]): number {
  const value = args[0];
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

/** Dedicated Phaser owner for one public crowdTrain route. */
export class PhaserTrainRuntime {
  private readonly route = new TrainRouteRuntime({ collisionScale: TRAIN_SCALE });
  private readonly blockingZone: PhaserTrainBlockingZonePort | undefined;
  private readonly onError: ((reason: string) => void) | undefined;
  private readonly connectCollision: PhaserTrainCollisionConnector | undefined;
  private readonly onComplete: (() => void) | undefined;
  private readonly onDeparture: (() => void) | undefined;
  private readonly onLeaveViewport: (() => void) | undefined;
  private readonly viewport: (() => PhaserTrainViewport | undefined) | undefined;
  private departureNotified = false;
  private departureWasInViewport = false;
  private leaveViewportNotified = false;
  private sprite: PhaserTrainSpriteLike | undefined;
  private collisionShapes: PhaserTrainCollisionShapeLike[] = [];
  private collisionCleanups: PhaserTrainCollisionCleanup[] = [];
  private updateAttached = false;
  private shutdownState = false;
  private lastCells = "";

  private readonly handleUpdate: TrainListener = (...args): void => {
    this.update(eventTime(args));
  };

  private readonly handleShutdown: TrainListener = (...args): void => {
    this.shutdown(eventTime(args));
  };

  constructor(
    private readonly scene: PhaserTrainSceneLike,
    options: PhaserTrainRuntimeOptions = {},
  ) {
    this.blockingZone = options.blockingZone;
    this.connectCollision = options.connectCollision;
    this.onComplete = options.onComplete;
    this.onDeparture = options.onDeparture;
    this.onLeaveViewport = options.onLeaveViewport;
    this.viewport = options.viewport;
    this.onError = options.onError;
  }

  preload(): void {
    if (this.shutdownState) return;
    this.scene.load.image(TRAIN_RUNTIME_ASSET.key, TRAIN_RUNTIME_ASSET.url);
  }

  start(nowMs: number): PhaserTrainStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    if (!this.scene.textures.exists(TRAIN_RUNTIME_ASSET.key)) {
      this.report("missing-texture");
      return { ok: false, reason: "missing-texture" };
    }
    if (!this.route.start(nowMs)) {
      this.report("already-running");
      return { ok: false, reason: "already-running" };
    }

    this.departureNotified = false;
    this.departureWasInViewport = false;
    this.leaveViewportNotified = false;
    try {
      const sprite = this.scene.add.sprite(TRAIN_START_X, TRAIN_Y, TRAIN_RUNTIME_ASSET.key);
      sprite
        .setOrigin(0, 0.5)
        .setScale(TRAIN_SCALE)
        .setDepth(TRAIN_PRESENTATION_DEPTH)
        .setAlpha(1);
      this.sprite = sprite;
      this.createCollisions(this.route.snapshot.collisionRects);
    } catch {
      this.route.cancel(nowMs);
      this.cleanupObjects();
      this.report("sprite-create-failed");
      return { ok: false, reason: "sprite-create-failed" };
    }

    this.attachUpdate();
    this.update(nowMs);
    return { ok: true };
  }

  update(nowMs: number): void {
    if (this.shutdownState || this.sprite === undefined) return;
    const snapshot = this.route.tick(nowMs);
    this.sprite.x = snapshot.x;
    this.sprite.y = snapshot.y;
    this.updateCollisions(snapshot.collisionRects);
    if (snapshot.state === "departing" && !this.departureNotified) {
      this.departureNotified = true;
      this.notify(this.onDeparture);
    }
    if (snapshot.state === "departing" && this.isInsideViewport()) {
      this.departureWasInViewport = true;
    }
    if (
      snapshot.state === "departing" &&
      this.departureWasInViewport &&
      !this.leaveViewportNotified &&
      this.isOutsideViewport()
    ) {
      this.leaveViewportNotified = true;
      this.notify(this.onLeaveViewport);
    }
    if (snapshot.state === "complete" || snapshot.state === "cancelled") {
      if (snapshot.state === "complete" && !this.leaveViewportNotified) {
        this.leaveViewportNotified = true;
        this.notify(this.onLeaveViewport);
      }
      this.detachUpdate();
      if (snapshot.state === "complete") {
        try {
          this.onComplete?.();
        } catch {
          this.report("complete-observer-failed");
        }
      }
      this.cleanupObjects();
    }
  }

  cancel(nowMs?: number): void {
    if (this.shutdownState) return;
    this.route.cancel(nowMs);
    this.detachUpdate();
    this.cleanupObjects();
  }

  shutdown(nowMs?: number): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.route.shutdown(nowMs);
    this.detachUpdate();
    this.cleanupObjects();
  }

  get snapshot() {
    return this.route.snapshot;
  }

  get hasSprite(): boolean {
    return this.sprite !== undefined;
  }

  get hasCollisionShape(): boolean {
    return this.collisionShapes.length > 0;
  }

  get collisionShapeCount(): number {
    return this.collisionShapes.length;
  }

  get visualSnapshot() {
    const sprite = this.sprite;
    if (sprite === undefined) return null;
    const width = sprite.displayWidth ?? 0;
    const height = sprite.displayHeight ?? 0;
    return Object.freeze({
      x: sprite.x,
      y: sprite.y,
      width,
      height,
      left: sprite.x,
      right: sprite.x + width,
      top: sprite.y - height / 2,
      bottom: sprite.y + height / 2,
      depth: TRAIN_PRESENTATION_DEPTH,
    });
  }

  private createCollisions(rects: readonly TrainCollisionRect[]): void {
    for (const rect of rects) {
      const shape = this.scene.add.rectangle(
        rect.centerX,
        rect.centerY,
        rect.width,
        rect.height,
        0,
        0,
      );
      this.scene.physics?.add?.existing(shape, true);
      this.collisionShapes.push(shape);
      const cleanup = this.connectCollision?.(shape);
      if (cleanup !== undefined && typeof cleanup !== "function") {
        throw new TypeError("train collision connector did not return cleanup");
      }
      if (cleanup !== undefined) this.collisionCleanups.push(cleanup);
    }
    this.updateCollisions(rects);
  }

  private updateCollisions(rects: readonly TrainCollisionRect[]): void {
    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];
      const shape = this.collisionShapes[index];
      if (rect === undefined || shape === undefined) continue;
      shape.setPosition(rect.centerX, rect.centerY).setSize(
        rect.width,
        rect.height,
      );
      shape.body?.setSize?.(rect.width, rect.height);
      shape.body?.updateFromGameObject?.();
    }
    const blockedCells = new Set<string>();
    for (const rect of rects) {
      for (const cell of rect.blockedCells) blockedCells.add(cell);
    }
    const cells = [...blockedCells].sort().join("|");
    if (cells === this.lastCells) return;
    this.lastCells = cells;
    this.blockingZone?.setTrainBlockingZone(
      cells.length === 0 ? [] : cells.split("|"),
    );
  }

  private cleanupObjects(): void {
    const cleanups = this.collisionCleanups.splice(0);
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        this.report("collision-cleanup-failed");
      }
    }
    for (const shape of this.collisionShapes.splice(0)) shape.destroy();
    this.sprite?.destroy();
    this.sprite = undefined;
    this.lastCells = "";
    this.blockingZone?.setTrainBlockingZone(null);
  }

  private attachUpdate(): void {
    if (this.updateAttached) return;
    this.scene.events.on("update", this.handleUpdate, this);
    this.scene.events.on("shutdown", this.handleShutdown, this);
    this.updateAttached = true;
  }

  private detachUpdate(): void {
    if (!this.updateAttached) return;
    this.scene.events.off("update", this.handleUpdate, this);
    this.scene.events.off("shutdown", this.handleShutdown, this);
    this.updateAttached = false;
  }

  private isInsideViewport(): boolean {
    const viewport = this.viewport?.();
    if (viewport === undefined || this.sprite === undefined) return false;
    const width = this.sprite.displayWidth ?? 0;
    return this.sprite.x + width >= viewport.left &&
      this.sprite.x <= viewport.left + viewport.width;
  }

  private isOutsideViewport(): boolean {
    return !this.isInsideViewport() && this.viewport?.() !== undefined;
  }

  private notify(callback: (() => void) | undefined): void {
    try {
      callback?.();
    } catch {
      this.report("lifecycle-observer-failed");
    }
  }

  private report(reason: string): void {
    this.onError?.(reason);
  }
}

export { TRAIN_END_X, TRAIN_ENTRY_DURATION, TRAIN_HOLD_DURATION };

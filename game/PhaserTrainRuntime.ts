import {
  TRAIN_END_X,
  TRAIN_ENTRY_DURATION,
  TRAIN_HOLD_DURATION,
  TRAIN_START_X,
  TRAIN_Y,
  TrainRouteRuntime,
  type TrainCollisionBand,
} from "../src/route/index.js";

export const TRAIN_RUNTIME_ASSET = Object.freeze({
  key: "train",
  url: new URL("../src/route/assets/train.webp", import.meta.url).href,
});

const TRAIN_SCALE = (1 / 3) * 0.75 * 4.1;
const TRAIN_DEPTH = 1_001;

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

export interface PhaserTrainRuntimeOptions {
  readonly blockingZone?: PhaserTrainBlockingZonePort;
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
  private readonly route = new TrainRouteRuntime();
  private readonly blockingZone: PhaserTrainBlockingZonePort | undefined;
  private readonly onError: ((reason: string) => void) | undefined;
  private sprite: PhaserTrainSpriteLike | undefined;
  private collisionShape: PhaserTrainCollisionShapeLike | undefined;
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

    try {
      const sprite = this.scene.add.sprite(TRAIN_START_X, TRAIN_Y, TRAIN_RUNTIME_ASSET.key);
      sprite
        .setOrigin(0, 0.5)
        .setScale(TRAIN_SCALE)
        .setDepth(TRAIN_DEPTH)
        .setAlpha(1);
      this.sprite = sprite;
      this.route.setCollisionWidth(
        typeof sprite.displayWidth === "number" && sprite.displayWidth > 0
          ? sprite.displayWidth
          : 1,
      );
      this.createCollision(this.route.snapshot.collisionBand);
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
    this.updateCollision(snapshot.collisionBand);
    if (snapshot.state === "complete" || snapshot.state === "cancelled") {
      this.detachUpdate();
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

  private createCollision(band: TrainCollisionBand): void {
    if (this.collisionShape !== undefined) return;
    const shape = this.scene.add.rectangle(
      band.centerX,
      band.centerY,
      band.width,
      band.height,
      0,
      0,
    );
    this.scene.physics?.add?.existing(shape, true);
    this.collisionShape = shape;
    this.updateCollision(band);
  }

  private updateCollision(band: TrainCollisionBand): void {
    this.collisionShape?.setPosition(band.centerX, band.centerY).setSize(
      band.width,
      band.height,
    );
    this.collisionShape?.body?.updateFromGameObject?.();
    const cells = band.blockedCells.join("|");
    if (cells === this.lastCells) return;
    this.lastCells = cells;
    this.blockingZone?.setTrainBlockingZone(band.blockedCells);
  }

  private cleanupObjects(): void {
    this.sprite?.destroy();
    this.sprite = undefined;
    this.collisionShape?.destroy();
    this.collisionShape = undefined;
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

  private report(reason: string): void {
    this.onError?.(reason);
  }
}

export { TRAIN_END_X, TRAIN_ENTRY_DURATION, TRAIN_HOLD_DURATION };

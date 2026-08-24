import {
  SPRAYER_CONFIGS,
  SprayerGroupRuntime,
  type SprayerPlayerPosition,
  type SprayerSnapshot,
} from "../src/npc/index.js";

export const SPRAYER_RUNTIME_ASSETS = Object.freeze([
  {
    key: "npc-sprayer",
    url: new URL("../src/npc/assets/npc-sprayer.webp", import.meta.url).href,
    frameWidth: 64,
    frameHeight: 64,
    startFrame: 0,
    endFrame: 15,
  },
  {
    key: "npc-sprayer-running",
    url: new URL("../src/npc/assets/npc-sprayer-running.webp", import.meta.url).href,
    frameWidth: 48,
    frameHeight: 48,
    startFrame: 0,
    endFrame: 63,
  },
] as const);

const SPRAY_ANIMATION = "npc-sprayer-spray";
const RUNNING_DIRECTION_ANIMATION = {
  north: "npc-sprayer-running-north",
  south: "npc-sprayer-running-south",
  east: "npc-sprayer-running-east",
  west: "npc-sprayer-running-west",
} as const;

function runningDirection(dx: number, dy: number): keyof typeof RUNNING_DIRECTION_ANIMATION {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "east" : "west";
  return dy >= 0 ? "south" : "north";
}
const SPRAYER_PRESENTATION_DEPTH_BASE = 500;
const SPRAYER_PRESENTATION_DEPTH_OFFSET_Y = 24;

export function sprayerPresentationDepth(y: number): number {
  return (
    SPRAYER_PRESENTATION_DEPTH_BASE +
    (y + SPRAYER_PRESENTATION_DEPTH_OFFSET_Y) * 0.1
  );
}

type PhaserListener = (...args: unknown[]) => void;

export interface PhaserSprayerLoaderLike {
  spritesheet(
    key: string,
    url: string,
    config: {
      readonly frameWidth: number;
      readonly frameHeight: number;
      readonly startFrame: number;
      readonly endFrame: number;
    },
  ): unknown;
}

export interface PhaserSprayerTextureManagerLike {
  exists(key: string): boolean;
}

export interface PhaserSprayerAnimationManagerLike {
  generateFrameNumbers(
    key: string,
    range: { readonly start: number; readonly end: number },
  ): readonly unknown[];
  create(config: {
    readonly key: string;
    readonly frames: readonly unknown[];
    readonly frameRate: number;
    readonly repeat: number;
  }): unknown;
  exists?(key: string): boolean;
}

export interface PhaserSprayerAnimationControllerLike {
  play(key: string, ignoreIfPlaying?: boolean): unknown;
  stop?(): unknown;
}

export interface PhaserSprayerSpriteLike {
  x: number;
  y: number;
  readonly anims?: PhaserSprayerAnimationControllerLike;
  readonly displayWidth?: number;
  readonly displayHeight?: number;
  setScale(value: number): this;
  setDepth(value: number): this;
  setTexture(key: string): this;
  setFrame(frame: number): this;
  destroy(): void;
}

export interface PhaserSprayerEventsLike {
  on(event: string, listener: PhaserListener, context?: unknown): this;
  off(event: string, listener: PhaserListener, context?: unknown): this;
}

export interface PhaserSprayerSceneLike {
  readonly load: PhaserSprayerLoaderLike;
  readonly anims: PhaserSprayerAnimationManagerLike;
  readonly textures: PhaserSprayerTextureManagerLike;
  readonly add: {
    sprite(x: number, y: number, texture: string): PhaserSprayerSpriteLike;
  };
  readonly events: PhaserSprayerEventsLike;
}

export interface PhaserSprayerRuntimeOptions {
  readonly random?: () => number;
  readonly playerPosition?: () => SprayerPlayerPosition | undefined;
  readonly onTriggered?: () => void;
  readonly onError?: (reason: string) => void;
}

export type PhaserSprayerStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "shutdown"
        | "already-running"
        | "missing-idle-texture"
        | "missing-running-texture"
        | "sprite-create-failed";
    };

function eventTime(args: readonly unknown[]): number {
  const value = args[0];
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

/** Phaser owner for the public four-sprayer group. */
export class PhaserSprayerRuntime {
  private readonly group: SprayerGroupRuntime;
  private readonly playerPosition: (() => SprayerPlayerPosition | undefined) | undefined;
  private readonly onTriggered: (() => void) | undefined;
  private readonly onError: ((reason: string) => void) | undefined;
  private readonly sprites = new Map<string, PhaserSprayerSpriteLike>();
  private triggerPublished = false;
  private updateAttached = false;
  private shutdownState = false;

  private readonly handleUpdate: PhaserListener = (...args): void => {
    this.update(eventTime(args));
  };

  private readonly handleShutdown: PhaserListener = (): void => {
    this.shutdown();
  };

  constructor(
    private readonly scene: PhaserSprayerSceneLike,
    options: PhaserSprayerRuntimeOptions = {},
  ) {
    this.group = new SprayerGroupRuntime({ random: options.random ?? Math.random });
    this.playerPosition = options.playerPosition;
    this.onTriggered = options.onTriggered;
    this.onError = options.onError;
  }

  preload(): void {
    if (this.shutdownState) return;
    for (const asset of SPRAYER_RUNTIME_ASSETS) {
      this.scene.load.spritesheet(asset.key, asset.url, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
        startFrame: asset.startFrame,
        endFrame: asset.endFrame,
      });
    }
  }

  createAnimations(): void {
    if (this.shutdownState) return;
    this.createAnimationIfAvailable(
      "npc-sprayer",
      SPRAY_ANIMATION,
      0,
      15,
      6,
      -1,
    );
    // The running sheet has eight direction rows of eight frames. Never loop all 64 frames.
    // The first row is the front view; the third row is the rear view.
    this.createAnimationIfAvailable("npc-sprayer-running", RUNNING_DIRECTION_ANIMATION.south, 0, 7, 6, -1);
    this.createAnimationIfAvailable("npc-sprayer-running", RUNNING_DIRECTION_ANIMATION.east, 8, 15, 6, -1);
    this.createAnimationIfAvailable("npc-sprayer-running", RUNNING_DIRECTION_ANIMATION.north, 16, 23, 6, -1);
    this.createAnimationIfAvailable("npc-sprayer-running", RUNNING_DIRECTION_ANIMATION.west, 24, 31, 6, -1);
  }

  start(nowMs: number): PhaserSprayerStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    const result = this.group.start(nowMs, {
      idleTexture: this.scene.textures.exists("npc-sprayer"),
      runningTexture: this.scene.textures.exists("npc-sprayer-running"),
    });
    if (!result.ok) {
      this.report(result.reason);
      return result;
    }

    try {
      for (const instance of SPRAYER_CONFIGS) {
        const snapshot = this.group.snapshot.instances.find(
          (candidate) => candidate.id === instance.id,
        );
        if (snapshot === undefined) throw new Error(`missing ${instance.id}`);
        const sprite = this.scene.add.sprite(
          snapshot.position.x,
          snapshot.position.y,
          "npc-sprayer",
        );
        sprite
          .setScale(instance.scale)
          .setDepth(sprayerPresentationDepth(snapshot.position.y));
        this.sprites.set(instance.id, sprite);
      }
    } catch {
      this.group.cancel();
      this.destroySprites();
      this.report("sprite-create-failed");
      return { ok: false, reason: "sprite-create-failed" };
    }

    this.triggerPublished = false;
    this.attachUpdate();
    this.apply(this.group.tick(nowMs, this.playerPosition?.()));
    return { ok: true };
  }

  update(nowMs: number, player = this.playerPosition?.()): void {
    if (this.shutdownState) return;
    this.apply(this.group.tick(nowMs, player));
  }

  cancel(): void {
    if (this.shutdownState) return;
    this.group.cancel();
    this.detachUpdate();
    this.destroySprites();
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.detachUpdate();
    this.group.shutdown();
    this.destroySprites();
  }

  get snapshot() {
    return this.group.snapshot;
  }

  get spriteCount(): number {
    return this.sprites.size;
  }

  get visualSnapshots() {
    return Object.freeze(
      [...this.sprites.entries()].map(([id, sprite]) => {
        const width = sprite.displayWidth ?? 0;
        const height = sprite.displayHeight ?? 0;
        return Object.freeze({
          id,
          x: sprite.x,
          y: sprite.y,
          width,
          height,
          left: sprite.x - width / 2,
          right: sprite.x + width / 2,
          top: sprite.y - height / 2,
          bottom: sprite.y + height / 2,
          depth: sprayerPresentationDepth(sprite.y),
        });
      }),
    );
  }

  private apply(snapshot: ReturnType<SprayerGroupRuntime["tick"]>): void {
    for (const instance of snapshot.instances) {
      const sprite = this.sprites.get(instance.id);
      if (sprite === undefined) continue;
      if (
        instance.state === "gone" ||
        instance.state === "cancelled" ||
        instance.state === "shutdown"
      ) {
        sprite.destroy();
        this.sprites.delete(instance.id);
        continue;
      }
      const dx = instance.position.x - sprite.x;
      const dy = instance.position.y - sprite.y;
      sprite.x = instance.position.x;
      sprite.y = instance.position.y;
      sprite.setDepth(sprayerPresentationDepth(instance.position.y));
      if (instance.state === "fleeing") {
        // Playing a spritesheet animation selects its texture. Resetting the
        // texture every update would pin the animation to its first frame.
        sprite.anims?.play(
          RUNNING_DIRECTION_ANIMATION[
            dx === 0 && dy === 0 ? "south" : runningDirection(dx, dy)
          ],
          true,
        );
      } else if (instance.sprayReady) {
        sprite.setTexture("npc-sprayer");
        sprite.anims?.play(SPRAY_ANIMATION, true);
      }
    }
    if (snapshot.triggeredAt !== null && !this.triggerPublished) {
      this.triggerPublished = true;
      try {
        this.onTriggered?.();
      } catch {
        this.report("trigger-observer-failed");
      }
    }
    if (
      snapshot.started &&
      snapshot.instances.length > 0 &&
      snapshot.instances.every(
        (instance) =>
          instance.state === "gone" ||
          instance.state === "cancelled" ||
          instance.state === "shutdown",
      )
    ) {
      this.detachUpdate();
    }
  }

  private createAnimationIfAvailable(
    texture: string,
    key: string,
    start: number,
    end: number,
    frameRate: number,
    repeat: number,
  ): void {
    if (!this.scene.textures.exists(texture)) return;
    if (this.scene.anims.exists?.(key)) return;
    try {
      this.scene.anims.create({
        key,
        frames: this.scene.anims.generateFrameNumbers(texture, { start, end }),
        frameRate,
        repeat,
      });
    } catch {
      this.report(`animation-create-failed:${key}`);
    }
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

  private destroySprites(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  private report(reason: string): void {
    this.onError?.(reason);
  }
}

export type { SprayerSnapshot };

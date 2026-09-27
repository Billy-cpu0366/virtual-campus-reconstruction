import { walkFrameStart, WALK_FRAMES_PER_DIRECTION } from "../src/player/appearance.js";
import type { Direction } from "../src/input/index.js";
import {
  SprayerGroupRuntime,
  type SprayerConfig,
  type SprayerPlayerPosition,
  type SprayerSnapshot,
} from "../src/npc/index.js";
import type { SprayerPresentationAsset } from "../config/骨架/05-旁支/SYS-NPC/逻辑/types.js";

/**
 * 这两张贴图**分别演什么**——站着喷水的那张、跑动的那张。
 *
 * 名字本身就是身份（代码靠它认出「哪张是站着的那张」），所以写在代码里，
 * 不是可调的值。帧规格、图在哪，全部来自 `sprayer-presentation.json`。
 */
const SPRAYER_IDLE_TEXTURE = "npc-sprayer";
const SPRAYER_RUNNING_TEXTURE = "npc-sprayer-running";

/** 从配置里找出演某个角色的那张贴图；缺了就直接报错，不静默跳过。 */
function sprayerAssetFor(
  presentation: readonly SprayerPresentationAsset[],
  key: string,
): SprayerPresentationAsset {
  const asset = presentation.find((item) => item.key === key);
  if (asset === undefined) {
    throw new Error(`sprayer presentation is missing "${key}"`);
  }
  return asset;
}

/**
 * 取图地址直接来自配置（`url`，形如 `/sprites/npc-sprayer.webp`）。
 *
 * 原先这里是 `new URL(\`../${asset.sourceFile}\`, import.meta.url)`——**那种写法在
 * 打包器眼里是动态路径**，它静态分析不了，于是替换成一张「根目录下有哪些文件」的
 * 查表，贴图不在表里就取到空值，最后请求发去 `/game/undefined`，图片一次都没下，
 * Phaser 登记不到贴图，整个动态世界起不来。写成配置里的现成地址就没有这一层。
 */
function sprayerAssetUrl(asset: SprayerPresentationAsset): string {
  return asset.url;
}

const SPRAY_ANIMATION = "npc-sprayer-spray";
const RUNNING_DIRECTIONS: readonly Direction[] = [
  "east", "north-east", "north-west", "north",
  "south-east", "south-west", "south", "west",
];

function runningAnimation(direction: Direction): string {
  return `npc-sprayer-running-${direction}`;
}

function runningDirection(dx: number, dy: number): Direction {
  const horizontal = dx === 0 ? "" : dx > 0 ? "east" : "west";
  const vertical = dy === 0 ? "" : dy > 0 ? "south" : "north";
  if (horizontal !== "" && vertical !== "") return `${vertical}-${horizontal}` as Direction;
  return horizontal === "" ? vertical as Direction : horizontal as Direction;
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

/**
 * 把两张喷水器贴图登记给 Phaser 的加载队列。
 *
 * 它单独是一个函数、而不是只留在类里，是因为**登记贴图必须发生在场景的 preload
 * 阶段**，而那时还没读配置——喷水器对象要等到读配置那一步才造得出来。所以场景
 * 先调这个函数把图排上队，读完配置再造对象。
 */
export function preloadSprayerRuntimeAssets(
  loader: PhaserSprayerLoaderLike,
  presentation: readonly SprayerPresentationAsset[],
): void {
  for (const asset of presentation) {
    loader.spritesheet(asset.key, sprayerAssetUrl(asset), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      startFrame: asset.startFrame,
      endFrame: asset.endFrame,
    });
  }
}

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
  /** 四个喷水器的位置和逃跑路线——来自 `sprayer-configs.json`。 */
  readonly configs: readonly SprayerConfig[];
  /** 五项调参：逃跑速度、同组出发间隔、喷雾延迟上限、触发范围——来自 `sprayer-tuning.json`。 */
  readonly tuning: {
    readonly fleeSpeed: number;
    readonly groupDelay: number;
    readonly sprayDelayMax: number;
    readonly triggerVerticalMaxTiles: number;
    readonly triggerHorizontalTiles: number;
  };
  readonly random?: () => number;
  readonly playerPosition?: () => SprayerPlayerPosition | undefined;
  /** 两张贴图的帧规格——来自 `sprayer-presentation.json`。 */
  readonly presentation: readonly SprayerPresentationAsset[];
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
  private readonly configs: readonly SprayerConfig[];
  private readonly presentation: readonly SprayerPresentationAsset[];
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
    options: PhaserSprayerRuntimeOptions,
  ) {
    this.configs = options.configs;
    this.presentation = options.presentation;
    this.group = new SprayerGroupRuntime({
      configs: options.configs,
      tuning: options.tuning,
      ...(options.random === undefined ? {} : { random: options.random }),
    });
    this.playerPosition = options.playerPosition;
    this.onTriggered = options.onTriggered;
    this.onError = options.onError;
  }

  preload(): void {
    if (this.shutdownState) return;
    preloadSprayerRuntimeAssets(this.scene.load, this.presentation);
  }

  createAnimations(): void {
    if (this.shutdownState) return;
    const idle = sprayerAssetFor(this.presentation, SPRAYER_IDLE_TEXTURE);
    this.createAnimationIfAvailable(
      idle.key,
      SPRAY_ANIMATION,
      idle.startFrame,
      idle.endFrame,
      idle.frameRate,
      -1,
    );
    // The running sheet has eight direction rows of eight frames. Never loop all 64 frames.
    const running = sprayerAssetFor(this.presentation, SPRAYER_RUNNING_TEXTURE);
    for (const direction of RUNNING_DIRECTIONS) {
      const start = walkFrameStart(direction);
      this.createAnimationIfAvailable(
        running.key, runningAnimation(direction),
        start, start + WALK_FRAMES_PER_DIRECTION - 1, running.frameRate, -1,
      );
    }
  }

  start(nowMs: number): PhaserSprayerStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    const result = this.group.start(nowMs, {
      idleTexture: this.scene.textures.exists(SPRAYER_IDLE_TEXTURE),
      runningTexture: this.scene.textures.exists(SPRAYER_RUNNING_TEXTURE),
    });
    if (!result.ok) {
      this.report(result.reason);
      return result;
    }

    try {
      for (const instance of this.configs) {
        const snapshot = this.group.snapshot.instances.find(
          (candidate) => candidate.id === instance.id,
        );
        if (snapshot === undefined) throw new Error(`missing ${instance.id}`);
        const sprite = this.scene.add.sprite(
          snapshot.position.x,
          snapshot.position.y,
          SPRAYER_IDLE_TEXTURE,
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
          runningAnimation(
            dx === 0 && dy === 0 ? "south" : runningDirection(dx, dy)
          ),
          true,
        );
      } else if (instance.sprayReady) {
        sprite.setTexture(SPRAYER_IDLE_TEXTURE);
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

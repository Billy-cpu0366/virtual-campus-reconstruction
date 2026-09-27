import {
  StaticNpcRuntime,
  type StaticNpcConfig,
  type StaticNpcFrameDuration,
  type StaticNpcViewport,
} from "../src/npc/index.js";
import type { StaticNpcPresentationAsset } from "../config/骨架/05-旁支/SYS-NPC/逻辑/types.js";

export interface PhaserStaticNpcLoaderLike {
  spritesheet(
    key: string,
    url: string,
    config: { readonly frameWidth: number; readonly frameHeight: number },
  ): unknown;
}

export interface PhaserStaticNpcTextureManagerLike {
  exists(key: string): boolean;
}

export interface PhaserStaticNpcAnimationManagerLike {
  create(config: {
    readonly key: string;
    readonly frames: readonly unknown[];
    readonly repeat: number;
  }): unknown;
  exists?(key: string): boolean;
}

export interface PhaserStaticNpcSpriteLike {
  x: number;
  y: number;
  readonly anims?: { play(key: string, ignoreIfPlaying?: boolean): unknown };
  setScale(value: number): this;
  setDepth(value: number): this;
  destroy(): void;
}

export interface PhaserStaticNpcSceneLike {
  readonly anims: PhaserStaticNpcAnimationManagerLike;
  readonly textures: PhaserStaticNpcTextureManagerLike;
  readonly add: {
    sprite(x: number, y: number, texture: string): PhaserStaticNpcSpriteLike;
  };
}

export interface PhaserStaticNpcRuntimeOptions {
  readonly viewport: () => StaticNpcViewport | undefined;
  /** 站哪三个人、各站哪个格子——来自 `static-npc-configs.json`。 */
  readonly configs: readonly StaticNpcConfig[];
  /** 视口外多远就把人撤掉——来自 `static-npc-tuning.json`。 */
  readonly viewportMargin: number;
  /**
   * 三张特殊贴图的帧规格——来自 `static-npc-presentation.json`。
   *
   * 运行时要用它拿每张图有几帧：动画帧表按这个数建。`[].key` 必须和上面
   * `configs[].spriteKey` 对得上，缺了会在 `start()` 里报 `missing-presentation`。
   */
  readonly presentation: readonly StaticNpcPresentationAsset[];
  readonly onError?: (reason: string) => void;
}

export type PhaserStaticNpcStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "shutdown" | "missing-texture" | "missing-presentation";
    };

export function preloadStaticNpcRuntimeAssets(
  loader: PhaserStaticNpcLoaderLike,
  presentation: readonly StaticNpcPresentationAsset[],
): void {
  for (const asset of presentation) {
    loader.spritesheet(asset.key, asset.url, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
    });
  }
}

function frameDuration(
  config: StaticNpcConfig,
  frame: number,
): number {
  const custom = config.frameDurations?.find(
    (duration: StaticNpcFrameDuration) => duration.frame === frame,
  );
  return custom?.duration ?? 1_000 / config.frameRate;
}

/**
 * 建一条「原地循环播」的动画帧表。
 *
 * 帧数从配置里来——原先这里写死 `length: 16`，换一张帧数不同的图，人照样出现，
 * 只是动画播不全，而且不报错。三张图现在都是 16 帧，见 `static-npc-presentation.json`。
 */
function animationFrames(
  config: StaticNpcConfig,
  frameCount: number,
): readonly unknown[] {
  return Array.from({ length: frameCount }, (_, frame) => ({
    key: config.spriteKey,
    frame,
    duration: frameDuration(config, frame),
  }));
}

/** Presentation owner for static NPCs with viewport-bounded object lifetime. */
export class PhaserStaticNpcRuntime {
  private readonly core: StaticNpcRuntime;
  private readonly sprites = new Map<string, PhaserStaticNpcSpriteLike>();
  private readonly createdAnimations = new Set<string>();
  private shutdownState = false;

  constructor(
    private readonly scene: PhaserStaticNpcSceneLike,
    private readonly options: PhaserStaticNpcRuntimeOptions,
  ) {
    this.core = new StaticNpcRuntime({
      configs: options.configs,
      viewportMargin: options.viewportMargin,
    });
  }

  get snapshot() {
    return this.core.snapshot;
  }

  get configs(): readonly StaticNpcConfig[] {
    return this.options.configs;
  }

  get spriteCount(): number {
    return this.sprites.size;
  }

  start(): PhaserStaticNpcStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    const missing = this.options.configs.find(
      (config) => !this.scene.textures.exists(config.spriteKey),
    );
    if (missing !== undefined) {
      this.report(`missing-texture:${missing.spriteKey}`);
      return { ok: false, reason: "missing-texture" };
    }
    const missingPresentation = this.options.configs.find(
      (config) => this.frameCountFor(config.spriteKey) === undefined,
    );
    if (missingPresentation !== undefined) {
      this.report(`missing-presentation:${missingPresentation.spriteKey}`);
      return { ok: false, reason: "missing-presentation" };
    }
    this.core.start(this.options.viewport());
    this.sync();
    return { ok: true };
  }

  update(): void {
    if (this.shutdownState) return;
    this.core.tick(this.options.viewport());
    this.sync();
  }

  cancel(): void {
    if (this.shutdownState) return;
    this.core.cancel();
    this.destroySprites();
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.core.shutdown();
    this.destroySprites();
  }

  private sync(): void {
    const configs = new Map<string, StaticNpcConfig>(
      this.options.configs.map((config) => [config.id, config]),
    );
    const active = new Set<string>();
    for (const item of this.core.snapshot.instances) {
      if (!item.materialized) continue;
      active.add(item.id);
      const config = configs.get(item.id);
      if (config === undefined) continue;
      const frameCount = this.frameCountFor(config.spriteKey);
      if (frameCount === undefined) continue;
      const sprite = this.sprites.get(item.id) ?? this.createSprite(config, frameCount, item.position.x, item.position.y);
      sprite.x = item.position.x;
      sprite.y = item.position.y;
      sprite.setDepth(500 + item.position.y * 0.1);
      sprite.anims?.play(`static-npc-${config.id}`, true);
      this.sprites.set(item.id, sprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (active.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }

  /** 这张图上一共几帧。配置里没登记这张图就返回 undefined——`start()` 会报出来。 */
  private frameCountFor(spriteKey: string): number | undefined {
    return this.options.presentation.find((asset) => asset.key === spriteKey)
      ?.frameCount;
  }

  private createSprite(
    config: StaticNpcConfig,
    frameCount: number,
    x: number,
    y: number,
  ): PhaserStaticNpcSpriteLike {
    const animationKey = `static-npc-${config.id}`;
    this.ensureAnimation(config, animationKey, frameCount);
    const sprite = this.scene.add.sprite(x, y, config.spriteKey);
    return sprite.setScale(config.scale);
  }

  private ensureAnimation(
    config: StaticNpcConfig,
    key: string,
    frameCount: number,
  ): void {
    if (this.createdAnimations.has(key) || this.scene.anims.exists?.(key) === true) {
      this.createdAnimations.add(key);
      return;
    }
    const frames = animationFrames(config, frameCount);
    this.scene.anims.create({ key, frames, repeat: -1 });
    this.createdAnimations.add(key);
  }

  private destroySprites(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  private report(reason: string): void {
    try {
      this.options.onError?.(reason);
    } catch {
      // A diagnostic observer must not break the NPC lifecycle.
    }
  }
}

import {
  STATIC_NPC_CONFIGS,
  StaticNpcRuntime,
  type StaticNpcConfig,
  type StaticNpcFrameDuration,
  type StaticNpcViewport,
} from "../src/npc/index.js";

export const STATIC_NPC_RUNTIME_ASSETS = Object.freeze([
  {
    key: "npc-special-reading",
    url: "/sprites/special/npc-special-reading.webp",
    frameWidth: 64,
    frameHeight: 64,
  },
  {
    key: "npc-special-eating",
    url: "/sprites/special/npc-special-eating.webp",
    frameWidth: 64,
    frameHeight: 64,
  },
  {
    key: "npc-cat-licking",
    url: "/sprites/special/npc-cat-licking.webp",
    frameWidth: 48,
    frameHeight: 48,
  },
] as const);

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
  readonly viewportMargin?: number;
  readonly onError?: (reason: string) => void;
}

export type PhaserStaticNpcStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "shutdown" | "missing-texture";
    };

export function preloadStaticNpcRuntimeAssets(
  loader: PhaserStaticNpcLoaderLike,
): void {
  for (const asset of STATIC_NPC_RUNTIME_ASSETS) {
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

function animationFrames(config: StaticNpcConfig): readonly unknown[] {
  return Array.from({ length: 16 }, (_, frame) => ({
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
      ...(options.viewportMargin === undefined
        ? {}
        : { viewportMargin: options.viewportMargin }),
    });
  }

  get snapshot() {
    return this.core.snapshot;
  }

  get configs(): readonly StaticNpcConfig[] {
    return STATIC_NPC_CONFIGS;
  }

  get spriteCount(): number {
    return this.sprites.size;
  }

  start(): PhaserStaticNpcStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    const missing = STATIC_NPC_CONFIGS.find(
      (config) => !this.scene.textures.exists(config.spriteKey),
    );
    if (missing !== undefined) {
      this.report(`missing-texture:${missing.spriteKey}`);
      return { ok: false, reason: "missing-texture" };
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
      STATIC_NPC_CONFIGS.map((config) => [config.id, config]),
    );
    const active = new Set<string>();
    for (const item of this.core.snapshot.instances) {
      if (!item.materialized) continue;
      active.add(item.id);
      const config = configs.get(item.id);
      if (config === undefined) continue;
      const sprite = this.sprites.get(item.id) ?? this.createSprite(config, item.position.x, item.position.y);
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

  private createSprite(
    config: StaticNpcConfig,
    x: number,
    y: number,
  ): PhaserStaticNpcSpriteLike {
    const animationKey = `static-npc-${config.id}`;
    this.ensureAnimation(config, animationKey);
    const sprite = this.scene.add.sprite(x, y, config.spriteKey);
    return sprite.setScale(config.scale);
  }

  private ensureAnimation(config: StaticNpcConfig, key: string): void {
    if (this.createdAnimations.has(key) || this.scene.anims.exists?.(key) === true) {
      this.createdAnimations.add(key);
      return;
    }
    const frames = animationFrames(config);
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

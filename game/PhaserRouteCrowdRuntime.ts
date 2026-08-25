import {
  ROUTE_CROWD_CONFIGS,
  RouteCrowdRuntime,
  type RouteCrowdFacing,
  type RouteCrowdPathProvider,
  type RouteCrowdTile,
  type RouteCrowdViewport,
} from "../src/npc/index.js";
import {
  ANIMATION_FRAME_RATE,
  WALK_FRAMES_PER_DIRECTION,
  walkFrameStart,
} from "../src/player/index.js";

export const ROUTE_CROWD_TEXTURES = Object.freeze([
  "npc-man", "npc-man2", "npc-woman", "npc-woman2", "npc-woman3",
  "npc-woman4", "npc-woman5", "npc-woman6", "npc-woman7", "npc-woman8",
  "npc-man3", "npc-man4", "npc-man5", "npc-man6", "npc-man8",
  "npc-man9", "npc-man10",
] as const);

export interface PhaserRouteCrowdLoaderLike {
  spritesheet(
    key: string,
    url: string,
    config: { readonly frameWidth: number; readonly frameHeight: number },
  ): unknown;
}

export function preloadRouteCrowdRuntimeAssets(
  loader: PhaserRouteCrowdLoaderLike,
): void {
  for (const texture of ROUTE_CROWD_TEXTURES) {
    loader.spritesheet(texture, `/sprites/${texture}.webp`, {
      frameWidth: 48,
      frameHeight: 48,
    });
  }
}

export interface PhaserRouteCrowdSpriteLike {
  x: number; y: number;
  setDepth(value: number): this;
  setFrame?(frame: number): this;
  readonly anims?: { play(key: string, ignoreIfPlaying?: boolean): unknown; stop?(): unknown };
  destroy(): void;
}
export interface PhaserRouteCrowdSceneLike {
  readonly add: { sprite(x:number,y:number,texture:string): PhaserRouteCrowdSpriteLike };
  readonly anims?: {
    generateFrameNumbers(key: string, range: { start: number; end: number }): readonly unknown[];
    create(config: { key: string; frames: readonly unknown[]; frameRate: number; repeat: number }): unknown;
    exists?(key: string): boolean;
  };
}
export interface PhaserRouteCrowdRuntimeOptions {
  readonly pathProvider: RouteCrowdPathProvider;
  readonly isBlocked?: (point: RouteCrowdTile) => boolean;
  readonly viewport: () => RouteCrowdViewport | undefined;
  readonly random?: () => number;
  /** Production supplies a callback for the next Phaser update/frame. */
  readonly scheduleNextUpdate?: (callback: () => void) => void;
}

/** Presentation owner for route crowds with viewport-bounded sprites. */
export class PhaserRouteCrowdRuntime {
  private readonly core: RouteCrowdRuntime;
  private readonly trainCore: RouteCrowdRuntime;
  private readonly sprites = new Map<string, PhaserRouteCrowdSpriteLike>();
  private shutdownState = false;
  private readonly createdAnimations = new Set<string>();
  private startupActive = false;
  private startupGeneration = 0;
  private trainStartupActive = false;
  private trainStartupGeneration = 0;

  constructor(
    private readonly scene: PhaserRouteCrowdSceneLike,
    private readonly options: PhaserRouteCrowdRuntimeOptions,
  ) {
    const normalConfigs = ROUTE_CROWD_CONFIGS.filter(
      (config) => config.id !== "crowd-train",
    );
    const runtimeOptions = {
      pathProvider: options.pathProvider,
      ...(options.isBlocked === undefined ? {} : { isBlocked: options.isBlocked }),
      ...(options.random === undefined ? {} : { random: options.random }),
    };
    this.core = new RouteCrowdRuntime({ configs: normalConfigs, ...runtimeOptions });
    this.trainCore = new RouteCrowdRuntime({
      configs: ROUTE_CROWD_CONFIGS.filter((config) => config.id === "crowd-train"),
      ...runtimeOptions,
    });
  }

  get snapshot() {
    return {
      instances: Object.freeze([
        ...this.core.snapshot.instances,
        ...this.trainCore.snapshot.instances,
      ]),
    };
  }

  get configIds(): readonly string[] {
    return ROUTE_CROWD_CONFIGS.map((config) => config.id);
  }

  get spriteCount(): number { return this.sprites.size; }
  get started(): boolean { return this.core.started; }
  get trainStarted(): boolean { return this.trainCore.started; }
  get pausedGroups(): readonly string[] { return this.core.pausedGroups; }

  start(now: number): void {
    if (this.shutdownState) return;
    this.startupGeneration += 1;
    this.trainStartupGeneration += 1;
    const generation = this.startupGeneration;
    this.startupActive = true;
    this.trainStartupActive = false;
    this.core.cancel();
    this.trainCore.cancel();
    this.destroySprites();
    const schedule = this.options.scheduleNextUpdate;
    if (schedule === undefined) {
      this.startupActive = false;
      this.core.start(now, this.options.viewport());
      this.sync();
      return;
    }
    const runBatch = (): void => {
      if (
        this.shutdownState ||
        !this.startupActive ||
        generation !== this.startupGeneration
      ) return;
      const result = this.core.startBatched(now, this.options.viewport());
      if (
        this.shutdownState ||
        !this.startupActive ||
        generation !== this.startupGeneration
      ) return;
      this.sync();
      if (!result.ok || result.complete) {
        this.startupActive = false;
        this.sync();
        return;
      }
      schedule(runBatch);
    };
    runBatch();
  }

  /** Create crowd-train passengers only on the train departure notification. */
  startTrain(now: number): void {
    if (
      this.shutdownState ||
      this.startupActive ||
      this.trainStartupActive ||
      this.trainCore.started
    ) return;
    const schedule = this.options.scheduleNextUpdate;
    if (schedule === undefined) {
      this.trainCore.start(now, this.options.viewport());
      this.sync();
      return;
    }
    this.trainStartupGeneration += 1;
    const generation = this.trainStartupGeneration;
    this.trainStartupActive = true;
    const runBatch = (): void => {
      if (
        this.shutdownState ||
        !this.trainStartupActive ||
        generation !== this.trainStartupGeneration
      ) return;
      const result = this.trainCore.startBatched(now, this.options.viewport());
      if (
        this.shutdownState ||
        !this.trainStartupActive ||
        generation !== this.trainStartupGeneration
      ) return;
      this.sync();
      if (!result.ok || result.complete) {
        this.trainStartupActive = false;
        return;
      }
      schedule(runBatch);
    };
    runBatch();
  }

  pauseGroup(id: string): void {
    this.core.pauseGroup(id);
  }

  resumeGroup(id: string): void {
    this.core.resumeGroup(id);
  }

  update(now: number): void {
    if (this.shutdownState || this.startupActive) return;
    this.core.tick(now, this.options.viewport());
    this.trainCore.tick(now, this.options.viewport());
    this.sync();
  }

  cancel(): void {
    if (this.shutdownState) return;
    this.startupGeneration += 1;
    this.trainStartupGeneration += 1;
    this.startupActive = false;
    this.trainStartupActive = false;
    this.core.cancel();
    this.trainCore.cancel();
    this.destroySprites();
  }

  shutdown(): void {
    this.shutdownState = true;
    this.startupGeneration += 1;
    this.trainStartupGeneration += 1;
    this.startupActive = false;
    this.trainStartupActive = false;
    this.core.shutdown();
    this.trainCore.shutdown();
    this.destroySprites();
  }

  private sync(): void {
    const allInstances = this.snapshot.instances;
    const activeIds = new Set<string>();
    for (const [index, item] of allInstances.entries()) {
      activeIds.add(item.id);
      const prior = this.sprites.get(item.id);
      if (!item.materialized || item.destroyed) {
        prior?.destroy();
        this.sprites.delete(item.id);
        continue;
      }
      const texture = ROUTE_CROWD_TEXTURES[index % ROUTE_CROWD_TEXTURES.length]!;
      const sprite = prior ?? this.scene.add.sprite(
        item.position.x,
        item.position.y,
        texture,
      );
      sprite.x = item.position.x;
      sprite.y = item.position.y;
      sprite.setDepth(500 + item.position.y * .1);
      this.renderFacing(
        sprite,
        texture,
        item.facing,
        item.state === "moving" || item.state === "returning",
      );
      this.sprites.set(item.id, sprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }

  private renderFacing(
    sprite: PhaserRouteCrowdSpriteLike,
    texture: string,
    facing: RouteCrowdFacing,
    moving: boolean,
  ): void {
    const key = `route-crowd-${texture}-${facing}`;
    if (moving && this.ensureAnimation(texture, facing, key)) {
      sprite.anims?.play(key, true);
      return;
    }
    sprite.anims?.stop?.();
    sprite.setFrame?.(walkFrameStart(facing));
  }

  private ensureAnimation(
    texture: string,
    facing: RouteCrowdFacing,
    key: string,
  ): boolean {
    const animations = this.scene.anims;
    if (animations === undefined) return false;
    if (this.createdAnimations.has(key) || animations.exists?.(key) === true) return true;
    try {
      const start = walkFrameStart(facing);
      const created = animations.create({
        key,
        frames: animations.generateFrameNumbers(texture, {
          start,
          end: start + WALK_FRAMES_PER_DIRECTION - 1,
        }),
        frameRate: ANIMATION_FRAME_RATE,
        repeat: -1,
      });
      if (created !== false) this.createdAnimations.add(key);
      return created !== false;
    } catch {
      return false;
    }
  }

  private destroySprites(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}

import {
  ROUTE_CROWD_CONFIGS,
  RouteCrowdRuntime,
  type RouteCrowdPathProvider,
  type RouteCrowdViewport,
} from "../src/npc/index.js";

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
  destroy(): void;
}
export interface PhaserRouteCrowdSceneLike {
  readonly add: { sprite(x:number,y:number,texture:string): PhaserRouteCrowdSpriteLike };
}
export interface PhaserRouteCrowdRuntimeOptions {
  readonly pathProvider: RouteCrowdPathProvider;
  readonly viewport: () => RouteCrowdViewport | undefined;
  readonly random?: () => number;
  /** Production supplies a callback for the next Phaser update/frame. */
  readonly scheduleNextUpdate?: (callback: () => void) => void;
}

/** Presentation owner for the already-tested route-crowd CORE. */
export class PhaserRouteCrowdRuntime {
  private readonly core: RouteCrowdRuntime;
  private readonly sprites = new Map<number, PhaserRouteCrowdSpriteLike>();
  private shutdownState = false;
  private startupActive = false;
  private startupGeneration = 0;
  constructor(private readonly scene: PhaserRouteCrowdSceneLike,
    private readonly options: PhaserRouteCrowdRuntimeOptions) {
    this.core = new RouteCrowdRuntime({
      configs: ROUTE_CROWD_CONFIGS,
      pathProvider: options.pathProvider,
      ...(options.random === undefined ? {} : { random: options.random }),
    });
  }
  get snapshot() { return this.core.snapshot; }
  get spriteCount(): number { return this.sprites.size; }
  start(now: number): void {
    if (this.shutdownState) return;
    this.startupGeneration += 1;
    const generation = this.startupGeneration;
    this.startupActive = true;
    this.core.cancel();
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
  update(now: number): void {
    if (this.shutdownState || this.startupActive) return;
    this.core.tick(now, this.options.viewport());
    this.sync();
  }
  cancel(): void {
    if (this.shutdownState) return;
    this.startupGeneration += 1;
    this.startupActive = false;
    this.core.cancel();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
  shutdown(): void {
    this.shutdownState = true;
    this.startupGeneration += 1;
    this.startupActive = false;
    this.core.shutdown();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
  private sync(): void {
    const activeIndexes = new Set<number>();
    for (const [index, item] of this.core.snapshot.instances.entries()) {
      activeIndexes.add(index);
      const prior = this.sprites.get(index);
      if (!item.materialized || item.destroyed) { prior?.destroy(); this.sprites.delete(index); continue; }
      const sprite = prior ?? this.scene.add.sprite(
        item.position.x,
        item.position.y,
        ROUTE_CROWD_TEXTURES[index % ROUTE_CROWD_TEXTURES.length]!,
      );
      sprite.x = item.position.x; sprite.y = item.position.y; sprite.setDepth(500 + item.position.y * .1);
      this.sprites.set(index, sprite);
    }
    for (const [index, sprite] of this.sprites) {
      if (activeIndexes.has(index)) continue;
      sprite.destroy();
      this.sprites.delete(index);
    }
  }

  private destroySprites(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}

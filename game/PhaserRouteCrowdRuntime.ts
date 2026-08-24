import {
  ROUTE_CROWD_CONFIGS,
  RouteCrowdRuntime,
  type RouteCrowdPathProvider,
  type RouteCrowdViewport,
} from "../src/npc/index.js";

const CROWD_TEXTURES = [
  "npc-man", "npc-man2", "npc-woman", "npc-woman2", "npc-woman3",
  "npc-woman4", "npc-woman5", "npc-woman6", "npc-woman7", "npc-woman8",
  "npc-man3", "npc-man4", "npc-man5", "npc-man6", "npc-man8",
  "npc-man9", "npc-man10",
] as const;

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
}

/** Presentation owner for the already-tested route-crowd CORE. */
export class PhaserRouteCrowdRuntime {
  private readonly core: RouteCrowdRuntime;
  private readonly sprites = new Map<number, PhaserRouteCrowdSpriteLike>();
  private shutdownState = false;
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
  start(now: number): void { if (!this.shutdownState) { this.core.start(now, this.options.viewport()); this.sync(); } }
  update(now: number): void { if (!this.shutdownState) { this.core.tick(now, this.options.viewport()); this.sync(); } }
  shutdown(): void { this.shutdownState = true; this.core.shutdown(); for (const sprite of this.sprites.values()) sprite.destroy(); this.sprites.clear(); }
  private sync(): void {
    for (const [index, item] of this.core.snapshot.instances.entries()) {
      const prior = this.sprites.get(index);
      if (!item.materialized || item.destroyed) { prior?.destroy(); this.sprites.delete(index); continue; }
      const sprite = prior ?? this.scene.add.sprite(item.position.x, item.position.y, CROWD_TEXTURES[index % CROWD_TEXTURES.length]!);
      sprite.x = item.position.x; sprite.y = item.position.y; sprite.setDepth(500 + item.position.y * .1);
      this.sprites.set(index, sprite);
    }
  }
}

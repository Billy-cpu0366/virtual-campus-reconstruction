import {
  StaticCrowdRuntime,
  type StaticCrowdViewport,
} from "../src/npc/index.js";
import { walkFrameStart } from "../src/player/index.js";

export const STATIC_CROWD_EXTRA_TEXTURES = Object.freeze([
  "npc-man-beach", "npc-man-beach2", "npc-woman-beach", "npc-woman-beach2",
  "npc_footballer_blue", "npc_footballer_red",
] as const);

export interface PhaserStaticCrowdLoaderLike {
  spritesheet(key: string, url: string, config: { readonly frameWidth: number; readonly frameHeight: number }): unknown;
}
export interface PhaserStaticCrowdSpriteLike {
  x: number; y: number;
  setDepth(value: number): this;
  setFrame?(frame: number): this;
  destroy(): void;
}
export interface PhaserStaticCrowdSceneLike {
  readonly add: { sprite(x: number, y: number, texture: string): PhaserStaticCrowdSpriteLike };
  readonly textures: { exists(key: string): boolean };
}
export interface PhaserStaticCrowdRuntimeOptions {
  readonly viewport: () => StaticCrowdViewport | undefined;
  readonly viewportMargin?: number;
  readonly onError?: (reason: string) => void;
}

export function preloadStaticCrowdRuntimeAssets(loader: PhaserStaticCrowdLoaderLike): void {
  for (const texture of STATIC_CROWD_EXTRA_TEXTURES) {
    loader.spritesheet(texture, `/sprites/${texture}.webp`, { frameWidth: 48, frameHeight: 48 });
  }
}

/** Presentation owner for public region-static crowds; route crowds remain separate. */
export class PhaserStaticCrowdRuntime {
  private readonly core: StaticCrowdRuntime;
  private readonly sprites = new Map<string, PhaserStaticCrowdSpriteLike>();
  private shutdownState = false;

  constructor(private readonly scene: PhaserStaticCrowdSceneLike, private readonly options: PhaserStaticCrowdRuntimeOptions) {
    this.core = new StaticCrowdRuntime({
      ...(options.viewportMargin === undefined ? {} : { viewportMargin: options.viewportMargin }),
    });
  }

  get snapshot() { return this.core.snapshot; }
  get spriteCount(): number { return this.sprites.size; }

  start(): boolean {
    if (this.shutdownState) return false;
    const missing = ["npc-man", ...STATIC_CROWD_EXTRA_TEXTURES].find((key) => !this.scene.textures.exists(key));
    if (missing !== undefined) { this.options.onError?.(`missing-texture:${missing}`); return false; }
    this.core.start(this.options.viewport());
    this.sync();
    return true;
  }

  update(): void {
    if (this.shutdownState) return;
    this.core.tick(this.options.viewport());
    this.sync();
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.core.shutdown();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  private sync(): void {
    const active = new Set<string>();
    for (const item of this.core.snapshot.instances) {
      if (!item.materialized) continue;
      active.add(item.id);
      const sprite = this.sprites.get(item.id) ?? this.scene.add.sprite(item.position.x, item.position.y, item.spriteKey);
      sprite.x = item.position.x;
      sprite.y = item.position.y;
      sprite.setDepth(500 + item.position.y * .1);
      sprite.setFrame?.(walkFrameStart(item.direction === "up" ? "north" : "south"));
      this.sprites.set(item.id, sprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (active.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }
}

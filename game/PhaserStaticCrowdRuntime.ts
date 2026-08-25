import {
  StaticCrowdRuntime,
  type StaticCrowdViewport,
} from "../src/npc/index.js";
import { walkFrameStart } from "../src/player/index.js";

const CROWD_TRACK_BAND = Object.freeze({ minX: 25 * 16, maxX: 91 * 16 + 15, minY: 19 * 16, maxY: 19 * 16 + 15 });
function keepStaticCrowdOffTrack(x: number, y: number): { x: number; y: number } {
  if (x < CROWD_TRACK_BAND.minX || x > CROWD_TRACK_BAND.maxX || y < CROWD_TRACK_BAND.minY || y > CROWD_TRACK_BAND.maxY) return { x, y };
  return { x, y: y < (CROWD_TRACK_BAND.minY + CROWD_TRACK_BAND.maxY) / 2 ? CROWD_TRACK_BAND.minY - 1 : CROWD_TRACK_BAND.maxY + 1 };
}

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
  private lookAroundStep = 0;
  private nextLookAroundAt = 0;

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

  update(now = Date.now()): void {
    if (this.shutdownState) return;
    const lookAroundChanged = now >= this.nextLookAroundAt;
    if (lookAroundChanged) {
      this.lookAroundStep += 1;
      this.nextLookAroundAt = now + 1_000;
    }
    this.core.tick(this.options.viewport());
    this.sync(lookAroundChanged);
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.core.shutdown();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  private sync(lookAroundChanged = true): void {
    const active = new Set<string>();
    let created = 0;
    for (const item of this.core.snapshot.instances) {
      if (!item.materialized) continue;
      active.add(item.id);
      let sprite = this.sprites.get(item.id);
      const isNew = sprite === undefined;
      if (isNew) {
        if (created >= 16) continue;
        sprite = this.scene.add.sprite(item.position.x, item.position.y, item.spriteKey);
        const display = keepStaticCrowdOffTrack(item.position.x, item.position.y);
        sprite.x = display.x;
        sprite.y = display.y;
        sprite.setDepth(500 + display.y * .1);
        created += 1;
      }
      const readySprite = sprite!;
      if (isNew || lookAroundChanged) {
        const directions = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"] as const;
        const base = directions.indexOf(item.direction);
        const direction = directions[(base + this.lookAroundStep + item.id.length) % directions.length]!;
        readySprite.setFrame?.(walkFrameStart(direction));
      }
      this.sprites.set(item.id, readySprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (active.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }
}

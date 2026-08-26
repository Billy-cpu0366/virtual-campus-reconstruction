import {
  StaticCrowdRuntime,
  type StaticCrowdViewport,
} from "../src/npc/index.js";
import { walkFrameStart } from "../src/player/index.js";

const CROWD_TRACK_BAND = Object.freeze({ minX: 25 * 16, maxX: 91 * 16 + 15, minY: 19 * 16, maxY: 19 * 16 + 15 });
const NPC_HALF_SIZE = 24;

function isInViewport(
  x: number,
  y: number,
  viewport: StaticCrowdViewport | undefined,
): boolean {
  if (viewport === undefined) return true;
  return x + NPC_HALF_SIZE >= viewport.left &&
    x - NPC_HALF_SIZE <= viewport.left + viewport.width &&
    y + NPC_HALF_SIZE >= viewport.top &&
    y - NPC_HALF_SIZE <= viewport.top + viewport.height;
}

function staticCrowdRegionId(instanceId: string): string {
  const separator = instanceId.lastIndexOf(":");
  return separator === -1 ? instanceId : instanceId.slice(0, separator);
}

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
  private lookAroundIds = new Set<string>();

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
    const viewport = this.options.viewport();
    this.core.start(viewport);
    this.sync(true, viewport);
    return true;
  }

  update(now = Date.now()): void {
    if (this.shutdownState) return;
    const lookAroundChanged = now >= this.nextLookAroundAt;
    if (lookAroundChanged) {
      this.lookAroundStep += 1;
      this.nextLookAroundAt = now + 1_000;
      const candidates = [...this.sprites.keys()].sort();
      const count = Math.min(2 + this.lookAroundStep % 3, candidates.length);
      const start = candidates.length === 0 ? 0 : (this.lookAroundStep * 3) % candidates.length;
      this.lookAroundIds = new Set(Array.from({ length: count }, (_, index) => candidates[(start + index) % candidates.length]!));
    }
    const viewport = this.options.viewport();
    this.core.tick(viewport);
    this.sync(lookAroundChanged, viewport);
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.core.shutdown();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  private sync(
    lookAroundChanged = true,
    viewport: StaticCrowdViewport | undefined = this.options.viewport(),
  ): void {
    const instances = this.core.snapshot.instances;
    const byId = new Map(instances.map((item) => [item.id, item]));
    const readyRegionIds = new Set<string>();
    if (viewport !== undefined) {
      for (const item of instances) {
        const display = keepStaticCrowdOffTrack(item.position.x, item.position.y);
        if (item.materialized && isInViewport(display.x, display.y, viewport)) {
          readyRegionIds.add(staticCrowdRegionId(item.id));
        }
      }
      for (const [id, sprite] of this.sprites) {
        const item = byId.get(id);
        if (item !== undefined && isInViewport(sprite.x, sprite.y, viewport)) {
          readyRegionIds.add(staticCrowdRegionId(item.id));
        }
      }
    }

    const active = new Set<string>();
    let created = 0;
    for (const item of instances) {
      let sprite = this.sprites.get(item.id);
      const isNew = sprite === undefined;
      const existingVisible = sprite !== undefined && isInViewport(
        sprite.x, sprite.y, viewport);
      if (!item.materialized && !existingVisible) continue;
      if (!isNew && viewport !== undefined && !existingVisible) continue;
      active.add(item.id);
      if (isNew) {
        if (created >= 16 && !readyRegionIds.has(staticCrowdRegionId(item.id))) continue;
        sprite = this.scene.add.sprite(item.position.x, item.position.y, item.spriteKey);
        created += 1;
      }
      const readySprite = sprite!;
      if (item.materialized) {
        const display = keepStaticCrowdOffTrack(item.position.x, item.position.y);
        readySprite.x = display.x;
        readySprite.y = display.y;
        readySprite.setDepth(500 + display.y * .1);
      }
      if (isNew || (lookAroundChanged && this.lookAroundIds.has(item.id))) {
        const directions = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"] as const;
        const base = directions.indexOf(item.direction);
        const direction = isNew ? item.direction : directions[(base + this.lookAroundStep + item.id.length) % directions.length]!;
        readySprite.setFrame?.(walkFrameStart(direction));
      }
      this.sprites.set(item.id, readySprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (active.has(id) || isInViewport(sprite.x, sprite.y, viewport)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }
}

import {
  StaticCrowdRuntime,
  type StaticCrowdRegion,
  type StaticCrowdRuntimeTuning,
  type StaticCrowdSpritePools,
  type StaticCrowdViewport,
} from "../src/npc/index.js";
import { walkFrameStart } from "../src/player/index.js";
import type {
  StaticCrowdPresentation,
  TrackBand,
} from "../config/骨架/05-旁支/SYS-NPC/逻辑/types.js";

function isInViewport(
  x: number,
  y: number,
  viewport: StaticCrowdViewport | undefined,
  npcHalfSize: number,
): boolean {
  if (viewport === undefined) return true;
  return x + npcHalfSize >= viewport.left &&
    x - npcHalfSize <= viewport.left + viewport.width &&
    y + npcHalfSize >= viewport.top &&
    y - npcHalfSize <= viewport.top + viewport.height;
}

function staticCrowdRegionId(instanceId: string): string {
  const separator = instanceId.lastIndexOf(":");
  return separator === -1 ? instanceId : instanceId.slice(0, separator);
}

/** 铁轨带：静态路人踩进去会被弹到带外。带子从外面递进来，见 `trackBand` 那个选项。 */
export function keepStaticCrowdOffTrack(x: number, y: number, trackBand: TrackBand): { x: number; y: number } {
  if (x < trackBand.minX || x > trackBand.maxX || y < trackBand.minY || y > trackBand.maxY) return { x, y };
  return { x, y: y < (trackBand.minY + trackBand.maxY) / 2 ? trackBand.minY - 1 : trackBand.maxY + 1 };
}

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
  /** 46 个区域、三组贴图 key、哪几块不站人、各项调参——都来自 `config/`。 */
  readonly crowd: {
    readonly regions: readonly StaticCrowdRegion[];
    readonly spritePools: StaticCrowdSpritePools;
    readonly disabledRegionIndexes: readonly number[];
    readonly tuning: StaticCrowdRuntimeTuning;
  };
  /** 「用哪些贴图、每帧切多大、判定视野的半宽、多久转一次头」——来自 `static-crowd-presentation.json`。 */
  readonly presentation: StaticCrowdPresentation;
  /**
   * 铁轨带——来自 `route-crowd-presentation.json`。
   *
   * 为什么不放在上面那份里：**铁轨在哪儿是个世界事实，不是静态人群的属性**。
   * 原先两个适配器各写了一份一模一样（400/1471/304/319）的常量，换校园挪了铁轨
   * 只会改到一半。现在两份共读一处，改哪儿两边一起变。
   */
  readonly trackBand: TrackBand;
  readonly onError?: (reason: string) => void;
}

export function preloadStaticCrowdRuntimeAssets(
  loader: PhaserStaticCrowdLoaderLike,
  presentation: StaticCrowdPresentation,
): void {
  for (const texture of presentation.extraTextures) {
    loader.spritesheet(texture, `/sprites/${texture}.webp`, {
      frameWidth: presentation.textureFrameWidth,
      frameHeight: presentation.textureFrameHeight,
    });
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
      regions: options.crowd.regions,
      spritePools: options.crowd.spritePools,
      disabledRegionIndexes: options.crowd.disabledRegionIndexes,
      tuning: options.crowd.tuning,
    });
  }

  get snapshot() { return this.core.snapshot; }
  get spriteCount(): number { return this.sprites.size; }

  start(): boolean {
    if (this.shutdownState) return false;
    const missing = [this.options.presentation.defaultTexture, ...this.options.presentation.extraTextures]
      .find((key) => !this.scene.textures.exists(key));
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
      this.nextLookAroundAt = now + this.options.presentation.lookAroundIntervalMs;
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
    const npcHalfSize = this.options.presentation.npcHalfSize;
    const trackBand = this.options.trackBand;
    const byId = new Map(instances.map((item) => [item.id, item]));
    const readyRegionIds = new Set<string>();
    if (viewport !== undefined) {
      for (const item of instances) {
        const display = keepStaticCrowdOffTrack(item.position.x, item.position.y, trackBand);
        if (item.materialized && isInViewport(display.x, display.y, viewport, npcHalfSize)) {
          readyRegionIds.add(staticCrowdRegionId(item.id));
        }
      }
      for (const [id, sprite] of this.sprites) {
        const item = byId.get(id);
        if (item !== undefined && isInViewport(sprite.x, sprite.y, viewport, npcHalfSize)) {
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
        sprite.x, sprite.y, viewport, npcHalfSize);
      if (!item.materialized && !existingVisible) continue;
      if (!isNew && viewport !== undefined && !existingVisible) continue;
      active.add(item.id);
      if (isNew) {
        if (created >= this.options.presentation.maxCreatePerSync && !readyRegionIds.has(staticCrowdRegionId(item.id))) continue;
        sprite = this.scene.add.sprite(item.position.x, item.position.y, item.spriteKey);
        created += 1;
      }
      const readySprite = sprite!;
      if (item.materialized) {
        const display = keepStaticCrowdOffTrack(item.position.x, item.position.y, trackBand);
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
      if (active.has(id) || isInViewport(sprite.x, sprite.y, viewport, npcHalfSize)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }
}

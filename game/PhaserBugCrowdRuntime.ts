import {
  BugCrowdRuntime,
  type BugCrowdConfig,
  type BugCrowdViewport,
  type RouteCrowdPathProvider,
} from "../src/npc/index.js";
import type { BugCrowdPresentation } from "../config/骨架/05-旁支/SYS-NPC/逻辑/types.js";

/** 虫子们用的那张图的贴图 key。这张图的名字不是配置，见 `bug-crowd-presentation.json` 的说明。 */
const BUG_CROWD_TEXTURE = "npc-bug";
const BUG_CROWD_TEXTURE_URL = "/sprites/npc-bug.webp";

export type BugCrowdFacing = "south" | "north" | "west" | "east";

/** 四个方向。这里只用它数「一共几个方向」，顺序无所谓。 */
const BUG_CROWD_FACINGS: readonly BugCrowdFacing[] = [
  "south",
  "north",
  "west",
  "east",
];

export interface PhaserBugCrowdLoaderLike {
  spritesheet(
    key: string,
    url: string,
    config: {
      readonly frameWidth: number;
      readonly frameHeight: number;
      readonly startFrame?: number;
      readonly endFrame?: number;
    },
  ): unknown;
}

export interface PhaserBugCrowdSpriteLike {
  x: number;
  y: number;
  setDepth(value: number): unknown;
  setOrigin?(x: number, y: number): unknown;
  setScale?(value: number): unknown;
  setFrame?(frame: number): unknown;
  destroy(): void;
}

export interface PhaserBugCrowdSceneLike {
  readonly add: {
    sprite(x: number, y: number, texture: string): PhaserBugCrowdSpriteLike;
  };
  readonly textures: { exists(key: string): boolean };
}

export function bugCrowdFrameForFacing(
  facing: BugCrowdFacing,
  now: number,
  presentation: BugCrowdPresentation,
  moving = true,
): number {
  const start = presentation.facingFrameStart[facing] ?? 0;
  // 每方向几帧 = 整张图的总帧数 ÷ 方向数（24 ÷ 4 = 6）。原先这里写死 6，而
  // frameCount 就在配置里躺着——换一张每方向帧数不同的图，虫子会播错帧，不报错。
  const framesPerDirection =
    presentation.frameCount / BUG_CROWD_FACINGS.length;
  const frameInDirection = moving
    ? Math.floor(Math.max(0, now) * presentation.frameRate / 1_000) %
      framesPerDirection
    : 0;
  return start + frameInDirection;
}

export function preloadBugCrowdRuntimeAssets(
  loader: PhaserBugCrowdLoaderLike,
  presentation: BugCrowdPresentation,
): void {
  loader.spritesheet(BUG_CROWD_TEXTURE, BUG_CROWD_TEXTURE_URL, {
    frameWidth: presentation.frameWidth,
    frameHeight: presentation.frameHeight,
    startFrame: 0,
    endFrame: presentation.frameCount - 1,
  });
}

export class PhaserBugCrowdRuntime {
  private readonly core: BugCrowdRuntime;
  private readonly sprites = new Map<string, PhaserBugCrowdSpriteLike>();
  private readonly positions = new Map<string, { x: number; y: number }>();
  private readonly facings = new Map<string, BugCrowdFacing>();
  private readonly viewport: () => BugCrowdViewport | undefined;
  private readonly presentation: BugCrowdPresentation;
  private readonly error: ((reason: string) => void) | undefined;
  private dead = false;

  constructor(
    private readonly scene: PhaserBugCrowdSceneLike,
    options: {
      config: BugCrowdConfig;
      pathProvider: RouteCrowdPathProvider;
      viewport: () => BugCrowdViewport | undefined;
      /** 「长什么样」——来自 `bug-crowd-presentation.json`。 */
      presentation: BugCrowdPresentation;
      onError?: (reason: string) => void;
    },
  ) {
    this.core = new BugCrowdRuntime({
      config: options.config,
      pathProvider: options.pathProvider,
    });
    this.viewport = options.viewport;
    this.presentation = options.presentation;
    this.error = options.onError;
  }

  start(now: number): boolean {
    if (this.dead) return false;
    if (!this.scene.textures.exists(BUG_CROWD_TEXTURE)) {
      this.error?.(`missing-texture:${BUG_CROWD_TEXTURE}`);
      return false;
    }
    this.core.start(now, this.viewport());
    this.sync(now);
    return true;
  }

  update(now: number): void {
    if (this.dead) return;
    this.core.tick(now, this.viewport());
    this.sync(now);
  }

  shutdown(): void {
    this.dead = true;
    this.core.shutdown();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.positions.clear();
    this.facings.clear();
  }

  get spriteCount(): number {
    return this.sprites.size;
  }

  get snapshot() {
    return this.core.snapshot;
  }

  private sync(now: number): void {
    const active = new Set<string>();
    for (const item of this.core.snapshot.instances) {
      if (!item.materialized) continue;
      active.add(item.id);
      const prior = this.sprites.get(item.id);
      const sprite = prior ?? this.createSprite(item.position.x, item.position.y);
      const facing = this.resolveFacing(item.id, item.position);
      sprite.x = item.position.x;
      sprite.y = item.position.y;
      sprite.setFrame?.(bugCrowdFrameForFacing(
        facing,
        now,
        this.presentation,
        item.state === "moving",
      ));
      const feetY = item.position.y
        + this.presentation.frameHeight * this.presentation.displayScale
        * (1 - this.presentation.origin.y);
      sprite.setDepth(500 + feetY * 0.1);
      this.positions.set(item.id, item.position);
      this.facings.set(item.id, facing);
      this.sprites.set(item.id, sprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (active.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }

  private createSprite(x: number, y: number): PhaserBugCrowdSpriteLike {
    const sprite = this.scene.add.sprite(x, y, BUG_CROWD_TEXTURE);
    sprite.setOrigin?.(this.presentation.origin.x, this.presentation.origin.y);
    sprite.setScale?.(this.presentation.displayScale);
    return sprite;
  }

  private resolveFacing(
    id: string,
    position: { x: number; y: number },
  ): BugCrowdFacing {
    const previous = this.positions.get(id);
    const priorFacing = this.facings.get(id) ?? "south";
    if (previous === undefined) return priorFacing;
    const dx = position.x - previous.x;
    const dy = position.y - previous.y;
    if (dx === 0 && dy === 0) return priorFacing;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "west" : "east";
    return dy < 0 ? "north" : "south";
  }
}

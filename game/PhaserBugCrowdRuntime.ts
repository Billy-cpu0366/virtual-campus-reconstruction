import {
  BugCrowdRuntime,
  type BugCrowdViewport,
  type RouteCrowdPathProvider,
} from "../src/npc/index.js";

export const BUG_CROWD_FRAME_WIDTH = 38;
export const BUG_CROWD_FRAME_HEIGHT = 38;
export const BUG_CROWD_FRAME_COUNT = 24;
export const BUG_CROWD_FRAME_RATE = 10;
export const BUG_CROWD_DISPLAY_SCALE = 0.63;
export const BUG_CROWD_ORIGIN = Object.freeze({ x: 0.5, y: 0.85 });

export type BugCrowdFacing = "south" | "north" | "west" | "east";

export const BUG_CROWD_FACING_FRAME_START = Object.freeze({
  south: 0,
  north: 6,
  west: 12,
  east: 18,
} satisfies Record<BugCrowdFacing, number>);

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
  moving = true,
): number {
  const start = BUG_CROWD_FACING_FRAME_START[facing];
  const frameInDirection = moving
    ? Math.floor(Math.max(0, now) * BUG_CROWD_FRAME_RATE / 1_000) % 6
    : 0;
  return start + frameInDirection;
}

export function preloadBugCrowdRuntimeAssets(
  loader: PhaserBugCrowdLoaderLike,
): void {
  loader.spritesheet("npc-bug", "/sprites/npc-bug.webp", {
    frameWidth: BUG_CROWD_FRAME_WIDTH,
    frameHeight: BUG_CROWD_FRAME_HEIGHT,
    startFrame: 0,
    endFrame: BUG_CROWD_FRAME_COUNT - 1,
  });
}

export class PhaserBugCrowdRuntime {
  private readonly core: BugCrowdRuntime;
  private readonly sprites = new Map<string, PhaserBugCrowdSpriteLike>();
  private readonly positions = new Map<string, { x: number; y: number }>();
  private readonly facings = new Map<string, BugCrowdFacing>();
  private readonly viewport: () => BugCrowdViewport | undefined;
  private readonly error: ((reason: string) => void) | undefined;
  private dead = false;

  constructor(
    private readonly scene: PhaserBugCrowdSceneLike,
    options: {
      pathProvider: RouteCrowdPathProvider;
      viewport: () => BugCrowdViewport | undefined;
      onError?: (reason: string) => void;
    },
  ) {
    this.core = new BugCrowdRuntime({ pathProvider: options.pathProvider });
    this.viewport = options.viewport;
    this.error = options.onError;
  }

  start(now: number): boolean {
    if (this.dead) return false;
    if (!this.scene.textures.exists("npc-bug")) {
      this.error?.("missing-texture:npc-bug");
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
        item.state === "moving",
      ));
      const feetY = item.position.y
        + BUG_CROWD_FRAME_HEIGHT * BUG_CROWD_DISPLAY_SCALE
        * (1 - BUG_CROWD_ORIGIN.y);
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
    const sprite = this.scene.add.sprite(x, y, "npc-bug");
    sprite.setOrigin?.(BUG_CROWD_ORIGIN.x, BUG_CROWD_ORIGIN.y);
    sprite.setScale?.(BUG_CROWD_DISPLAY_SCALE);
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

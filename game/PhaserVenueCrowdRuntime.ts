import { VenueCrowdRuntime } from "../src/npc/index.js";
import {
  ANIMATION_FRAME_RATE,
  WALK_FRAMES_PER_DIRECTION,
  walkFrameStart,
} from "../src/player/index.js";

type View = { left: number; top: number; width: number; height: number };
const NPC_HALF_SIZE = 24;

function isInViewport(x: number, y: number, viewport: View | undefined): boolean {
  if (viewport === undefined) return true;
  return x + NPC_HALF_SIZE >= viewport.left &&
    x - NPC_HALF_SIZE <= viewport.left + viewport.width &&
    y + NPC_HALF_SIZE >= viewport.top &&
    y - NPC_HALF_SIZE <= viewport.top + viewport.height;
}

type Direction =
  | "east" | "north-east" | "north-west" | "north"
  | "south-east" | "south-west" | "south" | "west";
type Sprite = {
  x: number;
  y: number;
  setDepth(value: number): unknown;
  setFrame?(frame: number): unknown;
  anims?: {
    play(key: string, ignoreIfPlaying?: boolean): unknown;
    stop?(): unknown;
  };
  destroy(): void;
};
type ProtestActionState = {
  readonly id: string;
  readonly capable: boolean;
  phase: "idle" | "acting";
  directionIndex: number;
  actionCount: number;
  nextChangeAt: number;
};

const DIRECTIONS: readonly Direction[] = [
  "east", "north-east", "north-west", "north",
  "south-east", "south-west", "south", "west",
];
const ACTION_DURATION_MS = WALK_FRAMES_PER_DIRECTION / ANIMATION_FRAME_RATE * 1_000;

const stableHash = (value: string): number =>
  [...value].reduce((hash, character) =>
    (hash * 31 + character.charCodeAt(0)) >>> 0, 0);

export function preloadVenueCrowdRuntimeAssets(loader: {
  spritesheet(
    key: string,
    url: string,
    config: { frameWidth: number; frameHeight: number },
  ): unknown;
}): void {
  loader.spritesheet(
    "npc_protester_rising",
    "/sprites/npc_protester_rising.webp",
    { frameWidth: 48, frameHeight: 48 },
  );
}

export interface PhaserVenueCrowdSceneLike {
  readonly add: { sprite(x: number, y: number, key: string): Sprite };
  readonly textures: { exists(key: string): boolean };
  readonly anims?: {
    exists?(key: string): boolean;
    create(config: {
      key: string;
      frames: readonly unknown[];
      frameRate: number;
      repeat: number;
    }): unknown;
    generateFrameNumbers(
      key: string,
      range: { start: number; end: number },
    ): readonly unknown[];
  };
}

/** Venue presentation with region culling and independent protest action state. */
export class PhaserVenueCrowdRuntime {
  private readonly core = new VenueCrowdRuntime();
  private readonly sprites = new Map<string, Sprite>();
  private readonly protestStates = new Map<string, ProtestActionState>();
  private readonly createdAnimations = new Set<string>();
  private dead = false;
  private startedAt = 0;

  constructor(
    private readonly scene: PhaserVenueCrowdSceneLike,
    private readonly viewport: () => View | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  start(): boolean {
    if (this.dead || !this.scene.textures.exists("npc_protester_rising")) return false;
    this.startedAt = this.now();
    const viewport = this.viewport();
    this.core.start(viewport);
    this.sync(this.startedAt, viewport);
    return true;
  }

  update(): void {
    if (this.dead) return;
    const now = this.now();
    const viewport = this.viewport();
    this.core.tick(viewport);
    this.sync(now, viewport);
  }

  shutdown(): void {
    this.dead = true;
    this.core.shutdown();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.protestStates.clear();
  }

  get spriteCount(): number { return this.sprites.size; }
  get snapshot() { return this.core.snapshot; }
  get protestActionSnapshot(): readonly Readonly<ProtestActionState>[] {
    return Object.freeze([...this.protestStates.values()].map((state) =>
      Object.freeze({ ...state })));
  }

  private sync(now: number, viewport: View | undefined): void {
    const instances = this.core.snapshot.instances;
    const byId = new Map(instances.map((instance) => [instance.id, instance]));
    const readyRegionIds = new Set<string>();
    if (viewport !== undefined) {
      for (const instance of instances) {
        if (instance.materialized && isInViewport(
          instance.position.x, instance.position.y, viewport)) {
          readyRegionIds.add(instance.regionId);
        }
      }
      for (const [id, sprite] of this.sprites) {
        const instance = byId.get(id);
        if (instance !== undefined && isInViewport(sprite.x, sprite.y, viewport)) {
          readyRegionIds.add(instance.regionId);
        }
      }
    }

    const activeIds = new Set<string>();
    let created = 0;
    for (const instance of instances) {
      let sprite = this.sprites.get(instance.id);
      const isNew = sprite === undefined;
      const existingVisible = sprite !== undefined && isInViewport(
        sprite.x, sprite.y, viewport);
      if (!instance.materialized && !existingVisible) continue;
      if (!isNew && viewport !== undefined && !existingVisible) continue;
      activeIds.add(instance.id);
      const protest = instance.regionId.startsWith("protesters_rising");
      if (isNew) {
        if (created >= 16 && !readyRegionIds.has(instance.regionId)) continue;
        const texture = protest ? "npc_protester_rising" : "npc-man";
        sprite = this.scene.add.sprite(instance.position.x, instance.position.y, texture);
        created += 1;
        if (protest) this.initializeProtester(instance.id, sprite);
      }
      const readySprite = sprite!;
      if (instance.materialized) {
        readySprite.x = instance.position.x;
        readySprite.y = instance.position.y;
      }
      readySprite.setDepth(500 + readySprite.y * .1);
      if (protest) this.updateProtester(instance.id, readySprite, now);
      this.sprites.set(instance.id, readySprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (activeIds.has(id) || isInViewport(sprite.x, sprite.y, viewport)) continue;
      sprite.destroy();
      this.sprites.delete(id);
      const state = this.protestStates.get(id);
      if (state !== undefined) {
        state.phase = "idle";
        state.nextChangeAt = now + this.idleDelay(id, state.actionCount);
      }
    }
  }

  private initializeProtester(id: string, sprite: Sprite): void {
    const index = Number(id.split(":").at(-1)) || 0;
    const state = this.protestStates.get(id) ?? {
      id,
      capable: index % 3 === 0,
      phase: "idle" as const,
      directionIndex: index % DIRECTIONS.length,
      actionCount: 0,
      nextChangeAt: this.startedAt + stableHash(id) % 2_001,
    };
    this.protestStates.set(id, state);
    sprite.anims?.stop?.();
    sprite.setFrame?.(walkFrameStart(DIRECTIONS[state.directionIndex]!));
  }

  private updateProtester(id: string, sprite: Sprite, now: number): void {
    const state = this.protestStates.get(id);
    if (state === undefined || !state.capable || now < state.nextChangeAt) return;
    if (state.phase === "acting") {
      state.phase = "idle";
      sprite.anims?.stop?.();
      sprite.setFrame?.(walkFrameStart(DIRECTIONS[state.directionIndex]!));
      state.nextChangeAt = now + this.idleDelay(id, state.actionCount);
      return;
    }
    const actingCount = [...this.protestStates.values()].filter((candidate) =>
      candidate.phase === "acting").length;
    if (actingCount >= 2) {
      state.nextChangeAt = now + 500 + stableHash(`${id}:defer:${state.actionCount}`) % 501;
      return;
    }
    state.phase = "acting";
    state.actionCount += 1;
    state.directionIndex = (
      state.directionIndex + 1 + stableHash(`${id}:${state.actionCount}`) % 7
    ) % DIRECTIONS.length;
    const direction = DIRECTIONS[state.directionIndex]!;
    const animation = `npc-protester-rising-action-${direction}`;
    this.ensureAnimation(direction, animation);
    sprite.anims?.play(animation, false);
    state.nextChangeAt = now + ACTION_DURATION_MS;
  }

  private idleDelay(id: string, actionCount: number): number {
    return 2_000 + stableHash(`${id}:idle:${actionCount}`) % 4_001;
  }

  private ensureAnimation(direction: Direction, key: string): void {
    if (this.createdAnimations.has(key) || this.scene.anims?.exists?.(key)) return;
    const start = walkFrameStart(direction);
    this.scene.anims?.create({
      key,
      frames: this.scene.anims.generateFrameNumbers(
        "npc_protester_rising",
        { start, end: start + WALK_FRAMES_PER_DIRECTION - 1 },
      ),
      frameRate: ANIMATION_FRAME_RATE,
      repeat: 0,
    });
    this.createdAnimations.add(key);
  }
}

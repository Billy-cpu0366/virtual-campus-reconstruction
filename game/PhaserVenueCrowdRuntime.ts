import { VenueCrowdRuntime } from "../src/npc/index.js";
import {
  ANIMATION_FRAME_RATE,
  WALK_FRAMES_PER_DIRECTION,
  walkFrameStart,
} from "../src/player/index.js";

type View = { left: number; top: number; width: number; height: number };
const DEFAULT_NPC_HALF_SIZE = 24;
const PROTESTER_HALF_SIZE = 32;

export const PROTESTER_SLOGANS = Object.freeze([
  "People, not machines!",
  "Jobs for humans!",
  "Human > machine",
]);
const PROTEST_SPEECH_MAX_VISIBLE = 2;
const PROTEST_SPEECH_INITIAL_DELAY_MS = 500;
const PROTEST_SPEECH_DURATION_MS = 3_000;
const PROTEST_SPEECH_INTERVAL_MS = 6_000;

function isInViewport(
  x: number,
  y: number,
  viewport: View | undefined,
  halfSize: number,
): boolean {
  if (viewport === undefined) return true;
  return x + halfSize >= viewport.left &&
    x - halfSize <= viewport.left + viewport.width &&
    y + halfSize >= viewport.top &&
    y - halfSize <= viewport.top + viewport.height;
}

function isInViewportForRegion(
  x: number,
  y: number,
  regionId: string | undefined,
  viewport: View | undefined,
): boolean {
  const halfSize = regionId?.startsWith("protesters_rising")
    ? PROTESTER_HALF_SIZE
    : DEFAULT_NPC_HALF_SIZE;
  return isInViewport(x, y, viewport, halfSize);
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
type SpeechBubble = {
  x: number;
  y: number;
  setDepth(value: number): unknown;
  setOrigin?(x: number, y: number): unknown;
  setText?(value: string): unknown;
  setVisible?(value: boolean): unknown;
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

type ProtestSpeechState = {
  readonly id: string;
  phase: "hidden" | "visible";
  textIndex: number;
  text: string;
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
    { frameWidth: 64, frameHeight: 64 },
  );
}

export interface PhaserVenueCrowdSceneLike {
  readonly add: {
    sprite(x: number, y: number, key: string): Sprite;
    text?(
      x: number,
      y: number,
      text: string,
      style?: Record<string, unknown>,
    ): SpeechBubble;
  };
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
  private readonly speechBubbles = new Map<string, SpeechBubble>();
  private readonly speechStates = new Map<string, ProtestSpeechState>();
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
    for (const bubble of this.speechBubbles.values()) bubble.destroy();
    this.speechBubbles.clear();
    this.protestStates.clear();
    this.speechStates.clear();
  }

  get spriteCount(): number { return this.sprites.size; }
  get snapshot() { return this.core.snapshot; }
  get protestActionSnapshot(): readonly Readonly<ProtestActionState>[] {
    return Object.freeze([...this.protestStates.values()].map((state) =>
      Object.freeze({ ...state })));
  }
  get protestSpeechSnapshot(): readonly Readonly<ProtestSpeechState>[] {
    return Object.freeze([...this.speechStates.values()].map((state) =>
      Object.freeze({ ...state })));
  }

  private sync(now: number, viewport: View | undefined): void {
    const instances = this.core.snapshot.instances;
    const byId = new Map(instances.map((instance) => [instance.id, instance]));
    const readyRegionIds = new Set<string>();
    if (viewport !== undefined) {
      for (const instance of instances) {
        if (isInViewportForRegion(
          instance.position.x, instance.position.y, instance.regionId, viewport)) {
          // A visible region must win the bounded creation budget over
          // prewarmed regions that are still outside the current view.
          readyRegionIds.add(instance.regionId);
        }
      }
      for (const [id, sprite] of this.sprites) {
        const instance = byId.get(id);
        if (instance !== undefined && isInViewportForRegion(
          sprite.x, sprite.y, instance.regionId, viewport)) {
          readyRegionIds.add(instance.regionId);
        }
      }
    }

    const activeIds = new Set<string>();
    const activeSpeechIds = new Set<string>();
    const orderedInstances = [...instances].sort((left, right) => {
      const leftVisible = isInViewportForRegion(
        left.position.x, left.position.y, left.regionId, viewport,
      );
      const rightVisible = isInViewportForRegion(
        right.position.x, right.position.y, right.regionId, viewport,
      );
      return Number(rightVisible) - Number(leftVisible);
    });
    let created = 0;
    for (const instance of orderedInstances) {
      let sprite = this.sprites.get(instance.id);
      const isNew = sprite === undefined;
      const existingVisible = sprite !== undefined && isInViewportForRegion(
        sprite.x, sprite.y, instance.regionId, viewport);
      const currentlyVisible = isInViewportForRegion(
        instance.position.x, instance.position.y, instance.regionId, viewport,
      );
      if (!instance.materialized && !existingVisible && !currentlyVisible) continue;
      if (!isNew && viewport !== undefined && !existingVisible) continue;
      activeIds.add(instance.id);
      const protest = instance.regionId.startsWith("protesters_rising");
      if (isNew) {
        if (created >= 16 && !currentlyVisible &&
          !readyRegionIds.has(instance.regionId)) continue;
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
      if (protest) {
        this.updateProtester(instance.id, readySprite, now);
        if (isInViewportForRegion(readySprite.x, readySprite.y, instance.regionId, viewport)) {
          this.updateProtesterSpeech(instance.id, readySprite, now, activeSpeechIds);
        }
      }
      this.sprites.set(instance.id, readySprite);
    }
    for (const [id, sprite] of this.sprites) {
      if (activeIds.has(id) || isInViewportForRegion(
        sprite.x, sprite.y, byId.get(id)?.regionId, viewport)) continue;
      sprite.destroy();
      this.sprites.delete(id);
      const state = this.protestStates.get(id);
      if (state !== undefined) {
        state.phase = "idle";
        state.nextChangeAt = now + this.idleDelay(id, state.actionCount);
      }
      this.clearSpeech(id);
    }
    for (const id of this.speechBubbles.keys()) {
      if (!activeSpeechIds.has(id)) this.clearSpeech(id);
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

  private updateProtesterSpeech(
    id: string,
    sprite: Sprite,
    now: number,
    activeSpeechIds: Set<string>,
  ): void {
    if (this.scene.add.text === undefined) return;
    const state = this.speechStates.get(id) ?? {
      id,
      phase: "hidden" as const,
      textIndex: stableHash(`${id}:slogan`) % PROTESTER_SLOGANS.length,
      text: PROTESTER_SLOGANS[stableHash(`${id}:slogan`) % PROTESTER_SLOGANS.length]!,
      nextChangeAt: this.startedAt + PROTEST_SPEECH_INITIAL_DELAY_MS +
        stableHash(`${id}:speech-start`) % 1_501,
    };
    this.speechStates.set(id, state);
    activeSpeechIds.add(id);
    if (now >= state.nextChangeAt) {
      if (state.phase === "visible") {
        state.phase = "hidden";
        state.textIndex = (state.textIndex + 1) % PROTESTER_SLOGANS.length;
        state.text = PROTESTER_SLOGANS[state.textIndex]!;
        state.nextChangeAt = now + PROTEST_SPEECH_INTERVAL_MS +
          stableHash(`${id}:speech-next:${state.textIndex}`) % 8_001;
      } else {
        const visibleCount = [...this.speechStates.values()]
          .filter((candidate) => candidate.phase === "visible").length;
        if (visibleCount < PROTEST_SPEECH_MAX_VISIBLE) {
          state.phase = "visible";
          state.nextChangeAt = now + PROTEST_SPEECH_DURATION_MS;
        } else {
          state.nextChangeAt = now + 500 +
            stableHash(`${id}:speech-defer:${state.textIndex}`) % 501;
        }
      }
    }
    let bubble = this.speechBubbles.get(id);
    if (bubble === undefined) {
      bubble = this.scene.add.text(sprite.x, sprite.y - PROTESTER_HALF_SIZE - 8, state.text, {
        fontFamily: "monospace",
        color: "#111111",
        backgroundColor: "#ffffff",
        padding: { left: 3, right: 3, top: 1, bottom: 1 },
        fontSize: "8px",
        wordWrap: { width: 128, useAdvancedWrap: true },
        align: "center",
      });
      bubble.setOrigin?.(0.5, 1);
      this.speechBubbles.set(id, bubble);
    }
    bubble.x = sprite.x;
    bubble.y = sprite.y - PROTESTER_HALF_SIZE - 8;
    bubble.setText?.(state.text);
    bubble.setDepth(700 + sprite.y * .1);
    bubble.setVisible?.(state.phase === "visible");
  }

  private clearSpeech(id: string): void {
    this.speechBubbles.get(id)?.destroy();
    this.speechBubbles.delete(id);
    this.speechStates.delete(id);
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

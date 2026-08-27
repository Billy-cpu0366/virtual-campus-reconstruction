import { describe, expect, it } from "vitest";
import {
  PhaserVenueCrowdRuntime,
  preloadVenueCrowdRuntimeAssets,
  PROTESTER_SLOGANS,
} from "../../game/PhaserVenueCrowdRuntime.js";

class Text {
  visible = false;
  destroyed = false;
  depth = 0;
  origin = { x: 0, y: 0 };
  constructor(public x: number, public y: number, public value: string) {}
  setDepth(value: number): this { this.depth = value; return this; }
  setOrigin(x: number, y: number): this { this.origin = { x, y }; return this; }
  setText(value: string): this { this.value = value; return this; }
  setVisible(value: boolean): this { this.visible = value; return this; }
  destroy(): void { this.destroyed = true; }
}

class Sprite {
  x: number;
  y: number;
  frame = 0;
  destroyed = false;
  readonly texture: string;
  readonly played: string[] = [];
  readonly anims = {
    play: (key: string) => { this.played.push(key); },
    stop: () => undefined,
  };
  constructor(x: number, y: number, texture = "") {
    this.x = x;
    this.y = y;
    this.texture = texture;
  }
  setDepth(): this { return this; }
  setFrame(frame: number): this { this.frame = frame; return this; }
  destroy(): void { this.destroyed = true; }
}

describe("PhaserVenueCrowdRuntime protest actions", () => {
  it("loads protest frames at 64px and culls by the matching sprite boundary", () => {
    let frameConfig: { frameWidth: number; frameHeight: number } | undefined;
    preloadVenueCrowdRuntimeAssets({
      spritesheet: (_key, _url, config) => { frameConfig = config; },
    });
    expect(frameConfig).toEqual({ frameWidth: 64, frameHeight: 64 });

    let viewport = { left: 0, top: 0, width: 2240, height: 2240 };
    const sprites: Sprite[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: {
        sprite: (x, y, texture) => {
          const sprite = new Sprite(x, y, texture);
          sprites.push(sprite);
          return sprite;
        },
      },
      textures: { exists: () => true },
    }, () => viewport);

    expect(runtime.start()).toBe(true);
    const protester = runtime.snapshot.instances.find((instance) =>
      instance.regionId.startsWith("protesters_rising"));
    expect(protester).toBeDefined();
    const protesterSprite = sprites.find((sprite) =>
      sprite.texture === "npc_protester_rising" &&
      sprite.x === protester!.position.x &&
      sprite.y === protester!.position.y);
    expect(protesterSprite).toBeDefined();

    const { x, y } = protester!.position;
    viewport = { left: x - 33, top: y - 1, width: 1, height: 2 };
    runtime.update();
    expect(protesterSprite!.destroyed).toBe(false);

    viewport = { left: x - 34, top: y - 1, width: 1, height: 2 };
    runtime.update();
    expect(protesterSprite!.destroyed).toBe(true);
  });

  it("prioritizes a visible protest region over offscreen prewarm", () => {
    const viewport = { left: 1_560, top: 1_065, width: 480, height: 270 };
    const sprites: Sprite[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: { sprite: (x, y, texture) => {
        const sprite = new Sprite(x, y, texture);
        sprites.push(sprite);
        return sprite;
      } },
      textures: { exists: () => true },
    }, () => viewport);

    expect(runtime.start()).toBe(true);
    expect(sprites.some((sprite) => sprite.texture === "npc_protester_rising")).toBe(true);
  });

  it("materializes protest sprites after moving from the spawn viewport", () => {
    let viewport = { left: 848, top: 169, width: 480, height: 270 };
    const sprites: Sprite[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: { sprite: (x, y, texture) => {
        const sprite = new Sprite(x, y, texture);
        sprites.push(sprite);
        return sprite;
      } },
      textures: { exists: () => true },
    }, () => viewport);

    expect(runtime.start()).toBe(true);
    viewport = { left: 1_560, top: 1_065, width: 480, height: 270 };
    runtime.update();
    expect(sprites.some((sprite) => sprite.texture === "npc_protester_rising")).toBe(true);
  });

  it("rotates public protest slogans only while protesters are visible", () => {
    let now = 0;
    let viewport = { left: 0, top: 0, width: 2240, height: 2240 };
    const sprites: Sprite[] = [];
    const bubbles: Text[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: {
        sprite: (x, y, texture) => {
          const sprite = new Sprite(x, y, texture);
          sprites.push(sprite);
          return sprite;
        },
        text: (x, y, text) => {
          const bubble = new Text(x, y, text);
          bubbles.push(bubble);
          return bubble;
        },
      },
      textures: { exists: () => true },
    }, () => viewport, () => now);

    expect(runtime.start()).toBe(true);
    let sawVisible = false;
    let sawBubble = false;
    for (now = 0; now <= 4_000; now += 100) {
      runtime.update();
      sawVisible ||= runtime.protestSpeechSnapshot.some((state) => state.phase === "visible");
      sawBubble ||= bubbles.some((bubble) => bubble.visible && PROTESTER_SLOGANS.includes(
        bubble.value as typeof PROTESTER_SLOGANS[number],
      ));
    }
    expect(sawVisible).toBe(true);
    expect(sawBubble).toBe(true);
    expect(runtime.protestSpeechSnapshot.every((state) =>
      PROTESTER_SLOGANS.includes(state.text as typeof PROTESTER_SLOGANS[number]),
    )).toBe(true);

    viewport = { left: 10_000, top: 10_000, width: 10, height: 10 };
    runtime.update();
    expect(bubbles.every((bubble) => bubble.destroyed)).toBe(true);
    expect(runtime.protestSpeechSnapshot).toHaveLength(0);
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
  });

  it("staggeres finite actions for one stable subset with observable idle gaps", () => {
    let now = 0;
    let viewport = { left: 0, top: 0, width: 2240, height: 2240 };
    const sprites: Sprite[] = [];
    const animations: { key: string; repeat: number }[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: { sprite: (x, y) => { const sprite = new Sprite(x, y); sprites.push(sprite); return sprite; } },
      textures: { exists: () => true },
      anims: {
        exists: () => false,
        create: (config) => { animations.push({ key: config.key, repeat: config.repeat }); return config; },
        generateFrameNumbers: (_key, range) => [range.start, range.end],
      },
    }, () => viewport, () => now);

    expect(runtime.start()).toBe(true);
    for (let frame = 0; frame < 40; frame += 1) runtime.update();
    const initial = runtime.protestActionSnapshot;
    expect(initial.length).toBeGreaterThan(0);
    const capable = initial.filter((state) => state.capable);
    const fixed = initial.filter((state) => !state.capable);
    expect(capable.length).toBeGreaterThan(0);
    expect(capable.length).toBeLessThan(initial.length);

    const seenActing = new Set<string>();
    const seenIdleAfterAction = new Set<string>();
    let maximumConcurrent = 0;
    for (now = 100; now <= 10_000; now += 100) {
      runtime.update();
      const snapshot = runtime.protestActionSnapshot;
      const acting = snapshot.filter((state) => state.phase === "acting");
      maximumConcurrent = Math.max(maximumConcurrent, acting.length);
      for (const state of snapshot) {
        if (state.phase === "acting") seenActing.add(state.id);
        else if (seenActing.has(state.id)) seenIdleAfterAction.add(state.id);
      }
    }

    expect(seenActing.size).toBe(capable.length);
    expect(seenIdleAfterAction.size).toBe(capable.length);
    expect(maximumConcurrent).toBeLessThanOrEqual(2);
    expect(runtime.protestActionSnapshot
      .filter((state) => !state.capable)
      .every((state) => state.actionCount === 0 && state.phase === "idle"))
      .toBe(true);
    expect(animations.length).toBeGreaterThan(0);
    expect(animations
      .filter((animation) => animation.key.startsWith("npc-protester"))
      .every((animation) => animation.repeat === 0)).toBe(true);

    viewport = { left: 0, top: 0, width: 10, height: 10 };
    runtime.update();
    expect(runtime.protestActionSnapshot.every((state) => state.phase === "idle")).toBe(true);
    runtime.shutdown();
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(fixed.every((state) => state.actionCount === 0)).toBe(true);
  });

  it("animates concert venue NPCs with looping direction actions", () => {
    let now = 0;
    const viewport = { left: 1_600, top: 350, width: 640, height: 550 };
    const sprites: Sprite[] = [];
    const animations: { key: string; repeat: number }[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: { sprite: (x, y, texture) => {
        const sprite = new Sprite(x, y, texture);
        sprites.push(sprite);
        return sprite;
      } },
      textures: { exists: () => true },
      anims: {
        exists: () => false,
        create: (config) => {
          animations.push({ key: config.key, repeat: config.repeat });
          return config;
        },
        generateFrameNumbers: (_key, range) => [range.start, range.end],
      },
    }, () => viewport, () => now);

    expect(runtime.start()).toBe(true);
    expect(runtime.concertActionSnapshot.length).toBeGreaterThan(0);
    expect(sprites.some((sprite) => sprite.played.some((key) =>
      key.startsWith("concert-crowd-"),
    ))).toBe(true);
    for (now = 0; now <= 8_000; now += 100) runtime.update();
    expect(runtime.concertActionSnapshot.some((state) => state.actionCount > 0))
      .toBe(true);
    expect(animations.some((animation) =>
      animation.key.startsWith("concert-crowd-") && animation.repeat === -1,
    )).toBe(true);
    runtime.shutdown();
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
  });

  it("keeps visible sprite identity through core culling and culls only when offscreen", () => {
    let viewport: { left: number; top: number; width: number; height: number } | undefined = {
      left: 0, top: 0, width: 2240, height: 2240,
    };
    const sprites: Sprite[] = [];
    const runtime = new PhaserVenueCrowdRuntime({
      add: { sprite: (x, y) => { const sprite = new Sprite(x, y); sprites.push(sprite); return sprite; } },
      textures: { exists: () => true },
    }, () => viewport);

    expect(runtime.start()).toBe(true);
    const materializedCount = runtime.snapshot.instances
      .filter((instance) => instance.materialized).length;
    expect(materializedCount).toBeGreaterThan(16);
    expect(runtime.spriteCount).toBe(materializedCount);
    const retained = sprites[0]!;

    viewport = undefined;
    runtime.update();
    expect(retained.destroyed).toBe(false);
    expect(sprites[0]).toBe(retained);

    viewport = {
      left: retained.x - 5, top: retained.y - 5, width: 10, height: 10,
    };
    runtime.update();
    expect(retained.destroyed).toBe(false);
    expect(sprites[0]).toBe(retained);

    viewport = { left: 10_000, top: 10_000, width: 10, height: 10 };
    runtime.update();
    expect(retained.destroyed).toBe(true);
  });
});

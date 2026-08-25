import { describe, expect, it } from "vitest";
import { PhaserVenueCrowdRuntime } from "../../game/PhaserVenueCrowdRuntime.js";

class Sprite {
  x: number;
  y: number;
  frame = 0;
  destroyed = false;
  readonly played: string[] = [];
  readonly anims = {
    play: (key: string) => { this.played.push(key); },
    stop: () => undefined,
  };
  constructor(x: number, y: number) { this.x = x; this.y = y; }
  setDepth(): this { return this; }
  setFrame(frame: number): this { this.frame = frame; return this; }
  destroy(): void { this.destroyed = true; }
}

describe("PhaserVenueCrowdRuntime protest actions", () => {
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
    expect(maximumConcurrent).toBeLessThan(capable.length);
    expect(runtime.protestActionSnapshot
      .filter((state) => !state.capable)
      .every((state) => state.actionCount === 0 && state.phase === "idle"))
      .toBe(true);
    expect(animations.length).toBeGreaterThan(0);
    expect(animations.every((animation) => animation.repeat === 0)).toBe(true);

    viewport = { left: 0, top: 0, width: 10, height: 10 };
    runtime.update();
    expect(runtime.protestActionSnapshot.every((state) => state.phase === "idle")).toBe(true);
    runtime.shutdown();
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(fixed.every((state) => state.actionCount === 0)).toBe(true);
  });
});

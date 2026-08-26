import { describe, expect, it } from "vitest";

import {
  STOP_AI_SMOKE_CONFIG,
  STOP_AI_SMOKE_SITES,
  StopAiSmokeRuntime,
} from "../../src/fx/index.js";
import {
  PhaserStopAiSmokeRuntime,
  type PhaserStopAiSmokeEmitterLike,
  type PhaserStopAiSmokeEventsLike,
  type PhaserStopAiSmokeGraphicsLike,
  type PhaserStopAiSmokeSceneLike,
  type PhaserStopAiSmokeTimerLike,
} from "../../game/PhaserStopAiSmokeRuntime.js";

const INSIDE = Object.freeze({ left: 1_400, top: 1_100, width: 500, height: 400 });
const OUTSIDE = Object.freeze({ left: 0, top: 0, width: 500, height: 500 });

class Events implements PhaserStopAiSmokeEventsLike {
  readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  on(event: string, listener: (...args: unknown[]) => void): this {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }
  off(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
  count(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

class Timer implements PhaserStopAiSmokeTimerLike {
  removed = false;
  constructor(readonly callback: () => void) {}
  remove(): void { this.removed = true; }
}

class Emitter implements PhaserStopAiSmokeEmitterLike {
  emitting = false;
  gravityX = 0;
  destroyed = false;
  starts = 0;
  stops = 0;
  start(): void { this.emitting = true; this.starts += 1; }
  stop(): void { this.emitting = false; this.stops += 1; }
  setVisible(_value: boolean): this { return this; }
  setDepth(_value: number): this { return this; }
  destroy(): void { this.destroyed = true; }
}

class Graphics implements PhaserStopAiSmokeGraphicsLike {
  destroyed = false;
  setPosition(_x: number, _y: number): this { return this; }
  setRotation(_value: number): this { return this; }
  setDepth(_value: number): this { return this; }
  setVisible(_value: boolean): this { return this; }
  fillStyle(_color: number, _alpha: number): this { return this; }
  fillRect(_x: number, _y: number, _w: number, _h: number): this { return this; }
  fillEllipse(_x: number, _y: number, _w: number, _h: number): this { return this; }
  clear(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

function makeScene() {
  const events = new Events();
  const timers: Timer[] = [];
  const emitters: Emitter[] = [];
  const graphics: Graphics[] = [];
  const scene: PhaserStopAiSmokeSceneLike = {
    load: { image: () => undefined },
    textures: { exists: () => true },
    add: {
      particles: () => {
        const emitter = new Emitter();
        emitters.push(emitter);
        return emitter;
      },
      graphics: () => {
        const item = new Graphics();
        graphics.push(item);
        return item;
      },
    },
    time: {
      now: 0,
      delayedCall: (_delay, callback) => {
        const timer = new Timer(callback);
        timers.push(timer);
        return timer;
      },
    },
    events,
  };
  return {
    scene,
    events,
    timers,
    emitters,
    graphics,
    setNow(value: number): void {
      (scene.time as { now: number }).now = value;
    },
  };
}

describe("StopAiSmokeRuntime", () => {
  it("locks the three sites and nine layered emitters", () => {
    const runtime = new StopAiSmokeRuntime();
    expect(STOP_AI_SMOKE_SITES.map(({ x, y }) => [x, y])).toEqual([
      [1800, 1352], [1480, 1272], [1672, 1304],
    ]);
    expect(STOP_AI_SMOKE_SITES.map(({ graphicAngle }) => graphicAngle)).toEqual([
      -25, -15, 15,
    ]);
    expect(STOP_AI_SMOKE_CONFIG).toMatchObject({
      assetKey: "particle_smoke_white",
      speed: { min: 15, max: 35 },
      scale: { start: 0.1, end: 3 },
      lifespan: 1800,
      quantity: 2,
      frequency: 20,
      gravityY: -20,
      tint: [16724787, 16716049, 13369344],
    });
    runtime.start(INSIDE);
    expect(runtime.snapshot.canisters).toHaveLength(9);
    expect(runtime.snapshot.canisters.every((item) => item.active)).toBe(true);
  });

  it("destroys offscreen emitters and recreates them with a new generation", () => {
    const fake = makeScene();
    let viewport: { left: number; top: number; width: number; height: number } = INSIDE;
    let player: { x: number; y: number; bodyBottom: number; depth: number } | undefined;
    const runtime = new PhaserStopAiSmokeRuntime(fake.scene, {
      viewport: () => viewport,
      playerPosition: () => player,
    });
    expect(runtime.start()).toEqual({ ok: true });
    expect(fake.emitters).toHaveLength(9);
    expect(fake.graphics).toHaveLength(3);
    expect(runtime.snapshot.canisters.find((item) => item.layer === "main")?.depth).toBe(1160);
    player = { x: 0, y: 1400, bodyBottom: 1400, depth: 900 };
    fake.events.emit("update");
    expect(runtime.snapshot.canisters.find((item) => item.layer === "main")?.depth).toBe(899);
    fake.setNow(500);
    viewport = OUTSIDE;
    fake.events.emit("update");
    expect(runtime.emitterCount).toBe(0);
    expect(runtime.snapshot.canisters.every((item) => item.destroyed)).toBe(true);
    fake.setNow(1_000);
    viewport = INSIDE;
    fake.events.emit("update");
    expect(runtime.emitterCount).toBe(9);
    expect(runtime.snapshot.canisters.every((item) => item.generation === 2)).toBe(true);
    const recreatedWindTimer = fake.timers.find(
      (timer, index) => index >= 9 && !timer.removed,
    );
    recreatedWindTimer?.callback();
    expect(fake.emitters.slice(9).some((emitter) => emitter.gravityX !== 0)).toBe(true);
    runtime.shutdown();
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
    expect(fake.graphics.every((item) => item.destroyed)).toBe(true);
  });
});
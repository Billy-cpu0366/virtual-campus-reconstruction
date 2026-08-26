import { describe, expect, it } from "vitest";

import {
  FOG_ORANGE_SMOKE_CELLS,
  FOG_ORANGE_SMOKE_CONFIG,
  FogRuntime,
} from "../../src/fx/index.js";
import {
  PhaserFogRuntime,
  type PhaserFogEmitterLike,
  type PhaserFogEventsLike,
  type PhaserFogSceneLike,
  type PhaserFogTimerLike,
} from "../../game/PhaserFogRuntime.js";

const VIEWPORT = Object.freeze({ left: 1_400, top: 1_100, width: 500, height: 400 });

class Events implements PhaserFogEventsLike {
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
  count(event: string): number { return this.listeners.get(event)?.size ?? 0; }
}

class Timer implements PhaserFogTimerLike {
  removed = false;
  constructor(readonly callback: () => void) {}
  remove(): void { this.removed = true; }
}

class Emitter implements PhaserFogEmitterLike {
  emitting = false;
  destroyed = false;
  start(): void { this.emitting = true; }
  stop(): void { this.emitting = false; }
  setVisible(_value: boolean): this { return this; }
  setDepth(_value: number): this { return this; }
  destroy(): void { this.destroyed = true; }
}

function makeScene() {
  const events = new Events();
  const timers: Timer[] = [];
  const emitters: Emitter[] = [];
  let now = 0;
  const scene: PhaserFogSceneLike = {
    load: { image: () => undefined },
    textures: { exists: () => true },
    add: {
      particles: () => {
        const emitter = new Emitter();
        emitters.push(emitter);
        return emitter;
      },
    },
    time: {
      get now() { return now; },
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
    setNow(value: number): void { now = value; },
  };
}

describe("FogRuntime", () => {
  it("calculates the orange_smoke polygon into exactly 13 cells", () => {
    const runtime = new FogRuntime(true);
    expect(FOG_ORANGE_SMOKE_CELLS).toHaveLength(13);
    expect(runtime.snapshot).toMatchObject({
      region: "orange_smoke",
      carsInputIntegrated: true,
    });
    expect(FOG_ORANGE_SMOKE_CONFIG).toMatchObject({
      depth: 1100,
      blendMode: "NORMAL",
      scale: 8,
      alpha: 0.3,
      speed: 5,
      quantity: 4,
      frequency: 20,
      lifespan: { min: 350, max: 2000 },
      respawn: 500,
    });
  });

  it("uses the public 32px cell viewport padding", () => {
    const runtime = new FogRuntime();
    const cell = FOG_ORANGE_SMOKE_CELLS[0]!;
    runtime.start({
      left: cell.x + 33,
      top: cell.y - 16,
      width: 100,
      height: 100,
    });
    expect(runtime.cellState(cell.id)?.active).toBe(false);

    runtime.updateViewport({
      left: cell.x + 31,
      top: cell.y - 16,
      width: 100,
      height: 100,
    });
    expect(runtime.cellState(cell.id)?.active).toBe(true);
  });

  it("clears player/cars and respawns after 500ms", () => {
    const runtime = new FogRuntime(true);
    runtime.start(VIEWPORT);
    const cell = runtime.snapshot.cells[0]!;
    runtime.updateInteractions(
      { x: cell.x - 35, y: cell.y, velocityX: 1, velocityY: 0 },
      [{ x: cell.x, y: cell.y }],
      0,
    );
    expect(runtime.snapshot.cells.find((item) => item.id === cell.id)?.cleared).toBe(true);
    runtime.tick(499);
    expect(runtime.snapshot.cells.find((item) => item.id === cell.id)?.cleared).toBe(true);
    runtime.tick(500);
    expect(runtime.snapshot.cells.find((item) => item.id === cell.id)?.cleared).toBe(false);
  });
});

describe("PhaserFogRuntime", () => {
  it("owns 13 emitters and tears down listeners/timers", () => {
    const fake = makeScene();
    let cars: readonly { x: number; y: number }[] | undefined;
    const runtime = new PhaserFogRuntime(fake.scene, {
      viewport: () => VIEWPORT,
      cars: () => cars,
    });
    expect(runtime.start()).toEqual({ ok: true });
    expect(runtime.emitterCount).toBe(13);
    expect(runtime.snapshot.cells.some((item) => item.active)).toBe(true);
    const cell = runtime.snapshot.cells[0]!;
    cars = [{ x: cell.x, y: cell.y }];
    fake.events.emit("update");
    expect(runtime.snapshot.cells.find((item) => item.id === cell.id)?.cleared).toBe(true);
    runtime.shutdown();
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
    expect(fake.emitters.every((item) => item.destroyed)).toBe(true);
    expect(fake.timers.every((timer) => timer.removed)).toBe(true);
  });
});
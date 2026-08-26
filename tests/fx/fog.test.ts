import { describe, expect, it } from "vitest";

import {
  FOG_ORANGE_SMOKE_CELLS,
  FOG_ORANGE_SMOKE_CONFIG,
  FOG_ORANGE_SMOKE_PRESENTATION_QUANTITY,
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
  constructor(readonly delay: number, readonly callback: () => void) {}
  remove(): void { this.removed = true; }
}

class Emitter implements PhaserFogEmitterLike {
  emitting = false;
  destroyed = false;
  visible = false;
  visibilityCalls: boolean[] = [];
  start(): void { this.emitting = true; }
  stop(): void { this.emitting = false; }
  setVisible(value: boolean): this {
    this.visible = value;
    this.visibilityCalls.push(value);
    return this;
  }
  setDepth(_value: number): this { return this; }
  destroy(): void { this.destroyed = true; }
}

function makeScene() {
  const events = new Events();
  const timers: Timer[] = [];
  const emitters: Emitter[] = [];
  const configs: Record<string, unknown>[] = [];
  let now = 0;
  const scene: PhaserFogSceneLike = {
    load: { image: () => undefined },
    textures: { exists: () => true },
    add: {
      particles: (_x, _y, _texture, config) => {
        const emitter = new Emitter();
        configs.push(config);
        emitters.push(emitter);
        return emitter;
      },
    },
    time: {
      get now() { return now; },
      delayedCall: (delay, callback) => {
        const timer = new Timer(delay, callback);
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
    configs,
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
    expect(FOG_ORANGE_SMOKE_PRESENTATION_QUANTITY).toBe(2);
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
  it("stops one cleared emitter without hiding its living particles", () => {
    const fake = makeScene();
    let cars: readonly { x: number; y: number }[] | undefined;
    const runtime = new PhaserFogRuntime(fake.scene, {
      viewport: () => VIEWPORT,
      cars: () => cars,
    });
    expect(runtime.start()).toEqual({ ok: true });
    const cell = runtime.snapshot.cells[0]!;
    const emitter = fake.emitters[0]!;
    const visibilityCalls = emitter.visibilityCalls.length;
    cars = [{ x: cell.x, y: cell.y }];

    fake.events.emit("update");

    expect(emitter.emitting).toBe(false);
    expect(emitter.visible).toBe(true);
    expect(emitter.visibilityCalls).toHaveLength(visibilityCalls);
    expect(runtime.snapshot.cells.some((item) => item.cleared)).toBe(true);
    expect(fake.timers.length).toBeGreaterThan(0);
    expect(fake.timers.every((timer) => timer.delay === 500)).toBe(true);

    fake.events.emit("update");
    expect(emitter.emitting).toBe(false);
    expect(emitter.visible).toBe(true);
    expect(emitter.visibilityCalls).toHaveLength(visibilityCalls);
    runtime.shutdown();
  });

  it("stops adjacent cleared emitters without hiding either one", () => {
    const fake = makeScene();
    let cars: readonly { x: number; y: number }[] | undefined;
    const runtime = new PhaserFogRuntime(fake.scene, {
      viewport: () => VIEWPORT,
      cars: () => cars,
    });
    expect(runtime.start()).toEqual({ ok: true });
    const cells = [runtime.snapshot.cells[0]!, runtime.snapshot.cells[2]!];
    const firstEmitter = fake.emitters[0]!;
    const secondEmitter = fake.emitters[2]!;
    const firstVisibilityCalls = firstEmitter.visibilityCalls.length;
    const secondVisibilityCalls = secondEmitter.visibilityCalls.length;
    cars = [{
      x: (cells[0]!.x + cells[1]!.x) / 2,
      y: (cells[0]!.y + cells[1]!.y) / 2,
    }];

    fake.events.emit("update");

    expect(cells.every((cell) => runtime.snapshot.cells
      .find((item) => item.id === cell.id)?.cleared)).toBe(true);
    expect(firstEmitter.emitting).toBe(false);
    expect(secondEmitter.emitting).toBe(false);
    expect(firstEmitter.visible).toBe(true);
    expect(secondEmitter.visible).toBe(true);
    expect(firstEmitter.visibilityCalls).toHaveLength(firstVisibilityCalls);
    expect(secondEmitter.visibilityCalls).toHaveLength(secondVisibilityCalls);
    expect(fake.timers.length).toBeGreaterThanOrEqual(2);
    expect(fake.timers.every((timer) => timer.delay === 500)).toBe(true);

    fake.setNow(500);
    for (const timer of fake.timers) timer.callback();
    expect(firstEmitter.emitting).toBe(true);
    expect(secondEmitter.emitting).toBe(true);
    expect(cells.every((cell) => !runtime.snapshot.cells
      .find((item) => item.id === cell.id)?.cleared)).toBe(true);
    runtime.shutdown();
  });

  it("keeps every emitter visible while clearing the whole region", () => {
    const fake = makeScene();
    let cars: readonly { x: number; y: number }[] | undefined;
    const runtime = new PhaserFogRuntime(fake.scene, {
      viewport: () => VIEWPORT,
      cars: () => cars,
    });
    expect(runtime.start()).toEqual({ ok: true });
    const visibilityCalls = fake.emitters.map(
      (emitter) => emitter.visibilityCalls.length,
    );
    cars = runtime.snapshot.cells.map(({ x, y }) => ({ x, y }));

    fake.events.emit("update");

    expect(runtime.snapshot.cells.every((cell) => cell.cleared)).toBe(true);
    expect(fake.emitters.every((emitter) => !emitter.emitting)).toBe(true);
    expect(fake.emitters.every((emitter) => emitter.visible)).toBe(true);
    expect(fake.emitters.every(
      (emitter, index) => emitter.visibilityCalls.length === visibilityCalls[index],
    )).toBe(true);
    expect(fake.timers).toHaveLength(13);
    expect(fake.timers.every((timer) => timer.delay === 500)).toBe(true);
    runtime.shutdown();
  });

  it("hides offscreen emitters and shows them again on return", () => {
    const fake = makeScene();
    let viewport: { left: number; top: number; width: number; height: number } = VIEWPORT;
    const runtime = new PhaserFogRuntime(fake.scene, {
      viewport: () => viewport,
    });
    expect(runtime.start()).toEqual({ ok: true });

    viewport = { left: 0, top: 0, width: 100, height: 100 };
    fake.events.emit("update");
    expect(fake.emitters.every((emitter) => !emitter.emitting)).toBe(true);
    expect(fake.emitters.every((emitter) => !emitter.visible)).toBe(true);

    viewport = VIEWPORT;
    fake.events.emit("update");
    expect(fake.emitters.every((emitter) => emitter.emitting)).toBe(true);
    expect(fake.emitters.every((emitter) => emitter.visible)).toBe(true);
    runtime.shutdown();
  });

  it("owns 13 emitters and tears down listeners/timers", () => {
    const fake = makeScene();
    let cars: readonly { x: number; y: number }[] | undefined;
    const runtime = new PhaserFogRuntime(fake.scene, {
      viewport: () => VIEWPORT,
      cars: () => cars,
    });
    expect(runtime.start()).toEqual({ ok: true });
    expect(runtime.emitterCount).toBe(13);
    expect(fake.configs).toHaveLength(13);
    expect(fake.configs.every((config) => config.quantity === 2)).toBe(true);
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
import { describe, expect, it } from "vitest";

import {
  FACTORY_SMOKE_CONFIG,
  FactorySmokeRuntime,
} from "../../src/fx/index.js";
import {
  PhaserFactorySmokeRuntime,
  type PhaserFactorySmokeEmitterLike,
  type PhaserFactorySmokeEventsLike,
  type PhaserFactorySmokeGraphicsLike,
  type PhaserFactorySmokeParticleLike,
  type PhaserFactorySmokeSceneLike,
} from "../../game/PhaserFactorySmokeRuntime.js";

const INSIDE_VIEWPORT = Object.freeze({
  left: 400,
  top: 100,
  width: 600,
  height: 600,
});
const OUTSIDE_VIEWPORT = Object.freeze({
  left: 1_500,
  top: 1_500,
  width: 200,
  height: 200,
});

class FakeEvents implements PhaserFactorySmokeEventsLike {
  readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: unknown[]) => void): this {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  count(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

class FakeEmitter implements PhaserFactorySmokeEmitterLike {
  starts = 0;
  stops = 0;
  visible = false;
  destroyed = false;
  readonly particles: PhaserFactorySmokeParticleLike[] = [
    { x: FACTORY_SMOKE_CONFIG.x, y: FACTORY_SMOKE_CONFIG.y, alpha: 1, lifeT: 0.5 },
  ];

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }

  setVisible(value: boolean): this {
    this.visible = value;
    return this;
  }

  setDepth(_value: number): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }

  forEachAlive(
    callback: (particle: PhaserFactorySmokeParticleLike) => void,
  ): void {
    for (const particle of this.particles) callback(particle);
  }
}

class FakeGraphics implements PhaserFactorySmokeGraphicsLike {
  destroyed = false;

  setDepth(_value: number): this {
    return this;
  }

  clear(): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function makeScene(textureAvailable = true) {
  const events = new FakeEvents();
  const emitters: FakeEmitter[] = [];
  const graphics: FakeGraphics[] = [];
  const configs: Record<string, unknown>[] = [];
  const scene: PhaserFactorySmokeSceneLike = {
    load: { image: () => undefined },
    textures: { exists: () => textureAvailable },
    add: {
      particles: (_x, _y, _texture, config) => {
        configs.push(config);
        const emitter = new FakeEmitter();
        emitters.push(emitter);
        return emitter;
      },
      graphics: () => {
        const item = new FakeGraphics();
        graphics.push(item);
        return item;
      },
    },
    cameras: { main: { worldView: INSIDE_VIEWPORT } },
    events,
  };
  return { scene, events, emitters, graphics, configs };
}

describe("FactorySmokeRuntime", () => {
  it("使用公开锚点/参数，视口外停发、返回复用同一generation", () => {
    const runtime = new FactorySmokeRuntime();
    expect(FACTORY_SMOKE_CONFIG).toMatchObject({
      x: 808,
      y: 539.2,
      width: 7,
      widthEnd: 32,
      pathHeight: 35,
      quantity: 2,
      frequency: 80,
      lifespan: 2_000,
      reactCars: false,
      reactPlayer: false,
    });
    expect(runtime.start()).toEqual({ ok: true, generation: 1 });
    expect(runtime.updateViewport(OUTSIDE_VIEWPORT)).toMatchObject({
      state: "paused",
      visible: false,
      emitting: false,
      generation: 1,
    });
    expect(runtime.updateViewport(INSIDE_VIEWPORT)).toMatchObject({
      state: "emitting",
      visible: true,
      emitting: true,
      generation: 1,
    });
    expect(runtime.start()).toEqual({ ok: true, generation: 1 });
    expect(runtime.particlePosition(0)).toEqual({ x: 0, y: 0 });
    expect(runtime.particlePosition(1).y).toBe(-35);
    expect(runtime.updateViewport(OUTSIDE_VIEWPORT).generation).toBe(1);
  });

  it("资源失败进入error，shutdown终止owner且不可重启", () => {
    const missing = new FactorySmokeRuntime();
    expect(missing.start(false)).toEqual({ ok: false, reason: "missing-texture" });
    expect(missing.snapshot.state).toBe("error");

    const runtime = new FactorySmokeRuntime();
    runtime.start();
    expect(runtime.shutdown().teardownRequested).toBe(true);
    expect(runtime.shutdown()).toMatchObject({ state: "shutdown" });
    expect(runtime.start()).toEqual({ ok: false, reason: "shutdown" });
  });
});

describe("PhaserFactorySmokeRuntime", () => {
  it("创建一个emitter，视口进出只启停不重建，shutdown销毁emitter/path/listener", () => {
    const fake = makeScene();
    let viewport: {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly height: number;
    } = INSIDE_VIEWPORT;
    const runtime = new PhaserFactorySmokeRuntime(fake.scene, {
      viewport: () => viewport,
    });
    runtime.preload();
    expect(runtime.start()).toEqual({ ok: true, generation: 1 });
    expect(fake.emitters).toHaveLength(1);
    expect(fake.graphics).toHaveLength(1);
    expect(fake.configs[0]).toMatchObject({
      quantity: 2,
      frequency: 80,
      lifespan: 2_000,
      emitting: false,
    });
    expect(fake.emitters[0]?.visible).toBe(true);
    const starts = fake.emitters[0]?.starts;

    viewport = OUTSIDE_VIEWPORT;
    fake.events.emit("update");
    expect(fake.emitters[0]?.visible).toBe(false);
    expect(fake.emitters[0]?.stops).toBeGreaterThan(0);
    viewport = INSIDE_VIEWPORT;
    fake.events.emit("update");
    expect(fake.emitters).toHaveLength(1);
    expect(fake.emitters[0]?.starts).toBeGreaterThan(starts ?? 0);
    expect(fake.emitters[0]?.particles[0]?.y).toBeLessThan(FACTORY_SMOKE_CONFIG.y);

    runtime.shutdown();
    expect(fake.emitters[0]?.destroyed).toBe(true);
    expect(fake.graphics[0]?.destroyed).toBe(true);
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
  });

  it("资源失败不创建emitter，且shutdown幂等", () => {
    const fake = makeScene(false);
    const errors: string[] = [];
    const runtime = new PhaserFactorySmokeRuntime(fake.scene, {
      onError: (reason) => errors.push(reason),
    });
    expect(runtime.start()).toEqual({ ok: false, reason: "missing-texture" });
    expect(fake.emitters).toHaveLength(0);
    expect(errors).toContain("missing-texture");
    runtime.shutdown();
    runtime.shutdown();
    expect(runtime.start()).toEqual({ ok: false, reason: "shutdown" });
  });
});

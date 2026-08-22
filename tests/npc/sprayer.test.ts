import { describe, expect, it } from "vitest";

import {
  SPRAYER_CONFIGS,
  SprayerGroupRuntime,
} from "../../src/npc/index.js";
import {
  PhaserSprayerRuntime,
  type PhaserSprayerAnimationManagerLike,
  type PhaserSprayerEventsLike,
  type PhaserSprayerSceneLike,
  type PhaserSprayerSpriteLike,
} from "../../game/PhaserSprayerRuntime.js";

class FakeClock {
  nowMs = 0;

  advance(ms: number): number {
    this.nowMs += ms;
    return this.nowMs;
  }
}

class FakeEvents implements PhaserSprayerEventsLike {
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

class FakeAnimations implements PhaserSprayerAnimationManagerLike {
  readonly created: Array<{
    readonly key: string;
    readonly frames: readonly unknown[];
    readonly frameRate: number;
    readonly repeat: number;
  }> = [];

  generateFrameNumbers(
    _key: string,
    range: { readonly start: number; readonly end: number },
  ): readonly number[] {
    const step = range.start <= range.end ? 1 : -1;
    const result: number[] = [];
    for (let frame = range.start; frame !== range.end + step; frame += step) {
      result.push(frame);
    }
    return result;
  }

  create(config: {
    readonly key: string;
    readonly frames: readonly unknown[];
    readonly frameRate: number;
    readonly repeat: number;
  }): unknown {
    this.created.push(config);
    return config;
  }

  exists(key: string): boolean {
    return this.created.some((animation) => animation.key === key);
  }
}

class FakeSprite implements PhaserSprayerSpriteLike {
  x: number;
  y: number;
  texture: string;
  destroyed = false;
  readonly played: string[] = [];
  readonly anims = {
    play: (key: string): unknown => {
      this.played.push(key);
      return {};
    },
  };

  constructor(x: number, y: number, texture: string) {
    this.x = x;
    this.y = y;
    this.texture = texture;
  }

  setScale(_value: number): this {
    return this;
  }

  setDepth(_value: number): this {
    return this;
  }

  setTexture(key: string): this {
    this.texture = key;
    return this;
  }

  setFrame(_frame: number): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function makeScene(textureExists: (key: string) => boolean = () => true) {
  const events = new FakeEvents();
  const animations = new FakeAnimations();
  const sprites: FakeSprite[] = [];
  const scene: PhaserSprayerSceneLike = {
    load: { spritesheet: () => undefined },
    anims: animations,
    textures: { exists: textureExists },
    add: {
      sprite: (x, y, texture) => {
        const sprite = new FakeSprite(x, y, texture);
        sprites.push(sprite);
        return sprite;
      },
    },
    events,
  };
  return { scene, events, animations, sprites };
}

describe("SprayerGroupRuntime", () => {
  it("保留四个公开锚点和完整路线，按300ms排序逃跑并完成销毁状态", () => {
    const clock = new FakeClock();
    const runtime = new SprayerGroupRuntime({ random: () => 0 });
    expect(runtime.start(clock.nowMs)).toEqual({ ok: true });
    expect(runtime.snapshot.instances.map((instance) => instance.id)).toEqual(
      SPRAYER_CONFIGS.map((config) => config.id),
    );
    expect(runtime.snapshot.instances.map((instance) => instance.position)).toEqual(
      SPRAYER_CONFIGS.map((config) => ({
        x: config.tileX * 16,
        y: config.tileY * 16,
      })),
    );

    runtime.tick(clock.nowMs, { x: 60 * 16, y: 25 * 16 });
    expect(runtime.snapshot.instances[0]?.state).toBe("fleeing");
    expect(runtime.snapshot.instances.slice(1).every((instance) => instance.state === "idle")).toBe(
      true,
    );

    runtime.tick(clock.advance(299));
    expect(runtime.snapshot.instances[1]?.state).toBe("idle");
    runtime.tick(clock.advance(1));
    expect(runtime.snapshot.instances[1]?.state).toBe("fleeing");
    runtime.tick(clock.advance(300));
    expect(runtime.snapshot.instances[2]?.state).toBe("fleeing");
    runtime.tick(clock.advance(300));
    expect(runtime.snapshot.instances[3]?.state).toBe("fleeing");

    runtime.tick(clock.advance(25_000));
    expect(runtime.snapshot.instances.every((instance) => instance.state === "gone")).toBe(true);
    expect(runtime.snapshot.instances[0]?.position).toEqual({ x: 0, y: 26 * 16 });
  });

  it("严格使用横向2 tile、纵向0..2 tile触发窗口", () => {
    const runtime = new SprayerGroupRuntime({ random: () => 0 });
    runtime.start(0);
    runtime.tick(0, { x: 60 * 16 + 2 * 16, y: 27 * 16 });
    expect(runtime.snapshot.triggeredAt).toBe(0);

    const outside = new SprayerGroupRuntime({ random: () => 0 });
    outside.start(0);
    outside.tick(0, { x: 60 * 16 + 2 * 16 + 0.01, y: 27 * 16 });
    expect(outside.snapshot.triggeredAt).toBeNull();
    outside.tick(1, { x: 60 * 16, y: 28 * 16 });
    expect(outside.snapshot.triggeredAt).toBeNull();
  });

  it("资源失败、重复start、cancel和shutdown都是有界结果", () => {
    const missing = new SprayerGroupRuntime();
    expect(missing.start(0, { idleTexture: false, runningTexture: true })).toEqual({
      ok: false,
      reason: "missing-idle-texture",
    });
    expect(missing.start(0, { idleTexture: true, runningTexture: false })).toEqual({
      ok: false,
      reason: "missing-running-texture",
    });

    const runtime = new SprayerGroupRuntime({ random: () => 0 });
    expect(runtime.start(0)).toEqual({ ok: true });
    expect(runtime.start(1)).toEqual({ ok: false, reason: "already-running" });
    runtime.cancel();
    expect(runtime.snapshot.instances.every((instance) => instance.state === "cancelled")).toBe(
      true,
    );
    expect(runtime.start(10)).toEqual({ ok: true });
    runtime.shutdown();
    expect(runtime.start(11)).toEqual({ ok: false, reason: "shutdown" });
    expect(runtime.snapshot.instances.every((instance) => instance.state === "shutdown")).toBe(
      true,
    );
  });
});

describe("PhaserSprayerRuntime", () => {
  it("创建四个Sprite、播放喷洒/逃跑动画，并在路线完成后移除监听和对象", () => {
    const clock = new FakeClock();
    let player: { x: number; y: number } | undefined;
    const fake = makeScene();
    const runtime = new PhaserSprayerRuntime(fake.scene, {
      random: () => 0,
      playerPosition: () => player,
    });
    runtime.preload();
    runtime.createAnimations();
    expect(fake.animations.created.map((animation) => animation.key)).toEqual([
      "npc-sprayer-spray",
      "npc-sprayer-running-anim",
    ]);

    expect(runtime.start(clock.nowMs)).toEqual({ ok: true });
    expect(fake.sprites).toHaveLength(4);
    expect(fake.events.count("update")).toBe(1);
    player = { x: 60 * 16, y: 25 * 16 };
    fake.events.emit("update", clock.nowMs);
    expect(fake.sprites[0]?.texture).toBe("npc-sprayer-running");
    fake.events.emit("update", clock.advance(300));
    expect(fake.sprites[1]?.texture).toBe("npc-sprayer-running");
    fake.events.emit("update", clock.advance(25_000));
    expect(fake.sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
  });

  it("资源缺失不创建Sprite，cancel可重启且shutdown不可重启", () => {
    const errors: string[] = [];
    const missing = makeScene((key) => key !== "npc-sprayer-running");
    const failed = new PhaserSprayerRuntime(missing.scene, {
      onError: (reason) => errors.push(reason),
    });
    expect(failed.start(0)).toEqual({
      ok: false,
      reason: "missing-running-texture",
    });
    expect(missing.sprites).toHaveLength(0);
    expect(errors).toContain("missing-running-texture");

    const fake = makeScene();
    const runtime = new PhaserSprayerRuntime(fake.scene);
    expect(runtime.start(0)).toEqual({ ok: true });
    expect(runtime.start(1)).toEqual({ ok: false, reason: "already-running" });
    runtime.cancel();
    expect(fake.sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(runtime.start(2)).toEqual({ ok: true });
    runtime.shutdown();
    expect(runtime.start(3)).toEqual({ ok: false, reason: "shutdown" });
  });
});

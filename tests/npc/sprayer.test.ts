import { describe, expect, it } from "vitest";

import { SprayerGroupRuntime } from "../../src/npc/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";
import {
  PhaserSprayerRuntime,
  sprayerPresentationDepth,
  type PhaserSprayerAnimationManagerLike,
  type PhaserSprayerEventsLike,
  type PhaserSprayerSceneLike,
  type PhaserSprayerSpriteLike,
} from "../../game/PhaserSprayerRuntime.js";

/** 四个喷水器和五项调参现在都读磁盘上那份配置。 */
const CONFIGS = await loadNpcConfigs(createDiskConfigSource());
const SPRAYER_CONFIGS = CONFIGS.sprayerConfigs;
/** 两张贴图的帧规格与帧速——原先写死在 game/PhaserSprayerRuntime.ts 里，帧速是函数体里的字面量 6。 */
const PRESENTATION = CONFIGS.presentation.sprayer;
const SPRAYER_INPUT = {
  configs: SPRAYER_CONFIGS,
  tuning: CONFIGS.tuning.sprayer,
  presentation: PRESENTATION,
};

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
  readonly displayWidth = 48;
  readonly displayHeight = 48;
  depth = 0;
  destroyed = false;
  readonly played: string[] = [];
  readonly anims = {
    play: (key: string): unknown => {
      this.played.push(key);
      if (key.startsWith("npc-sprayer-running-")) {
        this.texture = "npc-sprayer-running";
      }
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

  setDepth(value: number): this {
    this.depth = value;
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
    const runtime = new SprayerGroupRuntime({ ...SPRAYER_INPUT, random: () => 0 });
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
    const runtime = new SprayerGroupRuntime({ ...SPRAYER_INPUT, random: () => 0 });
    runtime.start(0);
    runtime.tick(0, { x: 60 * 16 + 2 * 16, y: 27 * 16 });
    expect(runtime.snapshot.triggeredAt).toBe(0);

    const outside = new SprayerGroupRuntime({ ...SPRAYER_INPUT, random: () => 0 });
    outside.start(0);
    outside.tick(0, { x: 60 * 16 + 2 * 16 + 0.01, y: 27 * 16 });
    expect(outside.snapshot.triggeredAt).toBeNull();
    outside.tick(1, { x: 60 * 16, y: 28 * 16 });
    expect(outside.snapshot.triggeredAt).toBeNull();
  });

  it("资源失败、重复start、cancel和shutdown都是有界结果", () => {
    const missing = new SprayerGroupRuntime(SPRAYER_INPUT);
    expect(missing.start(0, { idleTexture: false, runningTexture: true })).toEqual({
      ok: false,
      reason: "missing-idle-texture",
    });
    expect(missing.start(0, { idleTexture: true, runningTexture: false })).toEqual({
      ok: false,
      reason: "missing-running-texture",
    });

    const runtime = new SprayerGroupRuntime({ ...SPRAYER_INPUT, random: () => 0 });
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
    let triggered = 0;
    const runtime = new PhaserSprayerRuntime(fake.scene, { ...SPRAYER_INPUT,
      random: () => 0,
      playerPosition: () => player,
      onTriggered: () => {
        triggered += 1;
      },
    });
    runtime.preload();
    runtime.createAnimations();
    expect(fake.animations.created.map((animation) => animation.key)).toEqual([
      "npc-sprayer-spray",
      "npc-sprayer-running-east",
      "npc-sprayer-running-north-east",
      "npc-sprayer-running-north-west",
      "npc-sprayer-running-north",
      "npc-sprayer-running-south-east",
      "npc-sprayer-running-south-west",
      "npc-sprayer-running-south",
      "npc-sprayer-running-west",
    ]);

    expect(runtime.start(clock.nowMs)).toEqual({ ok: true });
    expect(fake.sprites).toHaveLength(4);
    expect(fake.sprites[0]?.depth).toBe(
      sprayerPresentationDepth(25 * 16),
    );
    expect(runtime.visualSnapshots[0]).toMatchObject({
      width: 48,
      height: 48,
      depth: sprayerPresentationDepth(25 * 16),
    });
    expect(fake.events.count("update")).toBe(1);
    player = { x: 60 * 16, y: 25 * 16 };
    fake.events.emit("update", clock.nowMs);
    expect(fake.sprites[0]?.texture).toBe("npc-sprayer-running");
    expect(triggered).toBe(1);
    fake.events.emit("update", clock.advance(300));
    expect(fake.sprites[1]?.texture).toBe("npc-sprayer-running");
    expect(triggered).toBe(1);
    expect(fake.sprites[1]?.depth).toBe(
      sprayerPresentationDepth(fake.sprites[1]?.y ?? 0),
    );
    fake.events.emit("update", clock.advance(25_000));
    expect(fake.sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
  });

  it("动画帧速是按递进来的那份配置算的，不是写死的", () => {
    // 真配置里两张图都是每秒 6 帧——比人物走路那套（10）慢，这是原版就有的差别。
    expect(PRESENTATION.map((asset) => asset.frameRate)).toEqual([6, 6]);

    const fake = makeScene();
    const shifted = PRESENTATION.map((asset) => ({ ...asset, frameRate: 3 }));
    const runtime = new PhaserSprayerRuntime(fake.scene, {
      ...SPRAYER_INPUT,
      presentation: shifted,
    });
    runtime.createAnimations();
    // 喷雾 1 条 + 跑动 8 个方向 = 9 条，帧速全部跟着配置走。
    expect(fake.animations.created).toHaveLength(9);
    expect(fake.animations.created.every((animation) => animation.frameRate === 3)).toBe(true);
  });

  it("资源缺失不创建Sprite，cancel可重启且shutdown不可重启", () => {
    const errors: string[] = [];
    const missing = makeScene((key) => key !== "npc-sprayer-running");
    const failed = new PhaserSprayerRuntime(missing.scene, { ...SPRAYER_INPUT,
      onError: (reason) => errors.push(reason),
    });
    expect(failed.start(0)).toEqual({
      ok: false,
      reason: "missing-running-texture",
    });
    expect(missing.sprites).toHaveLength(0);
    expect(errors).toContain("missing-running-texture");

    const fake = makeScene();
    const runtime = new PhaserSprayerRuntime(fake.scene, SPRAYER_INPUT);
    expect(runtime.start(0)).toEqual({ ok: true });
    expect(runtime.start(1)).toEqual({ ok: false, reason: "already-running" });
    runtime.cancel();
    expect(fake.sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(runtime.start(2)).toEqual({ ok: true });
    runtime.shutdown();
    expect(runtime.start(3)).toEqual({ ok: false, reason: "shutdown" });
  });
});

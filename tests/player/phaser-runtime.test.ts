import { describe, expect, it } from "vitest";

import {
  PLAYER_RUNTIME_ANIMATIONS,
  PhaserPlayerRuntime,
  type PhaserPlayerAnimationConfig,
  type PhaserPlayerAnimationManagerLike,
  type PhaserPlayerSceneLike,
  type PhaserPlayerVisualLike,
} from "../../game/PhaserPlayerRuntime.js";

type Listener = (...args: unknown[]) => void;

class FakeSprite implements PhaserPlayerVisualLike {
  x = 1088;
  y = 304;
  readonly calls: string[] = [];
  readonly animationCalls: string[] = [];
  readonly listeners = new Map<string, Listener>();
  readonly anims = {
    play: (key: string): unknown => {
      this.animationCalls.push(key);
      if (this.failAnimation === key) throw new Error("play failed");
      return {};
    },
    stop: (): unknown => {
      this.calls.push("stop");
      return {};
    },
  };
  texture = "";
  frame = -1;
  displaySize = { width: 0, height: 0 };
  failAnimation: string | undefined;

  setTexture(key: string, frame?: string | number): this {
    this.texture = key;
    if (typeof frame === "number") this.frame = frame;
    this.calls.push(`texture:${key}`);
    return this;
  }

  setDisplaySize(width: number, height: number): this {
    this.displaySize = { width, height };
    this.calls.push(`size:${width}x${height}`);
    return this;
  }

  setFrame(frame: number): this {
    this.frame = frame;
    this.calls.push(`frame:${frame}`);
    return this;
  }

  on(event: string, listener: Listener): this {
    this.listeners.set(event, listener);
    return this;
  }

  off(event: string): this {
    this.listeners.delete(event);
    return this;
  }

  complete(key: string): void {
    this.listeners.get("animationcomplete")?.({ key });
  }
}

class FakeAnimations implements PhaserPlayerAnimationManagerLike {
  readonly created: PhaserPlayerAnimationConfig[] = [];
  readonly generated: string[] = [];

  generateFrameNumbers(
    key: string,
    range: { readonly start: number; readonly end: number },
  ): readonly unknown[] {
    this.generated.push(`${key}:${range.start}-${range.end}`);
    const frames: number[] = [];
    const step = range.start <= range.end ? 1 : -1;
    for (let frame = range.start; frame !== range.end + step; frame += step) {
      frames.push(frame);
    }
    return frames;
  }

  create(config: PhaserPlayerAnimationConfig): unknown {
    this.created.push(config);
    return config;
  }

  exists(key: string): boolean {
    return this.created.some((animation) => animation.key === key);
  }
}

function makeAdapter(
  textureExists: (key: string) => boolean = () => true,
) {
  const animations = new FakeAnimations();
  const loads: Array<{
    key: string;
    url: string;
    config: {
      readonly frameWidth: number;
      readonly frameHeight: number;
      readonly startFrame: number;
      readonly endFrame: number;
    };
  }> = [];
  const scene: PhaserPlayerSceneLike = {
    load: {
      spritesheet: (key, url, config) => {
        loads.push({ key, url, config });
      },
    },
    anims: animations,
    textures: { exists: textureExists },
  };
  const sprite = new FakeSprite();
  const calls: string[] = [];
  const adapter = new PhaserPlayerRuntime(scene, sprite, {
    now: () => 0,
    random: () => 0,
    effects: {
      resetKeyboard: () => calls.push("keyboard"),
      resetJoystick: () => calls.push("joystick"),
      stopMovement: () => calls.push("movement"),
    },
  });
  return { adapter, animations, calls, loads, sprite };
}

describe("Phaser 玩家有界适配器", () => {
  it("注册四个公开 128x128/16帧 webp 并创建原站参数动画", () => {
    const { adapter, animations, loads } = makeAdapter();
    adapter.preload();
    expect(loads.map((load) => load.key)).toEqual([
      "player-eating",
      "player-scratching",
      "player-tying-shoe",
      "player-sitting",
    ]);
    expect(loads.every((load) => load.url.includes("sample/original-public-build"))).toBe(
      true,
    );
    expect(loads.every((load) => load.url.endsWith(".webp"))).toBe(true);
    expect(loads.every((load) =>
      load.config.frameWidth === 128 &&
      load.config.frameHeight === 128 &&
      load.config.startFrame === 0 &&
      load.config.endFrame === 15,
    )).toBe(true);

    adapter.createAnimations();
    for (const key of [
      PLAYER_RUNTIME_ANIMATIONS.eating,
      PLAYER_RUNTIME_ANIMATIONS.scratching,
      PLAYER_RUNTIME_ANIMATIONS["tying-shoe"],
    ]) {
      expect(animations.created).toContainEqual(
        expect.objectContaining({ key, frameRate: 5, repeat: 0 }),
      );
    }
    expect(animations.created).toContainEqual(
      expect.objectContaining({
        key: PLAYER_RUNTIME_ANIMATIONS.sittingDown,
        frameRate: 16,
        repeat: 0,
      }),
    );
    expect(animations.created).toContainEqual(
      expect.objectContaining({
        key: PLAYER_RUNTIME_ANIMATIONS.standingUp,
        frameRate: 16,
        repeat: 0,
      }),
    );
    expect(animations.generated).toContain("player-sitting:15-0");
  });

  it("8秒动作使用64尺寸；播放失败立即恢复普通 idle", () => {
    const { adapter, sprite } = makeAdapter();
    adapter.createAnimations();
    adapter.enableControls(0);
    sprite.failAnimation = PLAYER_RUNTIME_ANIMATIONS.eating;

    expect(adapter.update(null, 8_000)).toMatchObject({
      status: "normal-idle",
      visualLocked: false,
    });
    expect(sprite.texture).toBe("player");
    expect(sprite.displaySize).toEqual({ width: 48, height: 48 });
    expect(sprite.frame).toBe(48);
  });

  it("单个资源缺失时选其他动作；全部缺失时降级普通 idle", () => {
    const partial = makeAdapter((key) => key !== "player-eating");
    partial.adapter.createAnimations();
    partial.adapter.enableControls(0);
    expect(partial.adapter.update(null, 8_000)).toMatchObject({
      status: "idle-action",
      idleAnimation: "scratching",
    });
    expect(partial.sprite.texture).toBe("player-scratching");
    expect(partial.sprite.displaySize).toEqual({ width: 64, height: 64 });

    const missing = makeAdapter((key) => key === "player");
    missing.adapter.createAnimations();
    missing.adapter.enableControls(0);
    expect(missing.adapter.update(null, 8_000)).toMatchObject({
      status: "normal-idle",
      visualLocked: false,
    });
    expect(missing.sprite.texture).toBe("player");
  });

  it("30秒坐下完成后保持末帧，移动先站起再恢复方向", () => {
    const { adapter, sprite } = makeAdapter();
    adapter.createAnimations();
    adapter.enableControls(0);

    expect(adapter.update(null, 30_000).status).toBe("sitting-down");
    sprite.complete(PLAYER_RUNTIME_ANIMATIONS.sittingDown);
    expect(adapter.status).toBe("sitting");
    expect(sprite.frame).toBe(15);
    expect(adapter.update("east", 30_001)).toMatchObject({
      status: "standing-up",
      movementDirection: null,
      pendingDirection: "east",
    });
    sprite.complete(PLAYER_RUNTIME_ANIMATIONS.standingUp);
    expect(adapter.status).toBe("normal-idle");
    expect(adapter.update(null, 30_002)).toMatchObject({
      status: "walking",
      movementDirection: "east",
    });
  });

  it("移动退出 idle 后只恢复贴图，不抢占 Main 的碰撞走路动画", () => {
    const { adapter, sprite } = makeAdapter();
    adapter.createAnimations();
    adapter.enableControls(0);
    expect(adapter.update(null, 8_000).status).toBe("idle-action");
    const playCount = sprite.animationCalls.length;

    expect(adapter.update("north", 8_100)).toMatchObject({
      status: "walking",
      movementDirection: "north",
      visualLocked: false,
    });
    expect(sprite.texture).toBe("player");
    expect(sprite.frame).toBe(24);
    expect(sprite.animationCalls).toHaveLength(playCount);
  });

  it("控制门、失焦 reset 与只读快照保持边界", () => {
    const { adapter, calls, sprite } = makeAdapter();
    adapter.createAnimations();
    adapter.enableControls(0);
    expect(sprite.listeners.has("animationcomplete")).toBe(true);

    adapter.blur(1);
    expect(calls).toEqual(["keyboard", "joystick", "movement"]);
    expect(sprite.listeners.has("animationcomplete")).toBe(true);
    adapter.disableControls(2);
    expect(sprite.listeners.has("animationcomplete")).toBe(false);
    expect(calls).toEqual([
      "keyboard",
      "joystick",
      "movement",
      "keyboard",
      "joystick",
      "movement",
    ]);
    const position = adapter.position;
    expect(position).toEqual({ x: 1088, y: 304 });
    expect(Object.isFrozen(position)).toBe(true);
    expect(adapter.control).toMatchObject({
      enabled: false,
      shutdown: false,
      status: "disabled",
    });
  });

  it("shutdown 停速/reset、移除监听，并永久拒绝 update", () => {
    const { adapter, calls, sprite } = makeAdapter();
    adapter.createAnimations();
    adapter.enableControls(0);
    expect(adapter.shutdown()).toBe(true);
    expect(adapter.shutdown()).toBe(false);
    expect(sprite.listeners.has("animationcomplete")).toBe(false);
    expect(calls).toEqual(["keyboard", "joystick", "movement"]);
    expect(adapter.control).toMatchObject({ shutdown: true, status: "shutdown" });
    adapter.createAnimations();
    adapter.preload();
    expect(sprite.listeners.has("animationcomplete")).toBe(false);
    expect(adapter.enableControls()).toBe(false);
    expect(() => adapter.update(null, 0)).toThrow("已关闭");
  });
});

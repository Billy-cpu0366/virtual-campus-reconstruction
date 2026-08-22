import { describe, expect, it } from "vitest";

import {
  TRAIN_COLLISION_ROW,
  TRAIN_DEPARTURE_DURATION,
  TRAIN_END_X,
  TRAIN_ENTRY_DURATION,
  TRAIN_HOLD_DURATION,
  TRAIN_START_X,
  TrainRouteRuntime,
} from "../../src/route/index.js";
import {
  PhaserTrainRuntime,
  type PhaserTrainCollisionShapeLike,
  type PhaserTrainEventsLike,
  type PhaserTrainSceneLike,
  type PhaserTrainSpriteLike,
} from "../../game/PhaserTrainRuntime.js";

class FakeEvents implements PhaserTrainEventsLike {
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

class FakeSprite implements PhaserTrainSpriteLike {
  x: number;
  y: number;
  readonly displayWidth = 128;
  destroyed = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setOrigin(_x: number, _y: number): this {
    return this;
  }

  setScale(_value: number): this {
    return this;
  }

  setDepth(_value: number): this {
    return this;
  }

  setAlpha(_value: number): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeShape implements PhaserTrainCollisionShapeLike {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  destroyed = false;
  readonly body = { updateFromGameObject: () => undefined };

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function makeScene(textureAvailable = true) {
  const events = new FakeEvents();
  const sprites: FakeSprite[] = [];
  const shapes: FakeShape[] = [];
  const blockingCalls: Array<readonly string[] | null> = [];
  const scene: PhaserTrainSceneLike = {
    load: { image: () => undefined },
    textures: { exists: () => textureAvailable },
    add: {
      sprite: (x, y) => {
        const sprite = new FakeSprite(x, y);
        sprites.push(sprite);
        return sprite;
      },
      rectangle: () => {
        const shape = new FakeShape();
        shapes.push(shape);
        return shape;
      },
    },
    physics: { add: { existing: () => undefined } },
    events,
  };
  return { scene, events, sprites, shapes, blockingCalls };
}

describe("TrainRouteRuntime", () => {
  it("按5秒进场、3秒停留、9秒离场推进，并让碰撞带跟随", () => {
    const runtime = new TrainRouteRuntime({ collisionWidth: 128 });
    expect(runtime.start(0)).toBe(true);
    expect(runtime.snapshot).toMatchObject({ state: "arriving", x: TRAIN_START_X });
    expect(runtime.start(1)).toBe(false);

    const halfway = runtime.tick(2_500);
    expect(halfway.state).toBe("arriving");
    expect(halfway.x).toBeGreaterThan(TRAIN_END_X);
    expect(halfway.x).toBeLessThan(TRAIN_START_X);
    expect(halfway.collisionBand.blockedCells).toContain(`${halfway.collisionBand.leftTile},${TRAIN_COLLISION_ROW}`);

    expect(runtime.tick(TRAIN_ENTRY_DURATION).state).toBe("holding");
    expect(runtime.snapshot.x).toBe(TRAIN_END_X);
    expect(runtime.tick(TRAIN_ENTRY_DURATION + TRAIN_HOLD_DURATION - 1).state).toBe("holding");
    expect(runtime.tick(TRAIN_ENTRY_DURATION + TRAIN_HOLD_DURATION).state).toBe("departing");
    expect(runtime.snapshot.x).toBe(TRAIN_END_X);

    const departing = runtime.tick(12_500);
    expect(departing.state).toBe("departing");
    expect(departing.x).toBeLessThan(TRAIN_END_X);
    expect(runtime.tick(TRAIN_ENTRY_DURATION + TRAIN_HOLD_DURATION + TRAIN_DEPARTURE_DURATION).state).toBe(
      "complete",
    );
    expect(runtime.snapshot.x).toBe(TRAIN_END_X - 4_000);
  });

  it("取消和shutdown后不保留活动路线；完成后可复用同一个owner", () => {
    const runtime = new TrainRouteRuntime();
    runtime.start(0);
    runtime.tick(2_000);
    expect(runtime.cancel(2_000).state).toBe("cancelled");
    expect(runtime.start(3_000)).toBe(true);
    runtime.tick(20_000);
    expect(runtime.snapshot.state).toBe("complete");
    expect(runtime.start(21_000)).toBe(true);
    expect(runtime.shutdown(21_000).state).toBe("shutdown");
    expect(runtime.start(22_000)).toBe(false);
  });
});

describe("PhaserTrainRuntime", () => {
  it("创建单个火车和静态碰撞带，进出场时更新blocking zone并完整清理", () => {
    const fake = makeScene();
    const calls: Array<readonly string[] | null> = [];
    const runtime = new PhaserTrainRuntime(fake.scene, {
      blockingZone: { setTrainBlockingZone: (cells) => calls.push(cells) },
    });
    runtime.preload();
    expect(runtime.start(0)).toEqual({ ok: true });
    expect(fake.sprites).toHaveLength(1);
    expect(fake.shapes).toHaveLength(1);
    expect(fake.events.count("update")).toBe(1);
    expect(calls.at(-1)).not.toBeNull();

    const initialShapeX = fake.shapes[0]?.x;
    fake.events.emit("update", 2_500);
    expect(fake.shapes[0]?.x).not.toBe(initialShapeX);
    expect(fake.sprites[0]?.x).toBe(runtime.snapshot.x);
    expect(runtime.start(2_501)).toEqual({ ok: false, reason: "already-running" });

    fake.events.emit("update", 17_000);
    expect(fake.sprites[0]?.destroyed).toBe(true);
    expect(fake.shapes[0]?.destroyed).toBe(true);
    expect(calls.at(-1)).toBeNull();
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
  });

  it("资源失败不创建对象；cancel可重启，shutdown清理并永久拒绝", () => {
    const missing = makeScene(false);
    const errors: string[] = [];
    const failed = new PhaserTrainRuntime(missing.scene, {
      onError: (reason) => errors.push(reason),
    });
    expect(failed.start(0)).toEqual({ ok: false, reason: "missing-texture" });
    expect(missing.sprites).toHaveLength(0);
    expect(errors).toContain("missing-texture");

    const fake = makeScene();
    const runtime = new PhaserTrainRuntime(fake.scene);
    expect(runtime.start(0)).toEqual({ ok: true });
    runtime.cancel(1_000);
    expect(fake.sprites[0]?.destroyed).toBe(true);
    expect(fake.shapes[0]?.destroyed).toBe(true);
    expect(runtime.start(2_000)).toEqual({ ok: true });
    runtime.shutdown(2_001);
    expect(fake.sprites.at(-1)?.destroyed).toBe(true);
    expect(runtime.start(2_002)).toEqual({ ok: false, reason: "shutdown" });
  });
});

import { describe, expect, it } from "vitest";

import { playerDepth } from "../../src/layer/index.js";
import { SPRAYER_CONFIGS, SPRAYER_TILE_SIZE } from "../../src/npc/index.js";
import { SPAWN_Y } from "../../src/player/index.js";
import {
  TRAIN_COLLISION_BOTTOM,
  TRAIN_COLLISION_TOP,
  TRAIN_COLLISION_X_ZONES,
  TRAIN_DEPARTURE_DURATION,
  TRAIN_END_X,
  TRAIN_ENTRY_DURATION,
  TRAIN_HOLD_DURATION,
  TRAIN_START_X,
  TRAIN_Y,
  TrainRouteRuntime,
} from "../../src/route/index.js";
import {
  PhaserTrainRuntime,
  TRAIN_PRESENTATION_DEPTH,
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
  readonly displayHeight = 64;
  depth = 0;
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

  setDepth(value: number): this {
    this.depth = value;
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
  readonly body = {
    width: 0,
    height: 0,
    setSize: (width: number, height: number) => {
      this.body.width = width;
      this.body.height = height;
    },
    updateFromGameObject: () => undefined,
  };

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
    const runtime = new TrainRouteRuntime({ collisionScale: 1.025 });
    expect(runtime.start(0)).toBe(true);
    expect(runtime.snapshot).toMatchObject({ state: "arriving", x: TRAIN_START_X });
    expect(runtime.start(1)).toBe(false);

    const halfway = runtime.tick(2_500);
    expect(halfway.state).toBe("arriving");
    expect(halfway.x).toBeGreaterThan(TRAIN_END_X);
    expect(halfway.x).toBeLessThan(TRAIN_START_X);
    expect(halfway.collisionRects).toHaveLength(TRAIN_COLLISION_X_ZONES.length);
    expect(halfway.collisionRects[0]).toMatchObject({
      localLeft: 0,
      localRight: 365,
      top: TRAIN_COLLISION_TOP,
      bottom: TRAIN_COLLISION_BOTTOM,
      centerY: 341,
    });
    expect(halfway.collisionRects.every((rect) => rect.blockedCells.length > 0)).toBe(true);

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
  it("train世界深度遮住出生玩家但保留sprayer前景", () => {
    const closestSprayerY = Math.min(
      ...SPRAYER_CONFIGS.map((config) => config.tileY * SPRAYER_TILE_SIZE),
    );
    expect(TRAIN_PRESENTATION_DEPTH).toBe(playerDepth(TRAIN_Y));
    expect(TRAIN_PRESENTATION_DEPTH).toBeGreaterThan(playerDepth(SPAWN_Y));
    expect(TRAIN_PRESENTATION_DEPTH).toBeLessThan(
      playerDepth(closestSprayerY),
    );
  });

  it("创建4个独立火车碰撞矩形，随进出场移动并完整清理", () => {
    const fake = makeScene();
    const calls: Array<readonly string[] | null> = [];
    let completes = 0;
    const runtime = new PhaserTrainRuntime(fake.scene, {
      blockingZone: { setTrainBlockingZone: (cells) => calls.push(cells) },
      onComplete: () => {
        completes += 1;
      },
    });
    runtime.preload();
    expect(runtime.start(0)).toEqual({ ok: true });
    expect(fake.sprites).toHaveLength(1);
    expect(fake.shapes).toHaveLength(4);
    expect(runtime.collisionShapeCount).toBe(4);
    expect(fake.sprites[0]?.depth).toBe(TRAIN_PRESENTATION_DEPTH);
    expect(runtime.visualSnapshot).toMatchObject({
      width: 128,
      height: 64,
      depth: TRAIN_PRESENTATION_DEPTH,
    });
    expect(fake.events.count("update")).toBe(1);
    expect(calls.at(-1)).not.toBeNull();

    const initialShapeX = fake.shapes.map((shape) => shape.x);
    fake.events.emit("update", 2_500);
    expect(fake.shapes.map((shape) => shape.x)).not.toEqual(initialShapeX);
    expect(fake.shapes).toEqual(
      expect.arrayContaining(
        runtime.snapshot.collisionRects.map((rect) =>
          expect.objectContaining({
            x: rect.centerX,
            y: rect.centerY,
            width: rect.width,
            height: rect.height,
          }),
        ),
      ),
    );
    expect(fake.shapes.every((shape) => shape.body.width > 0 && shape.body.height === 36)).toBe(true);
    expect(fake.sprites[0]?.x).toBe(runtime.snapshot.x);
    expect(runtime.start(2_501)).toEqual({ ok: false, reason: "already-running" });

    fake.events.emit("update", 17_000);
    expect(fake.sprites[0]?.destroyed).toBe(true);
    expect(fake.shapes[0]?.destroyed).toBe(true);
    expect(calls.at(-1)).toBeNull();
    expect(fake.events.count("update")).toBe(0);
    expect(fake.events.count("shutdown")).toBe(0);
    expect(completes).toBe(1);
    expect(runtime.visualSnapshot).toBeNull();
  });

  it("只通知既有路线的离站和离开视口，不改变进出场时序", () => {
    const fake = makeScene();
    let departures = 0;
    let leaves = 0;
    const runtime = new PhaserTrainRuntime(fake.scene, {
      viewport: () => ({ left: 400, width: 100 }),
      onDeparture: () => { departures += 1; },
      onLeaveViewport: () => { leaves += 1; },
    });
    expect(runtime.start(0)).toEqual({ ok: true });
    fake.events.emit("update", TRAIN_ENTRY_DURATION + TRAIN_HOLD_DURATION);
    expect(runtime.snapshot.state).toBe("departing");
    expect(departures).toBe(1);
    expect(leaves).toBe(0);
    fake.events.emit("update", 14_000);
    expect(leaves).toBe(1);
    expect(runtime.snapshot.state).toBe("departing");
  });

  it("teardown先清player collider，再清shape/sprite/blocking zone", () => {
    const fake = makeScene();
    const order: string[] = [];
    let cleanupCalls = 0;
    const runtime = new PhaserTrainRuntime(fake.scene, {
      connectCollision: (shape) => {
        const destroyShape = shape.destroy.bind(shape);
        shape.destroy = () => {
          order.push("shape");
          destroyShape();
        };
        return () => {
          cleanupCalls += 1;
          order.push("collider");
        };
      },
      blockingZone: {
        setTrainBlockingZone: (cells) => {
          if (cells === null) order.push("zone");
        },
      },
    });

    expect(runtime.start(0)).toEqual({ ok: true });
    runtime.cancel(1_000);
    expect(order.slice(-9)).toEqual([
      "collider",
      "collider",
      "collider",
      "collider",
      "shape",
      "shape",
      "shape",
      "shape",
      "zone",
    ]);
    expect(cleanupCalls).toBe(4);
    runtime.cancel(1_001);
    runtime.shutdown(1_002);
    expect(cleanupCalls).toBe(4);
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
    expect(fake.shapes).toHaveLength(4);
    expect(fake.shapes.every((shape) => shape.destroyed)).toBe(true);
    expect(runtime.start(2_000)).toEqual({ ok: true });
    runtime.shutdown(2_001);
    expect(fake.sprites.at(-1)?.destroyed).toBe(true);
    expect(runtime.start(2_002)).toEqual({ ok: false, reason: "shutdown" });
  });
});

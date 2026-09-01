import { describe, expect, it } from "vitest";
import {
  HELICOPTER_BLADE_DISPLAY_SIZE,
  HELICOPTER_BLADE_ANGLES_DEGREES,
  HELICOPTER_HIGH_RESOLUTION_BASELINE,
  HELICOPTER_MAIN_ROTOR_OFFSET,
  HELICOPTER_POSITION,
  HELICOPTER_TAIL_ROTOR_OFFSET_EAST,
  PhaserVehicleRuntime,
  POLICE_POSITIONS,
  POLICE_COLLISION_SIZE,
  VEHICLE_RUNTIME_ASSETS,
  VEHICLE_RUNTIME_CONTRACT,
  type PhaserVehicleDisplayObjectLike,
  type PhaserVehiclePhysicsBodyLike,
  type PhaserVehicleSceneLike,
} from "../../game/PhaserVehicleRuntime.js";

class FakeBody implements PhaserVehiclePhysicsBodyLike {
  public width = 0;
  public height = 0;
  public centered = false;
  public immovable = false;
  public moves = true;

  public setSize(width: number, height: number, center = true): this {
    this.width = width;
    this.height = height;
    this.centered = center;
    return this;
  }
}

class FakeObject implements PhaserVehicleDisplayObjectLike {
  public rotation = 0;
  public scaleX = 1;
  public scaleY = 1;
  public displayWidth = 0;
  public displayHeight = 0;
  public visible = true;
  public origin = { x: 0, y: 0 };
  public depth = 0;
  public frame: number | undefined;
  public destroyed = false;
  public destroyCount = 0;
  public body?: FakeBody;

  public constructor(
    public x: number,
    public y: number,
    public readonly key: string,
  ) {}

  public setOrigin(x: number, y: number): this {
    this.origin = { x, y };
    return this;
  }

  public setDepth(value: number): this {
    this.depth = value;
    return this;
  }

  public setScale(x: number, y = x): this {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }

  public setDisplaySize(width: number, height: number): this {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }

  public setFrame(frame: number): this {
    this.frame = frame;
    return this;
  }

  public setRotation(radians: number): this {
    this.rotation = radians;
    return this;
  }

  public destroy(): void {
    this.destroyed = true;
    this.destroyCount += 1;
  }
}

class FakeEvents {
  public readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  public offCalls = 0;

  public constructor(private readonly throwOnEvent?: string) {}

  public on(event: string, listener: (...args: unknown[]) => void): void {
    if (event === this.throwOnEvent) throw new Error("fake listener failure");
    const listeners = this.handlers.get(event) ?? new Set();
    listeners.add(listener);
    this.handlers.set(event, listeners);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.offCalls += 1;
    this.handlers.get(event)?.delete(listener);
  }

  public emit(event: string, ...args: unknown[]): void {
    for (const listener of this.handlers.get(event) ?? []) listener(...args);
  }
}

function createScene(options: {
  readonly missing?: string;
  readonly throwOnAdd?: number;
  readonly throwOnEvent?: string;
  readonly physics?: boolean;
} = {}): {
  readonly scene: PhaserVehicleSceneLike;
  readonly events: FakeEvents;
  readonly loaded: Array<Record<string, unknown>>;
  readonly objects: FakeObject[];
  readonly bodies: FakeBody[];
} {
  const events = new FakeEvents(options.throwOnEvent);
  const loaded: Array<Record<string, unknown>> = [];
  const objects: FakeObject[] = [];
  const bodies: FakeBody[] = [];
  let addCount = 0;
  const textureKeys = new Set<string>(
    Object.values(VEHICLE_RUNTIME_ASSETS).map((asset) => asset.key),
  );
  if (options.missing !== undefined) textureKeys.delete(options.missing);
  const makeObject = (x: number, y: number, key: string): FakeObject => {
    addCount += 1;
    if (options.throwOnAdd === addCount) throw new Error("fake add failure");
    const object = new FakeObject(x, y, key);
    objects.push(object);
    return object;
  };
  const scene: PhaserVehicleSceneLike = {
    load: {
      image: (key, url) => loaded.push({ kind: "image", key, url }),
      spritesheet: (key, url, config) => loaded.push({ kind: "spritesheet", key, url, ...config }),
    },
    textures: { exists: (key) => textureKeys.has(key) },
    add: {
      image: (x, y, key) => makeObject(x, y, key),
      sprite: (x, y, key, frame) => {
        const object = makeObject(x, y, key);
        object.frame = frame;
        return object;
      },
    },
    ...(options.physics === true ? {
      physics: {
        add: {
          existing: (value: unknown) => {
            const object = value as FakeObject;
            const body = new FakeBody();
            object.body = body;
            bodies.push(body);
            return body;
          },
        },
      },
    } : {}),
    events,
  };
  return { scene, events, loaded, objects, bodies };
}

describe("PhaserVehicleRuntime", () => {
  it("declares the five source-backed assets and preloads exact contracts", () => {
    const { scene, loaded } = createScene();
    const runtime = new PhaserVehicleRuntime(scene);

    runtime.preload();
    runtime.preload();

    expect(loaded).toEqual([
      {
        kind: "spritesheet",
        key: "npc-helicopter",
        url: "/sprites/npc-helicopter.webp",
        frameWidth: 84,
        frameHeight: 84,
      },
      {
        kind: "image",
        key: "npc-helicopter-rotor-back",
        url: "/sprites/npc-helicopter-rotor-back.webp",
      },
      {
        kind: "image",
        key: "npc-helicopter-rotor-main",
        url: "/sprites/npc-helicopter-rotor-main.webp",
      },
      {
        kind: "image",
        key: "npc-helicopter-high-resolution",
        url: "/sprites/npc-helicopter-high-resolution.webp",
      },
      {
        kind: "spritesheet",
        key: "car-police",
        url: "/sprites/cars/car-police.webp",
        frameWidth: 84,
        frameHeight: 84,
      },
    ]);
    expect(Object.values(VEHICLE_RUNTIME_ASSETS)).toHaveLength(5);
    expect(VEHICLE_RUNTIME_ASSETS.helicopterBody.url).toBe(
      "/sprites/npc-helicopter.webp",
    );
    expect(VEHICLE_RUNTIME_CONTRACT).toMatchObject({
      helicopter: {
        bladeCount: 5,
        bladeDepth: 2000,
        bodyFrame: 2,
        scale: 2,
        position: { x: 31 * 16 + 8, y: 80 * 16 + 8 },
        highResolutionBaseline: 84 * 2,
      },
      police: { count: 3, depth: 560, wheels: false, brakes: false, lights: false },
    });
  });

  it("creates the helicopter components and exactly three police bodies", () => {
    const { scene, objects } = createScene();
    const runtime = new PhaserVehicleRuntime(scene);

    expect(runtime.start(0)).toEqual({ ok: true });

    const body = objects.find((object) => object.key === "npc-helicopter");
    const tail = objects.find((object) => object.key === "npc-helicopter-rotor-back");
    const highResolution = objects.find(
      (object) => object.key === "npc-helicopter-high-resolution",
    );
    const police = objects.filter((object) => object.key === "car-police");
    const blades = objects.filter(
      (object) =>
        object.key === "npc-helicopter-rotor-main" &&
        object.displayWidth === HELICOPTER_BLADE_DISPLAY_SIZE.width,
    );
    const mainBlade = blades[0];

    expect(body).toMatchObject({
      x: HELICOPTER_POSITION.x,
      y: HELICOPTER_POSITION.y,
      frame: 2,
      scaleX: 2,
      scaleY: 2,
      visible: false,
    });
    expect(mainBlade).toMatchObject({
      x: HELICOPTER_POSITION.x + HELICOPTER_MAIN_ROTOR_OFFSET.x * 2,
      y: HELICOPTER_POSITION.y + HELICOPTER_MAIN_ROTOR_OFFSET.y * 2,
      displayWidth: HELICOPTER_BLADE_DISPLAY_SIZE.width,
      displayHeight: HELICOPTER_BLADE_DISPLAY_SIZE.height,
    });
    expect(tail).toMatchObject({
      x: HELICOPTER_POSITION.x + HELICOPTER_TAIL_ROTOR_OFFSET_EAST.x * 2,
      y: HELICOPTER_POSITION.y + HELICOPTER_TAIL_ROTOR_OFFSET_EAST.y * 2,
      displayWidth: 36,
      displayHeight: 36,
      scaleX: 1,
      scaleY: 1,
    });
    expect(highResolution).toMatchObject({
      x: HELICOPTER_POSITION.x,
      y: HELICOPTER_POSITION.y,
      displayWidth: HELICOPTER_HIGH_RESOLUTION_BASELINE,
      visible: true,
    });
    expect(blades).toHaveLength(5);
    expect(blades.every((blade) =>
      blade.x === HELICOPTER_POSITION.x + HELICOPTER_MAIN_ROTOR_OFFSET.x * 2 &&
      blade.y === HELICOPTER_POSITION.y + HELICOPTER_MAIN_ROTOR_OFFSET.y * 2,
    )).toBe(true);
    expect(blades.map((blade) => blade.rotation)).toEqual([0, 0, 0, 0, 0]);
    expect(blades.every((blade) => blade.depth === 2000)).toBe(true);
    expect(blades.every((blade) => blade.origin.x === 0.5 && blade.origin.y === 1)).toBe(true);
    expect(blades.every((blade) => blade.displayWidth === HELICOPTER_BLADE_DISPLAY_SIZE.width && blade.displayHeight === HELICOPTER_BLADE_DISPLAY_SIZE.height)).toBe(true);
    expect(runtime.snapshot).toMatchObject({
      helicopter: {
        kind: "helicopter",
        id: "helicopter-static",
        isHelicopter: true,
        idleDirection: "east",
        frame: 2,
        mainRotorSize: 90,
        mainRotorOffset: HELICOPTER_MAIN_ROTOR_OFFSET,
        rotationSpeed: 8,
        mainRotorScaleY: 0.25,
        tailRotorSize: 36,
        tailRotorOffset: HELICOPTER_TAIL_ROTOR_OFFSET_EAST,
        tailRotorScaleX: 1,
        highResolutionEnabled: true,
        highResolutionOffset: { x: 0, y: 0 },
        highResolutionBaseline: HELICOPTER_HIGH_RESOLUTION_BASELINE,
        highResolutionAspect: "UNKNOWN",
        highResolutionBounds: "UNKNOWN",
        bounds: "UNKNOWN",
        componentKeys: [
          "npc-helicopter",
          "npc-helicopter-rotor-main",
          "npc-helicopter-rotor-back",
          "npc-helicopter-high-resolution",
        ],
        bladeCount: 5,
      },
    });
    expect(police).toHaveLength(3);
    expect(objects).toHaveLength(11);
    expect(police.map((object) => ({ x: object.x, y: object.y, frame: object.frame }))).toEqual(
      POLICE_POSITIONS.map(({ x, y, frame }) => ({ x, y, frame })),
    );
    expect(police.every((object) =>
      object.depth === 560 && object.scaleX === 1 && object.scaleY === 1 &&
      object.visible === true,
    )).toBe(true);
    expect(runtime.snapshot.police).toEqual(
      POLICE_POSITIONS.map(({ x, y, frame }, index) => ({
        kind: "police",
        id: `police-static-${index + 1}`,
        x,
        y,
        frame,
        depth: 560,
        bounds: "UNKNOWN",
        componentKeys: ["car-police"],
        scale: 1,
        collisionBodyCreated: false,
      })),
    );
    expect(runtime.snapshot.policeAccessories).toEqual({
      wheels: false,
      brakes: false,
      lights: false,
      policeLights: "UNKNOWN",
    });
    expect(runtime.snapshot.police).not.toHaveLength(0);
    expect(runtime.snapshot.police.every((item) =>
      item.kind === "police" && item.id.startsWith("police-static-") &&
      item.componentKeys.length === 1 && item.bounds === "UNKNOWN",
    )).toBe(true);
    police[0]!.displayWidth = 84;
    police[0]!.displayHeight = 84;
    expect(runtime.snapshot.police[0]?.bounds).toEqual({
      left: POLICE_POSITIONS[0]!.x - 42,
      right: POLICE_POSITIONS[0]!.x + 42,
      top: POLICE_POSITIONS[0]!.y - 42,
      bottom: POLICE_POSITIONS[0]!.y + 42,
      width: 84,
      height: 84,
    });
    expect(Object.isFrozen(runtime.snapshot)).toBe(true);
    expect(Object.isFrozen(runtime.snapshot.police)).toBe(true);
    expect(HELICOPTER_BLADE_ANGLES_DEGREES).toEqual([0, 72, 144, 216, 288]);
  });

  it("creates centered static police collision bodies when physics is available", () => {
    const { scene, objects, bodies } = createScene({ physics: true });
    const runtime = new PhaserVehicleRuntime(scene);

    expect(runtime.start(0)).toEqual({ ok: true });
    const police = objects.filter((object) => object.key === "car-police");
    expect(runtime.policeCollisionTargets).toEqual(police);
    expect(bodies).toHaveLength(3);
    expect(bodies.every((body) =>
      body.width === POLICE_COLLISION_SIZE.width &&
      body.height === POLICE_COLLISION_SIZE.height &&
      body.centered && body.immovable && !body.moves,
    )).toBe(true);
    expect(runtime.snapshot.police.every((item) => item.collisionBodyCreated)).toBe(true);

    runtime.shutdown();
    expect(objects.every((object) => object.destroyed)).toBe(true);
  });

  it("uses finite bounded deltas, rotates directionally, and never recreates", () => {
    const { scene, events, objects } = createScene();
    const runtime = new PhaserVehicleRuntime(scene);
    runtime.start(100);
    const objectCount = objects.length;
    const blades = objects.filter(
      (object) =>
        object.key === "npc-helicopter-rotor-main" &&
        object.displayWidth === HELICOPTER_BLADE_DISPLAY_SIZE.width,
    );
    const before = blades.map((blade) => blade.rotation);
    const tail = objects.find((object) => object.key === "npc-helicopter-rotor-back")!;
    const tailBefore = tail.rotation;
    const policeBefore = objects
      .filter((object) => object.key === "car-police")
      .map((object) => ({ x: object.x, y: object.y, frame: object.frame }));

    events.emit("update", 200);
    events.emit("update", 300);
    events.emit("update", 400);
    events.emit("update", 500);
    const after = blades.map((blade) => blade.rotation);
    expect(after[0]).toBeGreaterThan(before[0]!);
    expect(after).toHaveLength(5);
    expect(new Set(after).size).toBe(5);
    expect(tail.rotation).toBeGreaterThan(tailBefore);
    expect(blades.every((blade) => blade.displayHeight <= 117)).toBe(true);
    expect(runtime.snapshot.helicopter?.mainRotorScaleY).toBe(0.25);
    expect(objects
      .filter((object) => object.key === "car-police")
      .map((object) => ({ x: object.x, y: object.y, frame: object.frame })))
      .toEqual(policeBefore);
    expect(runtime.snapshot.lastDeltaMs).toBe(100);
    expect(runtime.snapshot.rotorAngleRadians).toBeCloseTo(3.2);
    expect(runtime.start(500)).toEqual({ ok: false, reason: "already-running" });
    expect(objects).toHaveLength(objectCount);

    events.emit("update", 50);
    expect(runtime.snapshot.lastDeltaMs).toBe(0);
    events.emit("update", Number.NaN);
    expect(runtime.snapshot.lastDeltaMs).toBe(0);
    events.emit("update", 10_000);
    expect(runtime.snapshot.lastDeltaMs).toBe(9_950);
    events.emit("update", 10_001);
    expect(runtime.snapshot.lastDeltaMs).toBe(1);
    expect(runtime.snapshot.rotorAngleRadians).toBeCloseTo(3.232);
    expect(objects).toHaveLength(objectCount);

    events.emit("update", Number.MAX_VALUE);
    expect(Number.isFinite(runtime.snapshot.rotorAngleRadians)).toBe(true);
    expect(objects).toHaveLength(objectCount);

    const unanchored = new PhaserVehicleRuntime(createScene().scene);
    unanchored.start();
    unanchored.update(100);
    expect(unanchored.snapshot.lastDeltaMs).toBe(0);
    unanchored.update(200);
    expect(unanchored.snapshot.lastDeltaMs).toBe(100);
  });

  it("reports missing textures without creating anything", () => {
    const { scene, objects } = createScene({ missing: "car-police" });
    const diagnostics: string[] = [];
    const runtime = new PhaserVehicleRuntime(scene, {
      onError: (reason) => diagnostics.push(reason),
    });

    expect(runtime.start()).toEqual({ ok: false, reason: "missing-texture" });
    expect(objects).toHaveLength(0);
    expect(runtime.snapshot.state).toBe("idle");
    expect(runtime.snapshot.diagnostics).toContain("missing-texture");
    expect(diagnostics).toEqual(["missing-texture"]);
  });

  it("rolls back every partial object and listener on creation failure", () => {
    const { scene, events, objects } = createScene({ throwOnAdd: 4 });
    const diagnostics: string[] = [];
    const runtime = new PhaserVehicleRuntime(scene, {
      onError: (reason) => diagnostics.push(reason),
    });

    expect(runtime.start()).toEqual({ ok: false, reason: "create-failed" });
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.every((object) => object.destroyed)).toBe(true);
    expect(runtime.snapshot.state).toBe("idle");
    expect(runtime.snapshot.diagnostics).toContain("create-failed");
    expect(diagnostics).toContain("create-failed");
    expect(runtime.snapshot.helicopter).toBeNull();
    expect(runtime.snapshot.police).toEqual([]);
    expect(events.handlers.get("update")?.size ?? 0).toBe(0);
    expect(events.handlers.get("shutdown")?.size ?? 0).toBe(0);
  });

  it("cleans up when listener attachment fails and reports a stable reason", () => {
    const { scene, events, objects } = createScene({ throwOnEvent: "shutdown" });
    const diagnostics: string[] = [];
    const runtime = new PhaserVehicleRuntime(scene, {
      onError: (reason) => diagnostics.push(reason),
    });

    expect(runtime.start(0)).toEqual({
      ok: false,
      reason: "listener-attach-failed",
    });
    expect(objects.every((object) => object.destroyed)).toBe(true);
    expect(events.handlers.get("update")?.size ?? 0).toBe(0);
    expect(events.handlers.get("shutdown")?.size ?? 0).toBe(0);
    expect(runtime.snapshot.diagnostics).toEqual(["listener-attach-failed"]);
    expect(diagnostics).toEqual(["listener-attach-failed"]);
  });

  it("detaches listeners, destroys objects, and makes shutdown idempotent", () => {
    const { scene, events, objects } = createScene();
    const runtime = new PhaserVehicleRuntime(scene);
    runtime.start(0);

    events.emit("shutdown");
    const destroyCounts = objects.map((object) => object.destroyCount);
    const offCalls = events.offCalls;
    expect(runtime.snapshot.state).toBe("shutdown");
    expect(objects.every((object) => object.destroyed)).toBe(true);
    expect(runtime.snapshot.listenerAttached).toBe(false);

    runtime.shutdown();
    runtime.update(1000);
    expect(events.offCalls).toBe(offCalls);
    expect(objects.map((object) => object.destroyCount)).toEqual(destroyCounts);
    expect(runtime.start()).toEqual({ ok: false, reason: "shutdown" });
  });
});

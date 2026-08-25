import { describe, expect, it } from "vitest";

import {
  ROUTE_CROWD_CONFIGS,
  RouteCrowdRuntime,
  type RouteCrowdConfig,
  type RouteCrowdPathRequest,
} from "../../src/npc/index.js";

const testConfig = (overrides: Partial<RouteCrowdConfig> = {}): RouteCrowdConfig => ({
  id: "test-crowd",
  count: 1,
  startTiles: [{ x: 2, y: 3 }],
  endTiles: [{ x: 5, y: 3 }],
  movementSpeed: 48,
  speedVariation: { min: 1, max: 1 },
  delay: { minMs: 100, maxMs: 100 },
  afterDelay: { minMs: 100, maxMs: 100 },
  goBack: true,
  deleteAfterComplete: true,
  randomPositions: false,
  maxActiveInViewport: undefined,
  ...overrides,
});

const pathFor = (request: RouteCrowdPathRequest) => [
  request.start,
  { x: request.start.x + 48, y: request.start.y },
];

describe("RouteCrowdRuntime contract", () => {
  it("publishes the source-backed frozen groups with the required deterministic fields", () => {
    expect(ROUTE_CROWD_CONFIGS).toHaveLength(11);
    expect(ROUTE_CROWD_CONFIGS.every((config) => config.count > 0)).toBe(true);
    expect(
      ROUTE_CROWD_CONFIGS.every(
        (config) =>
          config.startTiles.length > 0 &&
          config.endTiles.length > 0 &&
          config.speedVariation.min <= config.speedVariation.max &&
          config.delay.minMs <= config.delay.maxMs &&
          config.afterDelay.minMs <= config.afterDelay.maxMs &&
          typeof config.goBack === "boolean" &&
          typeof config.deleteAfterComplete === "boolean" &&
          typeof config.randomPositions === "boolean" &&
          (config.maxActiveInViewport === undefined ||
            config.maxActiveInViewport > 0),
      ),
    ).toBe(true);
    expect(Object.isFrozen(ROUTE_CROWD_CONFIGS)).toBe(true);
    expect(Object.isFrozen(ROUTE_CROWD_CONFIGS[0])).toBe(true);
    expect(ROUTE_CROWD_CONFIGS.find((config) => config.id === "main-crowd"))
      .toMatchObject({
        startTiles: [{ x: 31, y: 81 }, { x: 32, y: 81 }, { x: 33, y: 81 }],
        endTiles: [{ x: 73, y: 133 }],
        movementSpeed: 45,
        goBack: false,
        randomPositions: true,
        maxActiveInViewport: 25,
      });
    expect(ROUTE_CROWD_CONFIGS.find((config) => config.id === "crowd-train"))
      .toMatchObject({
        count: 10,
        movementSpeed: 35,
        delay: { minMs: 2_400, maxMs: 2_400 },
        deleteAfterComplete: true,
        randomPositions: false,
        maxActiveInViewport: 10,
      });
    expect(
      ROUTE_CROWD_CONFIGS
        .filter((config) => config.id !== "crowd-train")
        .every((config) => config.randomPositions),
    ).toBe(true);
    expect(
      ROUTE_CROWD_CONFIGS
        .filter((config) => config.maxActiveInViewport === undefined)
        .map((config) => config.id),
    ).toEqual(["walking-crowd", "hazmat-crowd", "outside_concert1"]);
    expect(
      Object.fromEntries(
        ROUTE_CROWD_CONFIGS
          .filter((config) => config.maxActiveInViewport !== undefined)
          .map((config) => [config.id, config.maxActiveInViewport]),
      ),
    ).toEqual({
      "main-crowd": 25,
      "loop-crowd": 10,
      drinkers: 5,
      concert_crowd: 40,
      beach_crowd_walk: 4,
      "vertical-crowd": 20,
      "vertical-crowd-reverse": 20,
      "crowd-train": 10,
    });
  });

  it("replays the same creation and progression with an injected random source", () => {
    const makeRuntime = () =>
      new RouteCrowdRuntime({
        random: () => 0.25,
        configs: [testConfig({ id: "replay", count: 2 })],
        pathProvider: pathFor,
      });

    const first = makeRuntime();
    const second = makeRuntime();
    expect(first.start(0)).toEqual(second.start(0));
    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.tick(150)).toEqual(second.tick(150));
    expect(first.tick(650)).toEqual(second.tick(650));
  });

  it("does not create an instance when the provider cannot produce a path", () => {
    const calls: RouteCrowdPathRequest[] = [];
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig({ count: 2 })],
      pathProvider: {
        findPath: (request) => {
          calls.push(request);
          return null;
        },
      },
    });

    expect(runtime.start(0)).toEqual({
      ok: true,
      created: 0,
      pathFailures: 2,
    });
    expect(calls).toHaveLength(2);
    expect(runtime.snapshot.instances).toHaveLength(0);
    expect(runtime.started).toBe(false);
  });

  it("processes batched startup one at a time and reports final failures", () => {
    const calls: RouteCrowdPathRequest[] = [];
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig({ count: 5 })],
      pathProvider: {
        findPath: (request) => {
          calls.push(request);
          return calls.length === 3 ? null : pathFor(request);
        },
      },
    });

    expect(runtime.startBatched(0)).toMatchObject({
      ok: true,
      complete: false,
      created: 1,
      pathFailures: 0,
    });
    expect(calls).toHaveLength(1);
    expect(runtime.snapshot.instances).toHaveLength(1);

    let result = runtime.startBatched(0);
    while (result.ok && !result.complete) {
      result = runtime.startBatched(0);
    }
    expect(result).toEqual({
      ok: true,
      complete: true,
      created: 4,
      pathFailures: 1,
    });
    expect(calls).toHaveLength(5);
    expect(runtime.snapshot.instances).toHaveLength(4);
    expect(runtime.started).toBe(true);
  });

  it("covers delay, moving, returning and restart for a round trip", () => {
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig()],
      baseSpeed: 48,
      pathProvider: pathFor,
    });

    expect(runtime.start(0)).toMatchObject({ ok: true, created: 1 });
    expect(runtime.snapshot.instances[0]?.state).toBe("delay");
    runtime.tick(99);
    expect(runtime.snapshot.instances[0]?.state).toBe("delay");
    runtime.tick(100);
    expect(runtime.snapshot.instances[0]?.state).toBe("moving");
    runtime.tick(1_100);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "delay",
      position: { x: 80, y: 48 },
      destroyed: false,
    });
    runtime.tick(1_199);
    expect(runtime.snapshot.instances[0]?.position).toEqual({ x: 80, y: 48 });
    runtime.tick(1_200);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "returning",
      position: { x: 80, y: 48 },
    });
    runtime.tick(2_300);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "moving",
      generation: 1,
      position: { x: 32, y: 48 },
      destroyed: false,
    });
  });

  it("deletes one-way routes or respawns them according to the contract", () => {
    const oneWayDelete = new RouteCrowdRuntime({
      configs: [testConfig({ goBack: false, deleteAfterComplete: true })],
      baseSpeed: 48,
      pathProvider: pathFor,
    });
    oneWayDelete.start(0);
    oneWayDelete.tick(100);
    oneWayDelete.tick(1_100);
    expect(oneWayDelete.snapshot.instances[0]?.state).toBe("gone");

    const oneWayRespawn = new RouteCrowdRuntime({
      configs: [testConfig({ goBack: false, deleteAfterComplete: false })],
      baseSpeed: 48,
      pathProvider: pathFor,
    });
    oneWayRespawn.start(0);
    oneWayRespawn.tick(100);
    oneWayRespawn.tick(1_100);
    expect(oneWayRespawn.snapshot.instances[0]).toMatchObject({
      state: "delay",
      generation: 1,
      position: { x: 32, y: 48 },
    });
    oneWayRespawn.tick(1_200);
    expect(oneWayRespawn.snapshot.instances[0]?.state).toBe("moving");
  });

  it("culls by full path bounds and restores the logical state when visible again", () => {
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig({ delay: { minMs: 0, maxMs: 0 } })],
      pathProvider: pathFor,
    });
    runtime.start(0, { left: 1_000, top: 1_000, width: 10, height: 10 });
    expect(runtime.snapshot.instances[0]?.materialized).toBe(false);
    runtime.tick(250, { left: 1_000, top: 1_000, width: 10, height: 10 });
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "moving",
      materialized: false,
      destroyed: false,
    });

    runtime.tick(250, { left: 0, top: 0, width: 100, height: 100 });
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "moving",
      materialized: true,
      visible: true,
      position: { x: 44, y: 48 },
    });
  });

  it("advances a visible point and updates its facing", () => {
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig({ delay: { minMs: 0, maxMs: 0 }, goBack: false })],
      pathProvider: (request) => [
        request.start,
        { x: request.start.x + 192, y: request.start.y },
      ],
    });
    const viewport = { left: 0, top: 0, width: 1_000, height: 1_000 };
    runtime.start(0, viewport);
    runtime.tick(1_000, viewport);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      position: { x: 80, y: 48 },
      state: "moving",
      facing: "east",
      visible: true,
      materialized: true,
    });
    runtime.tick(1_500, viewport);
    expect(runtime.snapshot.instances[0]?.position.x).toBe(104);
  });

  it("starts random-position groups at reproducible, non-overlapping waypoints", () => {
    const config = testConfig({
      id: "dispersed",
      count: 4,
      delay: { minMs: 0, maxMs: 0 },
      goBack: false,
      deleteAfterComplete: false,
      randomPositions: true,
    });
    const makeRuntime = () => new RouteCrowdRuntime({
      random: () => 0.25,
      configs: [config],
      pathProvider: (request) => [
        request.start,
        { x: request.start.x + 16, y: request.start.y },
        { x: request.start.x + 32, y: request.start.y },
        { x: request.start.x + 48, y: request.start.y },
        { x: request.start.x + 64, y: request.start.y },
      ],
    });
    const first = makeRuntime();
    const second = makeRuntime();
    first.start(0);
    second.start(0);
    expect(first.snapshot).toEqual(second.snapshot);
    const positions = first.snapshot.instances.map(({ position }) => `${position.x}:${position.y}`);
    expect(new Set(positions).size).toBe(4);
    expect(first.snapshot.instances.some(({ position }) => position.x > 32)).toBe(true);
  });

  it("keeps a random start before the terminal waypoint when a route can move", () => {
    const runtime = new RouteCrowdRuntime({
      random: () => 0,
      configs: [testConfig({
        delay: { minMs: 0, maxMs: 0 },
        goBack: false,
        randomPositions: true,
      })],
      pathProvider: pathFor,
    });
    runtime.start(0);
    expect(runtime.snapshot.instances[0]?.position).toEqual({ x: 32, y: 48 });
    runtime.tick(1_000);
    expect(runtime.snapshot.instances[0]?.position.x).toBeGreaterThan(32);
  });

  it("caps materialized instances per group without changing logical instances", () => {
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig({
        count: 6,
        maxActiveInViewport: 3,
        delay: { minMs: 0, maxMs: 0 },
        goBack: false,
        deleteAfterComplete: false,
      })],
      pathProvider: pathFor,
    });
    runtime.start(0, { left: 0, top: 0, width: 1_000, height: 1_000 });
    expect(runtime.snapshot.instances).toHaveLength(6);
    expect(runtime.snapshot.instances.filter((item) => item.materialized)).toHaveLength(3);
  });

  it("walks every waypoint and applies injected delay and speed variation", () => {
    const runtime = new RouteCrowdRuntime({
      random: () => 0.5,
      configs: [testConfig({
        delay: { minMs: 100, maxMs: 300 },
        speedVariation: { min: 0.5, max: 1.5 },
      })],
      baseSpeed: 48,
      pathProvider: (request) => [
        request.start,
        { x: request.start.x + 24, y: request.start.y },
        { x: request.start.x + 24, y: request.start.y + 24 },
      ],
    });

    runtime.start(0);
    runtime.tick(199);
    expect(runtime.snapshot.instances[0]?.position).toEqual({ x: 32, y: 48 });
    runtime.tick(700);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "moving",
      position: { x: 56, y: 48 },
    });
    runtime.tick(1_199);
    expect(runtime.snapshot.instances[0]?.position.y).toBeGreaterThan(48);
  });

  it("waits before a dynamically blocked next waypoint and resumes with its facing", () => {
    let blocked = true;
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig({ delay: { minMs: 0, maxMs: 0 }, goBack: false, deleteAfterComplete: false })],
      pathProvider: (request) => [
        request.start,
        { x: request.start.x + 24, y: request.start.y },
        { x: request.start.x + 48, y: request.start.y },
      ],
      isBlocked: (point) => blocked && point.x === 80,
    });

    runtime.start(0);
    runtime.tick(600);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "waiting",
      position: { x: 56, y: 48 },
      facing: "east",
    });
    runtime.tick(1_000);
    expect(runtime.snapshot.instances[0]?.state).toBe("waiting");
    blocked = false;
    runtime.tick(1_250);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "moving",
      facing: "east",
    });
    expect(runtime.snapshot.instances[0]!.position.x).toBeGreaterThan(56);
  });

  it("cancel clears active instances, while shutdown prevents restart", () => {
    const runtime = new RouteCrowdRuntime({
      configs: [testConfig()],
      pathProvider: pathFor,
    });
    runtime.start(0);
    expect(runtime.cancel().instances).toHaveLength(0);
    expect(runtime.start(10)).toMatchObject({ ok: true, created: 1 });
    expect(runtime.shutdown().instances).toHaveLength(0);
    expect(runtime.start(20)).toEqual({ ok: false, reason: "shutdown" });
  });
});

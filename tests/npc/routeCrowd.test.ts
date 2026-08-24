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
  tileCandidates: [{ x: 2, y: 3 }],
  speedVariation: { min: 1, max: 1 },
  delay: { minMs: 100, maxMs: 100 },
  goBack: true,
  deleteAfterComplete: true,
  ...overrides,
});

const pathFor = (request: RouteCrowdPathRequest) => [
  request.start,
  { x: request.start.x + 48, y: request.start.y },
];

describe("RouteCrowdRuntime contract", () => {
  it("publishes nine frozen groups with the required deterministic fields", () => {
    expect(ROUTE_CROWD_CONFIGS).toHaveLength(9);
    expect(ROUTE_CROWD_CONFIGS.every((config) => config.count > 0)).toBe(true);
    expect(
      ROUTE_CROWD_CONFIGS.every(
        (config) =>
          config.tileCandidates.length > 0 &&
          config.speedVariation.min <= config.speedVariation.max &&
          config.delay.minMs <= config.delay.maxMs &&
          typeof config.goBack === "boolean" &&
          typeof config.deleteAfterComplete === "boolean",
      ),
    ).toBe(true);
    expect(Object.isFrozen(ROUTE_CROWD_CONFIGS)).toBe(true);
    expect(Object.isFrozen(ROUTE_CROWD_CONFIGS[0])).toBe(true);
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
    expect(runtime.snapshot.instances[0]?.state).toBe("returning");
    expect(runtime.snapshot.instances[0]?.position).toEqual({ x: 80, y: 48 });
    runtime.tick(2_100);
    expect(runtime.snapshot.instances[0]).toMatchObject({
      state: "delay",
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

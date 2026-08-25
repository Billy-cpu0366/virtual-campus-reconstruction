import { describe, expect, it } from "vitest";

import {
  BUG_CROWD_CONFIG,
  BUG_CROWD_CONFIGS,
  BUG_CROWD_TILE_SIZE,
  BugCrowdRuntime,
  type BugCrowdPoint,
  type BugCrowdRuntimeOptions,
} from "../../src/npc/index.js";

const center = (x: number, y: number): BugCrowdPoint => ({
  x: x * BUG_CROWD_TILE_SIZE + 8,
  y: y * BUG_CROWD_TILE_SIZE + 8,
});

const pathProvider = (options: {
  readonly calls?: Array<{ start: BugCrowdPoint; end: BugCrowdPoint }>;
} = {}) => ({
  findPath: (request: { start: BugCrowdPoint; end: BugCrowdPoint }) => {
    options.calls?.push({ start: request.start, end: request.end });
    return [request.start, request.end];
  },
});

function runtime(
  overrides: Partial<BugCrowdRuntimeOptions> = {},
): BugCrowdRuntime {
  return new BugCrowdRuntime({
    random: () => 0.5,
    pathProvider: pathProvider(),
    ...overrides,
  });
}

describe("BugCrowdRuntime", () => {
  it("publishes the immutable public bug-area configuration", () => {
    expect(BUG_CROWD_CONFIGS).toEqual([BUG_CROWD_CONFIG]);
    expect(BUG_CROWD_CONFIG).toMatchObject({
      id: "bug-area",
      startTiles: [
        { x: 5, y: 128 }, { x: 9, y: 129 }, { x: 13, y: 130 },
        { x: 17, y: 131 }, { x: 21, y: 132 }, { x: 7, y: 133 },
        { x: 11, y: 128 }, { x: 15, y: 129 }, { x: 19, y: 130 },
      ],
      endTiles: [
        { x: 23, y: 133 }, { x: 19, y: 132 }, { x: 15, y: 131 },
        { x: 11, y: 130 }, { x: 7, y: 129 }, { x: 21, y: 128 },
        { x: 17, y: 133 }, { x: 13, y: 132 }, { x: 9, y: 131 },
      ],
      npcCount: 10,
      movementSpeed: 15,
      speedVariation: 0.3,
      mode: "wander",
      randomPositions: true,
      wanderDistance: 24,
      wanderInterval: { minMs: 2_000, maxMs: 4_000 },
      sprite: "npc-bug",
      maxActiveInViewport: 40,
    });
    expect(Object.isFrozen(BUG_CROWD_CONFIG)).toBe(true);
    expect(Object.isFrozen(BUG_CROWD_CONFIG.startTiles)).toBe(true);
    expect(Object.isFrozen(BUG_CROWD_CONFIG.startTiles[0])).toBe(true);
    expect(Object.isFrozen(BUG_CROWD_CONFIG.wanderInterval)).toBe(true);
    expect(Object.isFrozen(BUG_CROWD_CONFIGS)).toBe(true);
  });

  it("selects a new target only when its timestamp interval elapses", () => {
    const calls: Array<{ start: BugCrowdPoint; end: BugCrowdPoint }> = [];
    const crowd = runtime({ pathProvider: pathProvider({ calls }) });

    crowd.start(0);
    expect(calls).toHaveLength(BUG_CROWD_CONFIG.npcCount);
    crowd.tick(2_999);
    expect(calls).toHaveLength(BUG_CROWD_CONFIG.npcCount);
    crowd.tick(3_000);
    expect(calls).toHaveLength(BUG_CROWD_CONFIG.npcCount * 2);
    expect(calls.at(-1)?.start).toBeDefined();
  });

  it("moves through the path provider at the configured speed", () => {
    const crowd = new BugCrowdRuntime({
      random: () => 0.5,
      pathProvider: (request) => [
        request.start,
        { x: request.start.x + 150, y: request.start.y },
      ],
    });

    crowd.start(0);
    crowd.tick(1_000);
    expect(crowd.snapshot.instances[0]).toMatchObject({
      position: { x: center(21, 132).x + 15, y: center(21, 132).y },
      state: "moving",
      sprite: "npc-bug",
    });
  });

  it("uses random start tiles for logical instances", () => {
    const starts = [
      center(5, 128), center(9, 129), center(13, 130),
      center(17, 131), center(21, 132), center(7, 133),
      center(11, 128), center(15, 129), center(19, 130),
    ];
    let randomCalls = 0;
    const crowd = new BugCrowdRuntime({
      random: () => {
        const value = randomCalls % 6 === 0
          ? Math.min(0.99, Math.floor(randomCalls / 6) / 9)
          : 0.5;
        randomCalls += 1;
        return value;
      },
      pathProvider: pathProvider(),
    });

    crowd.start(0);
    expect(crowd.snapshot.instances).toHaveLength(10);
    expect(crowd.snapshot.instances.every((item) =>
      starts.some((start) => start.x === item.position.x && start.y === item.position.y),
    )).toBe(true);
    expect(new Set(crowd.snapshot.instances.map((item) =>
      `${item.position.x}:${item.position.y}`,
    )).size).toBeGreaterThan(1);
  });

  it("culls materialization without removing logical instances", () => {
    const crowd = runtime();
    crowd.start(0, { left: 0, top: 0, width: 100, height: 100 });
    expect(crowd.snapshot.instances).toHaveLength(10);
    expect(crowd.snapshot.instances.every((item) => !item.materialized)).toBe(true);

    crowd.tick(0, {
      left: center(21, 132).x - 1,
      top: center(21, 132).y - 1,
      width: 2,
      height: 2,
    });
    expect(crowd.snapshot.instances).toHaveLength(10);
    expect(crowd.snapshot.instances.filter((item) => item.materialized)).toHaveLength(10);

    crowd.tick(2_000, { left: 0, top: 0, width: 100, height: 100 });
    expect(crowd.snapshot.instances).toHaveLength(10);
    expect(crowd.snapshot.instances.every((item) => !item.materialized)).toBe(true);
  });

  it("supports cancel and prevents a shutdown runtime from restarting", () => {
    const crowd = runtime();
    crowd.start(0);
    expect(crowd.cancel().instances).toHaveLength(0);
    crowd.start(10);
    expect(crowd.shutdown().instances).toHaveLength(0);
    expect(crowd.start(20).instances).toHaveLength(0);
  });
});

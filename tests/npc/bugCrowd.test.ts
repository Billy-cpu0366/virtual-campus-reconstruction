import { describe, expect, it } from "vitest";

import {
  BUG_CROWD_TILE_SIZE,
  BugCrowdRuntime,
  type BugCrowdPoint,
  type BugCrowdRuntimeOptions,
} from "../../src/npc/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";
import {
  bugCrowdFrameForFacing,
  PhaserBugCrowdRuntime,
  preloadBugCrowdRuntimeAssets,
  type PhaserBugCrowdSceneLike,
} from "../../game/PhaserBugCrowdRuntime.js";

/** 配置不再从 src/ 里来，是读磁盘上那份 JSON——和游戏里读的是同一份。 */
const CONFIGS = await loadNpcConfigs(createDiskConfigSource());
const CONFIG = CONFIGS.bugCrowd;
/** 虫子长什么样：帧规格、缩放、锚点、四方向起始帧。原先写死在 game/ 里。 */
const PRESENTATION = CONFIGS.presentation.bugCrowd;

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
    config: CONFIG,
    random: () => 0.5,
    pathProvider: pathProvider(),
    ...overrides,
  });
}

class BugSprite {
  public frame = -1;
  public scale = 1;
  public origin = { x: 0, y: 0 };
  public destroyed = false;

  public constructor(public x: number, public y: number) {}

  public setOrigin(x: number, y: number): this {
    this.origin = { x, y };
    return this;
  }

  public setScale(value: number): this {
    this.scale = value;
    return this;
  }

  public setFrame(value: number): this {
    this.frame = value;
    return this;
  }

  public setDepth(_value: number): this { return this; }
  public destroy(): void { this.destroyed = true; }
}

describe("BugCrowdRuntime", () => {
  it("uses the public 38px, 24-frame spritesheet contract", () => {
    let loaded: {
      key: string;
      url: string;
      config: {
        frameWidth: number;
        frameHeight: number;
        startFrame?: number;
        endFrame?: number;
      };
    } | undefined;
    preloadBugCrowdRuntimeAssets({
      spritesheet: (key, url, config) => {
        loaded = { key, url, config: { ...config } };
      },
    }, PRESENTATION);

    expect(loaded).toEqual({
      key: "npc-bug",
      url: "/sprites/npc-bug.webp",
      config: {
        frameWidth: 38,
        frameHeight: 38,
        startFrame: 0,
        endFrame: 23,
      },
    });
    expect(PRESENTATION).toMatchObject({
      frameWidth: 38,
      frameHeight: 38,
      frameCount: 24,
      frameRate: 10,
      displayScale: 0.63,
      origin: { x: 0.5, y: 0.85 },
      facingFrameStart: { south: 0, north: 6, west: 12, east: 18 },
    });
    expect(Object.isFrozen(PRESENTATION)).toBe(true);
  });

  it("贴图规格是按传进来的那份配置登记的，不是写死的", () => {
    const loads: Array<{ key: string; config: { frameWidth: number; endFrame: number | undefined } }> = [];
    preloadBugCrowdRuntimeAssets({
      spritesheet: (key, _url, config) => {
        loads.push({ key, config: { frameWidth: config.frameWidth, endFrame: config.endFrame } });
      },
    }, { ...PRESENTATION, frameWidth: 64, frameCount: 8 });
    expect(loads).toEqual([{ key: "npc-bug", config: { frameWidth: 64, endFrame: 7 } }]);
  });

  it("renders direction frames with the public scale and origin", () => {
    const sprites: BugSprite[] = [];
    const scene: PhaserBugCrowdSceneLike = {
      textures: { exists: () => true },
      add: {
        sprite: (x, y) => {
          const sprite = new BugSprite(x, y);
          sprites.push(sprite);
          return sprite;
        },
      },
    };
    const runtime = new PhaserBugCrowdRuntime(scene, {
      config: CONFIG,
      pathProvider: pathProvider(),
      presentation: PRESENTATION,
      viewport: () => ({ left: 0, top: 0, width: 2_240, height: 2_240 }),
    });

    expect(runtime.start(0)).toBe(true);
    expect(sprites).toHaveLength(10);
    expect(sprites.every((sprite) => sprite.scale === PRESENTATION.displayScale)).toBe(true);
    expect(sprites.every((sprite) =>
      sprite.origin.x === PRESENTATION.origin.x && sprite.origin.y === PRESENTATION.origin.y,
    )).toBe(true);
    expect(sprites.every((sprite) =>
      sprite.frame >= 0 && sprite.frame < PRESENTATION.frameCount)).toBe(true);
    expect(PRESENTATION.displayScale).toBe(0.63);
    expect(PRESENTATION.origin).toEqual({ x: 0.5, y: 0.85 });

    runtime.update(100);
    expect(sprites.every((sprite) => sprite.frame >= 0 && sprite.frame < 24)).toBe(true);
    expect(bugCrowdFrameForFacing("south", 0, PRESENTATION)).toBe(0);
    expect(bugCrowdFrameForFacing("south", 500, PRESENTATION)).toBe(5);
    expect(bugCrowdFrameForFacing("north", 0, PRESENTATION)).toBe(6);
    expect(bugCrowdFrameForFacing("west", 0, PRESENTATION)).toBe(12);
    expect(bugCrowdFrameForFacing("east", 0, PRESENTATION)).toBe(18);
    expect(bugCrowdFrameForFacing("east", 600, PRESENTATION)).toBe(18);
    expect(bugCrowdFrameForFacing("east", 600, PRESENTATION, false)).toBe(18);
    // 四个方向的起始帧认配置里那份：改配置能改行为，说明代码没把 6/12/18 写死。
    const shifted = {
      ...PRESENTATION,
      facingFrameStart: { ...PRESENTATION.facingFrameStart, north: 2 },
    };
    expect(bugCrowdFrameForFacing("north", 0, shifted)).toBe(2);
    // 每方向几帧是从 frameCount ÷ 方向数（24 ÷ 4 = 6）算出来的，原先写死 6。
    // 7000 毫秒 × 每秒 10 帧 = 第 70 帧：除 6 余 4，除 8 余 6。
    expect(PRESENTATION.frameRate).toBe(10);
    expect(bugCrowdFrameForFacing("south", 7_000, PRESENTATION)).toBe(4);
    const wide = { ...PRESENTATION, frameCount: 32 };
    expect(bugCrowdFrameForFacing("south", 7_000, wide)).toBe(6);

    runtime.shutdown();
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
  });

  it("读出来还是 bug-area 这一片、这些值", () => {
    expect(CONFIG).toMatchObject({
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
      randomPositions: true,
      wanderDistance: 24,
      wanderInterval: { minMs: 2_000, maxMs: 4_000 },
      sprite: "npc-bug",
      maxActiveInViewport: 40,
    });
    expect(CONFIG).not.toHaveProperty("mode");
    expect(Object.isFrozen(CONFIG)).toBe(true);
    expect(Object.isFrozen(CONFIG.startTiles)).toBe(true);
    expect(Object.isFrozen(CONFIG.startTiles[0])).toBe(true);
    expect(Object.isFrozen(CONFIG.wanderInterval)).toBe(true);
  });

  it("selects a new target only when its timestamp interval elapses", () => {
    const calls: Array<{ start: BugCrowdPoint; end: BugCrowdPoint }> = [];
    const crowd = runtime({ pathProvider: pathProvider({ calls }) });

    crowd.start(0);
    expect(calls).toHaveLength(CONFIG.npcCount);
    crowd.tick(2_999);
    expect(calls).toHaveLength(CONFIG.npcCount);
    crowd.tick(3_000);
    expect(calls).toHaveLength(CONFIG.npcCount * 2);
    expect(calls.at(-1)?.start).toBeDefined();
  });

  it("moves through the path provider at the configured speed", () => {
    const crowd = new BugCrowdRuntime({
      config: CONFIG,
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
      config: CONFIG,
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

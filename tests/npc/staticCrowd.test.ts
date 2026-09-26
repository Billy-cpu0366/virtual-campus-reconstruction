import { describe, expect, it } from "vitest";

import {
  StaticCrowdRuntime,
  staticCrowdRequestedCount,
  type StaticCrowdPoint,
  type StaticCrowdRegion,
} from "../../src/npc/index.js";
import { PhaserStaticCrowdRuntime, keepStaticCrowdOffTrack } from "../../game/PhaserStaticCrowdRuntime.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";

/** 区域、贴图池、关掉的区域、八项调参现在全部读磁盘上那份配置。 */
const CONFIGS = await loadNpcConfigs(createDiskConfigSource());
const STATIC_CROWD_REGIONS = CONFIGS.staticCrowdRegions;
const TUNING = CONFIGS.tuning.staticCrowd;
const CROWD = {
  regions: STATIC_CROWD_REGIONS,
  spritePools: CONFIGS.staticCrowdSpritePools,
  disabledRegionIndexes: CONFIGS.staticCrowdDisabledRegionIndexes,
  tuning: TUNING,
};
const COFFEE_STATIC_MIN_SPACING = TUNING.coffeeMinSpacing;
/** 三组贴图 key、每帧切多大、判定视野的半宽、多久转一次头——原先写死在 game/ 里。 */
const PRESENTATION = CONFIGS.presentation.staticCrowd;
/** 铁轨带读的是路线人群那份表——两边共读一处，静态人群不另抄一份。 */
const TRACK_BAND = CONFIGS.presentation.routeCrowd.trackBand;
const STATIC_CROWD_MIN_SPACING = TUNING.minSpacing;
const STOP_AI_BACKGROUND_REGION_INDEX = TUNING.stopAiBackgroundRegionIndex;
const STOP_AI_BACKGROUND_COUNT = TUNING.stopAiBackgroundCount;
const FOOTBALL_REGION_INDEX = TUNING.footballRegionIndexes[0]!;
const STATION_REGION_INDEX = TUNING.stationRegionIndexes[0]!;

/** 一块能用来看「人数 / 间距听谁的」的矩形区域。 */
function probeRegion(regionIndex: number, left: number): StaticCrowdRegion {
  return {
    regionIndex,
    tileCount: 5,
    type: "crowd",
    outline: [
      { x: left, y: 0 },
      { x: left + 80, y: 0 },
      { x: left + 80, y: 8 },
      { x: left + 40, y: 16 },
      { x: left, y: 16 },
    ],
  };
}

function seeded(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length]!;
}

class Sprite {
  destroyed = false;
  constructor(public x: number, public y: number) {}
  setDepth(): this { return this; }
  setFrame(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

describe("StaticCrowdRuntime", () => {
  it("contains all public crowd and crowd_up regions with source identities", () => {
    expect(STATIC_CROWD_REGIONS).toHaveLength(46);
    expect(STATIC_CROWD_REGIONS.filter((region) => region.type === "crowd")).toHaveLength(25);
    expect(STATIC_CROWD_REGIONS.filter((region) => region.type === "crowd_up")).toHaveLength(21);
    const station = STATIC_CROWD_REGIONS.find((region) =>
      region.regionIndex === STATION_REGION_INDEX);
    expect(station?.regionIndex).toBe(29);
    expect(station?.outline[0]).toEqual({ x: 1160, y: 264 });
    expect(STATIC_CROWD_REGIONS.find((region) =>
      region.regionIndex === FOOTBALL_REGION_INDEX))
      .toSatisfy((region) =>
        region !== undefined && staticCrowdRequestedCount(region, TUNING) === TUNING.footballCount);
    const stopAiBackground = STATIC_CROWD_REGIONS.find((region) =>
      region.regionIndex === STOP_AI_BACKGROUND_REGION_INDEX);
    expect(stopAiBackground?.type).toBe("crowd_up");
    expect(stopAiBackground && staticCrowdRequestedCount(stopAiBackground, TUNING))
      .toBe(STOP_AI_BACKGROUND_COUNT);
  });

  it("suppresses only explicitly disabled local regions before materialization", () => {
    const region = STATIC_CROWD_REGIONS.find((item) => item.regionIndex === 38)!;
    const runtime = new StaticCrowdRuntime({
      ...CROWD,
      regions: [region],
      disabledRegionIndexes: [38],
    });
    const snapshot = runtime.start({ left: 0, top: 0, width: 2_240, height: 2_240 });
    expect(snapshot.instances).toHaveLength(0);
  });

  it("keeps seeded polygon placements stable and spaced while viewport culling is presentation-only", () => {
    const region = STATIC_CROWD_REGIONS.find((item) =>
      item.regionIndex === STATION_REGION_INDEX)!;
    const values = [.2, .5, .7, .1, .8, .4, .4, .7, .6, .3, .1, .8];
    const first = new StaticCrowdRuntime({
      ...CROWD,
      regions: [region],
      random: seeded(values),
      tuning: { ...TUNING, viewportMargin: 0 },
    });
    const second = new StaticCrowdRuntime({
      ...CROWD,
      regions: [region],
      random: seeded(values),
      tuning: { ...TUNING, viewportMargin: 0 },
    });
    first.start({ left: 0, top: 0, width: 2_240, height: 2_240 });
    second.start({ left: 0, top: 0, width: 2_240, height: 2_240 });
    expect(first.snapshot.instances).toEqual(second.snapshot.instances);
    for (const instance of first.snapshot.instances) {
      expect(instance.materialized).toBe(true);
      expect(instance.position.x).toBeGreaterThanOrEqual(1144);
      expect(instance.position.x).toBeLessThanOrEqual(1352);
    }
    for (let left = 0; left < first.snapshot.instances.length; left += 1) {
      for (let right = left + 1; right < first.snapshot.instances.length; right += 1) {
        const a = first.snapshot.instances[left]!.position;
        const b = first.snapshot.instances[right]!.position;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(STATIC_CROWD_MIN_SPACING);
      }
    }
    const original = first.snapshot.instances.map((item) => item.position);
    first.tick({ left: 1140, top: 260, width: 10, height: 10 });
    expect(first.snapshot.instances.every((item) => item.materialized)).toBe(true);
    first.tick({ left: 1035, top: 260, width: 10, height: 10 });
    expect(first.snapshot.instances.every((item) => item.materialized)).toBe(true);
    first.tick({ left: 0, top: 0, width: 10, height: 10 });
    expect(first.snapshot.instances.every((item) => !item.materialized)).toBe(true);
    expect(first.snapshot.instances.map((item) => item.position)).toEqual(original);
  });

  it("applies 56px spacing to the exact coffee region pair", () => {
    const region = probeRegion;
    const values = [
      .2, .5, .5, .5,
      .999, .999, .999, .999,
      .2, .5, .8, .5, .5, .5,
      .999, .999, .999, .999,
      .2, .5, .5, .5,
      .999, .999, .999, .999,
    ];
    const snapshot = new StaticCrowdRuntime({
      ...CROWD,
      regions: [region(38, 0), region(61, 20), region(62, 20)],
      // 这里要验的正是那两块被关掉的区域之间那套更大间距，所以先放开它们。
      disabledRegionIndexes: [],
      random: seeded(values),
      tuning: {
        ...TUNING,
        viewportMargin: 0,
        maxPlacementAttemptsPerInstance: 2,
      },
    }).start({ left: -100, top: -100, width: 300, height: 300 });
    const positionsByRegion = new Map<number, StaticCrowdPoint[]>();
    for (const item of snapshot.instances) {
      const positions = positionsByRegion.get(item.regionIndex) ?? [];
      positions.push(item.position);
      positionsByRegion.set(item.regionIndex, positions);
    }
    const positions38 = positionsByRegion.get(38) ?? [];
    const positions61 = positionsByRegion.get(61) ?? [];
    const positions62 = positionsByRegion.get(62) ?? [];
    expect(positions38.length).toBeGreaterThan(0);
    expect(positions61.length).toBeGreaterThan(0);
    expect(positions62.length).toBeGreaterThan(0);

    for (const first of positions38) {
      for (const second of positions61) {
        expect(Math.hypot(first.x - second.x, first.y - second.y))
          .toBeGreaterThanOrEqual(COFFEE_STATIC_MIN_SPACING);
      }
    }
    expect(positions38.some((first) => positions62.some((second) =>
      Math.hypot(first.x - second.x, first.y - second.y) < 32,
    ))).toBe(true);

    for (const [positions, minimum] of [
      [positions38, COFFEE_STATIC_MIN_SPACING],
      [positions61, COFFEE_STATIC_MIN_SPACING],
      [positions62, STATIC_CROWD_MIN_SPACING],
    ] as const) {
      for (let left = 0; left < positions.length; left += 1) {
        for (let right = left + 1; right < positions.length; right += 1) {
          expect(Math.hypot(
            positions[left]!.x - positions[right]!.x,
            positions[left]!.y - positions[right]!.y,
          )).toBeGreaterThanOrEqual(minimum);
        }
      }
    }
  });

  it("takes the football head count from the config, not from a literal", () => {
    const football = STATIC_CROWD_REGIONS.find((item) =>
      item.regionIndex === FOOTBALL_REGION_INDEX)!;
    for (const footballCount of [3, 10, 25]) {
      expect(staticCrowdRequestedCount(football, { ...TUNING, footballCount })).toBe(footballCount);
    }
  });

  it("tells the football regions apart by index, not by name", () => {
    // 这个探针区域没有 id——原版是按 id 认的，这里必须认不出来才对。
    const ordinary = probeRegion(51, 0);
    const configured = { ...TUNING, footballRegionIndexes: [51], footballCount: 7 };
    expect(staticCrowdRequestedCount(ordinary, configured)).toBe(7);

    // 把名单换成别的序号，51 就退回按面积算人口了。
    const moved = { ...TUNING, footballRegionIndexes: [53], footballCount: 7 };
    expect(staticCrowdRequestedCount(ordinary, moved)).not.toBe(7);
    expect(staticCrowdRequestedCount(ordinary, moved))
      .toBe(Math.max(5, Math.floor(80 * 16 * TUNING.factor)));
  });

  it("takes which regions are the beach crowd from the config", () => {
    // 三组贴图的池子都换成一眼能认出来的假 key。
    const spritePools = {
      ...CONFIGS.staticCrowdSpritePools,
      beach: ["beach-only"],
      football: ["football-only"],
      ordinary: ["ordinary-only"],
    };
    const run = (tuning: typeof TUNING) => new StaticCrowdRuntime({
      ...CROWD,
      spritePools,
      regions: [probeRegion(52, 0), probeRegion(60, 0)],
      disabledRegionIndexes: [],
      random: seeded([.2, .5, .5, .5, .999, .999, .2, .5, .5, .5, .999, .999]),
      tuning: { ...tuning, viewportMargin: 0, maxPlacementAttemptsPerInstance: 1 },
    }).start({ left: -100, top: -100, width: 300, height: 300 });

    const spritesOf = (
      snapshot: ReturnType<StaticCrowdRuntime["start"]>,
      regionIndex: number,
    ) => snapshot.instances
      .filter((item) => item.regionIndex === regionIndex)
      .map((item) => item.spriteKey);

    // 名单写着 [52] 时，只有 52 用沙滩那组贴图。
    const configured = run({ ...TUNING, beachRegionIndexes: [52] });
    expect(spritesOf(configured, 52)).toEqual(["beach-only"]);
    expect(spritesOf(configured, 60)).toEqual(["ordinary-only"]);

    // 名单换成 [60]，沙滩贴图就跟到 60 去了——52 不再是沙滩。
    const moved = run({ ...TUNING, beachRegionIndexes: [60] });
    expect(spritesOf(moved, 60)).toEqual(["beach-only"]);
    expect(spritesOf(moved, 52)).toEqual(["ordinary-only"]);
  });

  it("takes which regions face away from north from the config", () => {
    // 每放一个人要抽四次随机数：横坐标、纵坐标、贴图、朝向。下面这串数
    // 让第一个人落在 (40, 8) 上（在区域内），它的**朝向**抽到 .3。
    const directions = (stationRegionIndexes: readonly number[]) => {
      const runtime = new StaticCrowdRuntime({
        ...CROWD,
        regions: [probeRegion(29, 0)],
        disabledRegionIndexes: [],
        random: seeded([.5, .5, .5, .3]),
        tuning: { ...TUNING, stationRegionIndexes, viewportMargin: 0 },
      });
      return runtime.start({ left: -100, top: -100, width: 300, height: 300 })
        .instances.map((item) => item.direction);
    };

    // 普通区域有八个朝向，.3 × 8 落在第 2 个——「北」。
    expect(directions([])).toEqual(["north"]);
    // 名单里有 29，就换成车站那五个朝向，.3 × 5 落在第 1 个——「东南」。
    expect(directions([29])).toEqual(["south-east"]);
    // 换成别的序号，29 又变回普通区域。
    expect(directions([30])).toEqual(["north"]);
  });

  it("takes which regions are the coffee pair from the config", () => {
    const values = [
      .2, .5, .5, .5, .999, .999, .999, .999,
      .2, .5, .8, .5, .5, .5, .999, .999, .999, .999,
      .2, .5, .5, .5, .999, .999, .999, .999,
    ];
    const run = (coffeeRegionIndexes: readonly number[]) => {
      const snapshot = new StaticCrowdRuntime({
        ...CROWD,
        regions: [probeRegion(38, 0), probeRegion(61, 20), probeRegion(62, 20)],
        disabledRegionIndexes: [],
        random: seeded(values),
        tuning: {
          ...TUNING,
          coffeeRegionIndexes,
          viewportMargin: 0,
          maxPlacementAttemptsPerInstance: 2,
        },
      }).start({ left: -100, top: -100, width: 300, height: 300 });
      return (regionIndex: number) => snapshot.instances
        .filter((item) => item.regionIndex === regionIndex)
        .map((item) => item.position);
    };

    // 名单是 [38, 61] 时，隔开 56 像素的是 38 与 61 这一对。
    const configured = run([38, 61]);
    for (const first of configured(38)) {
      for (const second of configured(61)) {
        expect(Math.hypot(first.x - second.x, first.y - second.y))
          .toBeGreaterThanOrEqual(COFFEE_STATIC_MIN_SPACING);
      }
    }

    // 把名单换成 [61, 62]，隔开的就变成 61 与 62——38 不再是咖啡座。
    const moved = run([61, 62]);
    for (const first of moved(61)) {
      for (const second of moved(62)) {
        expect(Math.hypot(first.x - second.x, first.y - second.y))
          .toBeGreaterThanOrEqual(COFFEE_STATIC_MIN_SPACING);
      }
    }
  });

  it("reads the extra margin for regions already on screen from the config", () => {
    const values = [.2, .5, .5, .5, .999, .999, .999, .999];
    const settledMaterialized = (activeRegionExtraMargin: number) => {
      const runtime = new StaticCrowdRuntime({
        ...CROWD,
        regions: [probeRegion(38, 0)],
        disabledRegionIndexes: [],
        random: seeded(values),
        tuning: { ...TUNING, viewportMargin: 40, activeRegionExtraMargin },
      });
      runtime.start({ left: 0, top: 0, width: 80, height: 16 });
      // 区域右边缘在 80，视口左边缘挪到 200——中间空出 120 像素。
      // 这个距离落在「40 + extra」的两侧：extra 小就够不着，extra 大就还够得着。
      runtime.tick({ left: 200, top: 0, width: 80, height: 16 });
      return runtime.snapshot.instances.every((item) => item.materialized);
    };

    expect(settledMaterialized(200)).toBe(true);
    expect(settledMaterialized(0)).toBe(false);
  });

  it("keeps visible sprite identity through core culling and culls only when offscreen", () => {
    let viewport: { left: number; top: number; width: number; height: number } | undefined = {
      left: 0, top: 0, width: 2240, height: 2240,
    };
    const sprites: Sprite[] = [];
    const runtime = new PhaserStaticCrowdRuntime({
      add: { sprite: (x, y) => { const sprite = new Sprite(x, y); sprites.push(sprite); return sprite; } },
      textures: { exists: () => true },
    }, { viewport: () => viewport, crowd: CROWD, presentation: PRESENTATION, trackBand: TRACK_BAND });

    expect(runtime.start()).toBe(true);
    const materializedCount = runtime.snapshot.instances
      .filter((instance) => instance.materialized).length;
    expect(materializedCount).toBeGreaterThan(16);
    expect(runtime.spriteCount).toBe(materializedCount);
    const retained = sprites[0]!;

    viewport = undefined;
    runtime.update(0);
    expect(retained.destroyed).toBe(false);
    expect(sprites[0]).toBe(retained);

    viewport = {
      left: retained.x - 5, top: retained.y - 5, width: 10, height: 10,
    };
    runtime.update(1_000);
    expect(retained.destroyed).toBe(false);
    expect(sprites[0]).toBe(retained);

    viewport = { left: 10_000, top: 10_000, width: 10, height: 10 };
    runtime.update(2_000);
    expect(retained.destroyed).toBe(true);
  });

  it("铁轨带是按递进来的那份算的，不是写死的", () => {
    // 真配置里那条带子。
    expect(TRACK_BAND).toEqual({ minX: 400, maxX: 1471, minY: 304, maxY: 319 });
    const narrow = { minX: 0, maxX: 100, minY: 0, maxY: 10 };
    // 带子中线上方推到 minY-1，下方推到 maxY+1，带子外面原样不动。
    expect(keepStaticCrowdOffTrack(50, 4, narrow)).toEqual({ x: 50, y: -1 });
    expect(keepStaticCrowdOffTrack(50, 5, narrow)).toEqual({ x: 50, y: 11 });
    expect(keepStaticCrowdOffTrack(500, 5, narrow)).toEqual({ x: 500, y: 5 });
    // 同一个点：换成真配置那条带子，它不在带里，所以不动。
    expect(keepStaticCrowdOffTrack(50, 5, TRACK_BAND)).toEqual({ x: 50, y: 5 });
  });

  it("每帧最多新建几个是按递进来的那份算的，不是写死的 16", () => {
    // 视口开在很远的地方、准备边距开得极大：人和区域都「准备好了」，但没一个落在
    // 屏幕上。于是「已经在屏幕上的区域」是空的——上限严格生效，一次新建出来的
    // 正好是上限那么多。区域判定半宽之外的预准备，不构成绕过上限的理由。
    const build = (maxCreatePerSync: number) => {
      const sprites: Sprite[] = [];
      const runtime = new PhaserStaticCrowdRuntime({
        add: { sprite: (x, y) => { const sprite = new Sprite(x, y); sprites.push(sprite); return sprite; } },
        textures: { exists: () => true },
      }, {
        viewport: () => ({ left: 10_000, top: 10_000, width: 10, height: 10 }),
        crowd: { ...CROWD, tuning: { ...TUNING, viewportMargin: 100_000 } },
        presentation: { ...PRESENTATION, maxCreatePerSync },
        trackBand: TRACK_BAND,
      });
      runtime.start();
      return runtime.spriteCount;
    };

    expect(PRESENTATION.maxCreatePerSync).toBe(16);
    expect(build(0)).toBe(0);
    expect(build(6)).toBe(6);
    expect(build(16)).toBe(16);
    // 备好的远不止 16 个——说明确实是在卡上限，而不是「本来就只建得出 16 个」。
    expect(build(1_000)).toBeGreaterThan(16);
  });
});

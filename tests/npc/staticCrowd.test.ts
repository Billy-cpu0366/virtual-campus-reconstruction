import { describe, expect, it } from "vitest";

import {
  STATIC_CROWD_REGIONS,
  STATIC_CROWD_MIN_SPACING,
  StaticCrowdRuntime,
  staticCrowdRequestedCount,
  type StaticCrowdPoint,
  type StaticCrowdRegion,
} from "../../src/npc/index.js";
import { PhaserStaticCrowdRuntime } from "../../game/PhaserStaticCrowdRuntime.js";

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
    const station = STATIC_CROWD_REGIONS.find((region) => region.id === "station_static_crowd");
    expect(station?.regionIndex).toBe(29);
    expect(station?.outline[0]).toEqual({ x: 1160, y: 264 });
    expect(STATIC_CROWD_REGIONS.find((region) => region.id === "football_team_blue"))
      .toSatisfy((region) => region !== undefined && staticCrowdRequestedCount(region) === 10);
  });

  it("keeps seeded polygon placements stable and spaced while viewport culling is presentation-only", () => {
    const region = STATIC_CROWD_REGIONS.find((item) => item.id === "station_static_crowd")!;
    const values = [.2, .5, .7, .1, .8, .4, .4, .7, .6, .3, .1, .8];
    const first = new StaticCrowdRuntime({ regions: [region], random: seeded(values), viewportMargin: 0 });
    const second = new StaticCrowdRuntime({ regions: [region], random: seeded(values), viewportMargin: 0 });
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

  it("applies 32px spacing only to the exact 38/61 region pair", () => {
    const region = (regionIndex: number, left: number): StaticCrowdRegion => ({
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
    });
    const values = [
      .2, .5, .5, .5,
      .999, .999, .999, .999,
      .2, .5, .8, .5, .5, .5,
      .999, .999, .999, .999,
      .2, .5, .5, .5,
      .999, .999, .999, .999,
    ];
    const snapshot = new StaticCrowdRuntime({
      regions: [region(38, 0), region(61, 20), region(62, 20)],
      random: seeded(values),
      viewportMargin: 0,
      maxPlacementAttemptsPerInstance: 2,
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
          .toBeGreaterThanOrEqual(32);
      }
    }
    expect(positions38.some((first) => positions62.some((second) =>
      Math.hypot(first.x - second.x, first.y - second.y) < 32,
    ))).toBe(true);

    for (const positions of [positions38, positions61, positions62]) {
      for (let left = 0; left < positions.length; left += 1) {
        for (let right = left + 1; right < positions.length; right += 1) {
          expect(Math.hypot(
            positions[left]!.x - positions[right]!.x,
            positions[left]!.y - positions[right]!.y,
          )).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });

  it("keeps visible sprite identity through core culling and culls only when offscreen", () => {
    let viewport: { left: number; top: number; width: number; height: number } | undefined = {
      left: 0, top: 0, width: 2240, height: 2240,
    };
    const sprites: Sprite[] = [];
    const runtime = new PhaserStaticCrowdRuntime({
      add: { sprite: (x, y) => { const sprite = new Sprite(x, y); sprites.push(sprite); return sprite; } },
      textures: { exists: () => true },
    }, { viewport: () => viewport, viewportMargin: 0 });

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
});

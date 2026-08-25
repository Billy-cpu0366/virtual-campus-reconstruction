import { describe, expect, it } from "vitest";

import {
  STATIC_CROWD_REGIONS,
  STATIC_CROWD_MIN_SPACING,
  StaticCrowdRuntime,
  staticCrowdRequestedCount,
} from "../../src/npc/index.js";

function seeded(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length]!;
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
    first.tick({ left: 0, top: 0, width: 10, height: 10 });
    expect(first.snapshot.instances.every((item) => !item.materialized)).toBe(true);
    expect(first.snapshot.instances.map((item) => item.position)).toEqual(original);
  });
});

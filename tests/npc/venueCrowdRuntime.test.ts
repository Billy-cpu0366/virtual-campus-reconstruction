import { describe, expect, it } from "vitest";
import {
  VenueCrowdRuntime,
  type VenueCrowdInstance,
} from "../../src/npc/index.js";

describe("VenueCrowdRuntime", () => {
  it("places populations once and materializes whole regions outside the camera", () => {
    let seed = 1;
    const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
    const crowd = new VenueCrowdRuntime(random);
    crowd.start({ left: 0, top: 0, width: 2240, height: 2240 });
    expect(crowd.snapshot.instances.length).toBeGreaterThan(30);
    expect(crowd.snapshot.instances.length).toBeLessThanOrEqual(490);
    const before = crowd.snapshot.instances.map((item) => item.position);

    crowd.tick({ left: 1320, top: 600, width: 10, height: 10 });
    const byRegion = new Map<string, VenueCrowdInstance[]>();
    for (const item of crowd.snapshot.instances) {
      const items = byRegion.get(item.regionId) ?? [];
      items.push(item);
      byRegion.set(item.regionId, items);
    }
    expect([...byRegion.values()].every((items) =>
      items.every((item) => item.materialized === items[0]!.materialized),
    )).toBe(true);
    expect(crowd.snapshot.instances.some((item) => item.materialized)).toBe(true);
    expect(crowd.snapshot.instances.some((item) => !item.materialized)).toBe(true);

    crowd.tick({ left: 0, top: 0, width: 10, height: 10 });
    expect(crowd.snapshot.instances.every((item) => !item.materialized)).toBe(true);
    expect(crowd.snapshot.instances.map((item) => item.position)).toEqual(before);
  });
});

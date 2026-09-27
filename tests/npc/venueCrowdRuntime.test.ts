import { describe, expect, it } from "vitest";
import {
  VenueCrowdRuntime,
  type VenueCrowdInstance,
  type VenueRegion,
} from "../../src/npc/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";

/** 区域和两个 margin 现在都读磁盘上那份配置——和游戏里读的是同一份。 */
const CONFIGS = await loadNpcConfigs(createDiskConfigSource());

describe("VenueCrowdRuntime", () => {
  it("places populations once and materializes whole regions outside the camera", () => {
    let seed = 1;
    const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
    const crowd = new VenueCrowdRuntime({
      regions: CONFIGS.venueCrowdRegions,
      tuning: CONFIGS.tuning.venueCrowd,
      random,
    });
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

  it("takes how many placement attempts each person gets from the config", () => {
    // 三角形区域：右上半个外接矩形落在区域外。给一串「先落在区域外、再落在区域内」
    // 的随机数，于是「试几次」直接决定这个人放不放得下。
    const region: VenueRegion = {
      id: "probe",
      type: "concert",
      count: 1,
      spacing: 0,
      outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }],
    };
    const placed = (maxPlacementAttempts: number) => {
      let index = 0;
      const values = [0.9, 0.9, 0.1, 0.1];
      return new VenueCrowdRuntime({
        regions: [region],
        tuning: { ...CONFIGS.tuning.venueCrowd, maxPlacementAttempts },
        random: () => values[index++ % values.length]!,
      }).start().instances.length;
    };

    expect(placed(1)).toBe(0);
    expect(placed(2)).toBe(1);
  });
});

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDiskConfigSource, PROJECT_ROOT } from "../../config/工具/config-source-from-disk.js";
import { FX_CONFIG_KEYS, loadFxConfigs } from "../../config/骨架/05-旁支/SYS-FX/逻辑/index.js";

describe("SYS-FX 配置接线", () => {
  it("default 加载六个运行时配置块并保留脚印复用边界", async () => {
    const config = await loadFxConfigs(createDiskConfigSource());
    expect(Object.keys(config)).toEqual([
      "footstep", "factorySmoke", "fog", "stopAiSmoke", "concertLighting", "playerVisual",
    ]);
    expect(config.factorySmoke).toMatchObject({ x: 808, y: 539.2, depth: 500, presentationDepth: 3400 });
    expect(config.fog.polygon).toHaveLength(29);
    expect(config.stopAiSmoke.sites).toHaveLength(3);
    expect(config.stopAiSmoke.layers).toEqual(["back", "main", "front"]);
    expect(config.concertLighting.lasers).toHaveLength(6);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.concertLighting.lasers)).toBe(true);
  });

  it("set1 改动实际烟囱锚点", async () => {
    const set1 = await loadFxConfigs(createDiskConfigSource("config/set1"));
    expect(set1.factorySmoke.x).toBe(880);
  });

  it("拒绝缺字段与重复烟雾站点", async () => {
    const broken = {
      read: async () => ({
        meta: { system: "fx", source: "test", sourceConstant: "fixture", verified: "exact", notes: [] },
        data: {
          factorySmoke: {},
        },
      }),
    } as any;
    await expect(loadFxConfigs(broken)).rejects.toThrow("footstep 缺失");
  });

  it("形状 key、default/set1 文件与运行时来源一致", () => {
    expect(FX_CONFIG_KEYS).toEqual(["05-旁支/SYS-FX/数据/fx-config.json"]);
    for (const set of ["default", "set1"]) {
      const dir = resolve(PROJECT_ROOT, `config/${set}/05-旁支/SYS-FX/数据`);
      expect(readdirSync(dir).filter((file) => file.endsWith(".json"))).toEqual(["fx-config.json"]);
    }
    expect(existsSync(resolve(PROJECT_ROOT, "game/PhaserFactorySmokeRuntime.ts"))).toBe(true);
  });
});

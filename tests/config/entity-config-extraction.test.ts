import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDiskConfigSource,
  PROJECT_ROOT,
} from "../../config/工具/config-source-from-disk.js";
import {
  ENTITY_CLEANUP_STEPS,
  ENTITY_CONFIG_KEYS,
  loadEntityConfigs,
} from "../../config/骨架/04-独立件/SYS-ENTITY/逻辑/index.js";

const source = createDiskConfigSource();
const loaded = await loadEntityConfigs(source);

describe("SYS-ENTITY 配置接线", () => {
  it("default 保留 30 步关停次序", () => {
    expect(loaded.cleanupOrder).toEqual(ENTITY_CLEANUP_STEPS);
    expect(loaded.cleanupOrder).toHaveLength(30);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.cleanupOrder)).toBe(true);
  });

  it("set1 只交换两个互不依赖的 NPC 运行时", async () => {
    const set1 = await loadEntityConfigs(createDiskConfigSource("config/set1"));
    expect(set1.cleanupOrder.indexOf("static-crowd")).toBeLessThan(
      set1.cleanupOrder.indexOf("static-npc"),
    );
    expect(set1.cleanupOrder.filter((step) => step === "static-crowd")).toHaveLength(1);
  });

  it("缺步骤或重复步骤时拒绝整份配置", async () => {
    const brokenSource = {
      read: async () => ({
        meta: { system: "entity", source: "game/CampusScene.ts", sourceConstant: "cleanup", verified: "exact", notes: ["broken fixture"] },
        data: { cleanupOrder: [...loaded.cleanupOrder.slice(0, -1), "static-crowd"] },
      }),
    } as any;
    await expect(loadEntityConfigs(brokenSource)).rejects.toThrow("cleanupOrder 必须完整包含 30 个不同步骤");
  });

  it("形状 key、磁盘目录与来源文件相符", () => {
    const dir = resolve(PROJECT_ROOT, "config/default/04-独立件/SYS-ENTITY/数据");
    expect(ENTITY_CONFIG_KEYS).toEqual(["04-独立件/SYS-ENTITY/数据/entity-config.json"]);
    expect(readdirSync(dir).filter((file) => file.endsWith(".json"))).toEqual(["entity-config.json"]);
    expect(existsSync(resolve(PROJECT_ROOT, "game/CampusScene.ts"))).toBe(true);
  });
});

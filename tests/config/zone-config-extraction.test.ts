import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDiskConfigSource, configSetDirOf, PROJECT_ROOT } from "../../config/工具/config-source-from-disk.js";
import { loadZoneConfigs, ZONE_CONFIG_KEYS } from "../../config/骨架/03-内容线/SYS-ZONE/逻辑/index.js";
import { ZONE_SHAPES } from "../../config/骨架/03-内容线/SYS-ZONE/逻辑/shapes.js";
import { validate } from "../../config/骨架/公共/validate.js";

const key = ZONE_CONFIG_KEYS[0]!;
const source = createDiskConfigSource();
const zone = await loadZoneConfigs(source);

describe("SYS-ZONE 配置抽值与接线", () => {
  it("11 个点和四个阈值等于原实现", () => {
    expect(zone.markers).toHaveLength(11);
    expect(zone.markers[0]).toStrictEqual({ markerId: "about", menuId: "about", x: 944, y: 768 });
    expect(zone.markers.at(-1)).toStrictEqual({ markerId: "memo6", menuId: "memo6", x: 496, y: 176 });
    expect({ interactionDistance: zone.interactionDistance, intervalMs: zone.intervalMs,
      viewportPadding: zone.viewportPadding, contentUpdateIntervalMs: zone.contentUpdateIntervalMs })
      .toStrictEqual({ interactionDistance: 30, intervalMs: 100,
        viewportPadding: 100, contentUpdateIntervalMs: 100 });
  });

  it("两套文件齐全，set1 移动 MEMO6 标记", async () => {
    for (const set of ["default", "set1"]) {
      expect(readdirSync(resolve(configSetDirOf(set), "03-内容线/SYS-ZONE/数据")))
        .toStrictEqual(["zone-config.json"]);
    }
    const set1 = await loadZoneConfigs(createDiskConfigSource(configSetDirOf("set1")));
    expect(set1.markers.at(-1)?.x).toBe(560);
    expect(Object.isFrozen(zone)).toBe(true);
    expect(Object.isFrozen(zone.markers[0])).toBe(true);
  });

  it("meta 和字段单位能回溯到源码", async () => {
    const file = await source.read(key);
    expect(file.meta.verified).toBe("exact");
    expect(file.meta.notes?.length).toBeGreaterThan(0);
    for (const path of file.meta.source.split("; ")) expect(existsSync(resolve(PROJECT_ROOT, path))).toBe(true);
    const fields = ZONE_SHAPES[key].fields as unknown as Record<string, { readonly unit?: string }>;
    for (const [field, unit] of Object.entries(file.meta.units ?? {})) {
      expect(fields[field]?.unit).toBe(unit);
    }
    expect(ZONE_CONFIG_KEYS).toStrictEqual([key]);
  });

  it("坏字段、未知内容 ID、越界坐标及重复点被拦住", async () => {
    const shape = ZONE_SHAPES[key];
    expect(() => validate(key, shape, { ...zone, intervalMs: undefined })).toThrow();
    expect(() => validate(key, shape, { ...zone, added: 1 })).toThrow();
    expect(() => validate(key, shape, { ...zone, markers: [{ ...zone.markers[0], menuId: "wrong" }] })).toThrow();
    expect(() => validate(key, shape, { ...zone, markers: [{ ...zone.markers[0], x: 3000 }] })).toThrow();
    const duplicate = { ...zone, markers: [zone.markers[0], zone.markers[0]] };
    const duplicateSource = { read: async () => ({ meta: (await source.read(key)).meta, data: duplicate }) };
    await expect(loadZoneConfigs(duplicateSource)).rejects.toThrow("重复");
  });
});

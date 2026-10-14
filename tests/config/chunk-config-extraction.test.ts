import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDiskConfigSource, configSetDirOf, PROJECT_ROOT } from "../../config/工具/config-source-from-disk.js";
import { loadChunkConfigs, CHUNK_CONFIG_KEYS } from "../../config/骨架/01-地图线/SYS-CHUNK/逻辑/index.js";
import { CHUNK_SHAPES } from "../../config/骨架/01-地图线/SYS-CHUNK/逻辑/shapes.js";
import { validate } from "../../config/骨架/公共/validate.js";

const key = CHUNK_CONFIG_KEYS[0]!;
const source = createDiskConfigSource();
const config = await loadChunkConfigs(source);

describe("SYS-CHUNK 配置抽值与接线", () => {
  it("四个旧值逐项等于原实现", () => {
    expect(config).toStrictEqual({
      updateIntervalMs: 500,
      playerNeighborhoodRadius: 1,
      cameraPadding: 1,
      maxAttempts: 3,
    });
  });

  it("读取后深层冻结，set1 有独立可见差异", async () => {
    expect(Object.isFrozen(config)).toBe(true);
    const set1 = await loadChunkConfigs(createDiskConfigSource(configSetDirOf("set1")));
    expect(set1.cameraPadding).toBe(2);
  });

  it("meta 有真实来源与说明，单位和形状一致", async () => {
    const file = await source.read(key);
    expect(file.meta.verified).toBe("exact");
    expect(file.meta.notes?.length).toBeGreaterThan(0);
    for (const sourcePath of file.meta.source.split("; ")) {
      expect(existsSync(resolve(PROJECT_ROOT, sourcePath))).toBe(true);
    }
    const fields = CHUNK_SHAPES[key].fields;
    for (const [name, unit] of Object.entries(file.meta.units ?? {})) {
      expect(fields[name as keyof typeof fields]?.unit).toBe(unit);
    }
  });

  it("文件清单与加载器相同，两套都齐全", () => {
    for (const set of ["default", "set1"]) {
      const dir = resolve(configSetDirOf(set), "01-地图线/SYS-CHUNK/数据");
      expect(readdirSync(dir).filter((name) => name.endsWith(".json"))).toStrictEqual(["chunk-config.json"]);
      const raw = JSON.parse(readFileSync(resolve(dir, "chunk-config.json"), "utf8"));
      expect(raw.data).toBeDefined();
    }
    expect(CHUNK_CONFIG_KEYS).toStrictEqual(["01-地图线/SYS-CHUNK/数据/chunk-config.json"]);
  });

  it("缺字段、多字段、错误类型、超范围和非有限数均拒绝", () => {
    const shape = CHUNK_SHAPES[key];
    const base = { ...config };
    expect(() => validate(key, shape, { ...base, maxAttempts: undefined })).toThrow();
    expect(() => validate(key, shape, { ...base, invented: 2 })).toThrow();
    expect(() => validate(key, shape, { ...base, cameraPadding: "one" })).toThrow();
    expect(() => validate(key, shape, { ...base, updateIntervalMs: -1 })).toThrow();
    expect(() => validate(key, shape, { ...base, cameraPadding: Number.NaN })).toThrow();
  });
});

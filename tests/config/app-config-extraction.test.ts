import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDiskConfigSource, PROJECT_ROOT } from "../../config/工具/config-source-from-disk.js";
import { APP_CONFIG_KEYS, loadAppConfigs } from "../../config/骨架/04-独立件/SYS-APP/逻辑/index.js";

describe("SYS-APP 配置接线", () => {
  it("读取启动视口、物理参数和错误详情策略", async () => {
    const config = await loadAppConfigs(createDiskConfigSource());
    expect(config.logicalWidth).toBe(480);
    expect(config.logicalHeight).toBe(270);
    expect(config.physicsGravity).toEqual({ x: 0, y: 0 });
    expect(config.showErrorDetail).toBe(true);
    expect(Object.isFrozen(config.physicsGravity)).toBe(true);
  });

  it("set1 调整逻辑视口宽度", async () => {
    const config = await loadAppConfigs(createDiskConfigSource("config/set1"));
    expect(config.logicalWidth).toBe(540);
  });

  it("形状 key、磁盘目录与来源文件相符", () => {
    const dir = resolve(PROJECT_ROOT, "config/default/04-独立件/SYS-APP/数据");
    expect(APP_CONFIG_KEYS).toEqual(["04-独立件/SYS-APP/数据/app-config.json"]);
    expect(readdirSync(dir).filter((file) => file.endsWith(".json"))).toEqual(["app-config.json"]);
    expect(existsSync(resolve(PROJECT_ROOT, "game/main.ts"))).toBe(true);
  });
});

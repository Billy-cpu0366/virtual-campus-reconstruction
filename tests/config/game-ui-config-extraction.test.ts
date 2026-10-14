import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDiskConfigSource, PROJECT_ROOT } from "../../config/工具/config-source-from-disk.js";
import { GAME_UI_CONFIG_KEYS, loadGameUiConfigs } from "../../config/骨架/04-独立件/SYS-GAME-UI/逻辑/index.js";

describe("SYS-GAME-UI 配置接线", () => {
  it("读取响应式断点、焦点外框和页面边距", async () => {
    const config = await loadGameUiConfigs(createDiskConfigSource());
    expect(config).toEqual({
      breakpoint: { mobile: 767 },
      focusRing: "3px solid #0b57d0",
      rootPadding: { desktop: "24px", mobile: "16px" },
    });
    expect(Object.isFrozen(config.rootPadding)).toBe(true);
  });

  it("set1 调整桌面边距", async () => {
    const config = await loadGameUiConfigs(createDiskConfigSource("config/set1"));
    expect(config.rootPadding.desktop).toBe("32px");
  });

  it("形状 key、磁盘目录与来源文件相符", () => {
    const dir = resolve(PROJECT_ROOT, "config/default/04-独立件/SYS-GAME-UI/数据");
    expect(GAME_UI_CONFIG_KEYS).toEqual(["04-独立件/SYS-GAME-UI/数据/game-ui-config.json"]);
    expect(readdirSync(dir).filter((file) => file.endsWith(".json"))).toEqual(["game-ui-config.json"]);
    expect(existsSync(resolve(PROJECT_ROOT, "src/game-ui/app-shell.ts"))).toBe(true);
  });
});

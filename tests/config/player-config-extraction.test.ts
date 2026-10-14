import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadPlayerConfigs } from "../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";

describe("SYS-PLAYER 配置接线", () => {
  it("出生点、精灵帧布局、动作贴图与沙滩换装参数来自配置", async () => {
    const player = await loadPlayerConfigs(createDiskConfigSource());
    expect(player.spawn).toEqual({ x: 1088, y: 304 });
    expect(player.spritesheet).toEqual({ frameSize: { width: 48, height: 48 }, frames: 64 });
    expect(player.animation.walkFrameStart.south).toBe(48);
    expect(player.idleFrame).toBe(48);
    expect(player.beach.idleFrame).toBe(48);
    expect(player.idle.textures).toHaveLength(4);
    expect(player.clothing.frameRange).toEqual({ start: 0, end: 13 });
    expect(player.clothing.assetFrames.endFrame).toBe(15);
    expect(player.clothing.cooldownMs).toBe(1000);
    expect(player.beachTriggerGid).toBe(69353);
  });

  it("set1 的玩家显示尺寸采用该套配置值", async () => {
    const player = await loadPlayerConfigs(createDiskConfigSource("config/set1"));
    expect(player.displaySize).toBe(56);
  });
});

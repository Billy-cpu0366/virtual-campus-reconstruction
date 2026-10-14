import { describe, expect, it } from "vitest";

import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadMoveConfigs } from "../../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js";

describe("玩家碰撞体常量", () => {
  it("20×8 贴脚、偏移 (14,36)", async () => {
    const move = await loadMoveConfigs(createDiskConfigSource());
    expect(move.body.width).toBe(20);
    expect(move.body.height).toBe(8);
    expect((48 - move.body.width) / 2).toBe(14);
    expect(48 - move.body.height - 4).toBe(36);
  });

  it("drag / maxVelocity / collideWorldBounds", async () => {
    const move = await loadMoveConfigs(createDiskConfigSource());
    expect(move.drag).toBe(300);
    expect(move.maxVelocity).toBe(200);
    expect(move.collideWorldBounds).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadMoveConfigs } from "../../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js";

const defaultSource = createDiskConfigSource();
const set1Source = createDiskConfigSource("config/set1");

describe("SYS-MOVE 配置接线", () => {
  it("原版数值来自 default 文件", async () => {
    const move = await loadMoveConfigs(defaultSource);
    expect(move.body).toEqual({ width: 20, height: 8 });
    expect(move.drag).toBe(300);
    expect(move.collisionLayerNames).toHaveLength(5);
    expect(move.walkableValue).toBe(0);
    expect(move.blockedValue).toBe(1);
  });
  it("set1 的减速更慢", async () => {
    expect((await loadMoveConfigs(set1Source)).drag).toBe(180);
  });
});

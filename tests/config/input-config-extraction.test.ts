import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadInputConfigs } from "../../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js";

describe("SYS-INPUT 配置接线", () => {
  it("原版速度、方向、键位和摇杆参数来自配置", async () => {
    const input = await loadInputConfigs(createDiskConfigSource());
    expect(input.speed).toEqual({ walk: 150, diagonal: 106 });
    expect(input.directions).toHaveLength(8);
    expect(input.vectors["north-east"]).toEqual({ dx: 1, dy: -1 });
    expect(input.keyboard.mapping.KeyW).toBe("up");
    expect(input.joystick.device.tablet.radius).toBe(12);
    expect(input.desktop.joystickVisible).toBe(false);
  });
  it("set1 的直走速度变为 170", async () => {
    const input = await loadInputConfigs(createDiskConfigSource("config/set1"));
    expect(input.speed.walk).toBe(170);
  });
});

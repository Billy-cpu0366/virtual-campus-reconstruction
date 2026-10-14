import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadCameraConfigs } from "../../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js";

describe("SYS-CAMERA 配置接线", () => {
  it("默认相机跟随、开场航拍与结束缓动来自配置", async () => {
    const camera = await loadCameraConfigs(createDiskConfigSource());
    expect(camera.settings).toEqual({
      zoom: 1,
      lerpX: 1,
      lerpY: 1,
      followOffsetX: 0,
      followOffsetY: 0,
      deadzoneX: 0,
      deadzoneY: 0,
      roundPixels: true,
    });
    expect(camera.sequence).toHaveLength(6);
    expect(camera.sequence[0]).toEqual({ x: 944, y: 928, duration: 0, stayDuration: 7000 });
    expect(camera.returnDuration).toBe(3000);
    expect(camera.pointEase).toBe("Linear");
    expect(camera.returnEase).toBe("Power2");
  });

  it("set1 使用更近的相机缩放", async () => {
    const camera = await loadCameraConfigs(createDiskConfigSource("config/set1"));
    expect(camera.settings.zoom).toBe(1.2);
  });
});

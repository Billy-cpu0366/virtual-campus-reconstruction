import { describe, expect, it } from "vitest";

import {
  PHYSICS_FIXED_DELTA,
  PHYSICS_FPS,
} from "../../src/camera/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadCameraConfigs } from "../../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js";

const CAMERA = await loadCameraConfigs(createDiskConfigSource());

describe("相机基本参数", () => {
  it("从配置读取缩放、跟随、偏移、死区与像素取整", () => {
    expect(CAMERA.settings).toEqual({
      zoom: 1,
      lerpX: 1,
      lerpY: 1,
      followOffsetX: 0,
      followOffsetY: 0,
      deadzoneX: 0,
      deadzoneY: 0,
      roundPixels: true,
    });
  });

  it("物理 30 FPS 固定步长由应用板块维护", () => {
    expect(PHYSICS_FPS).toBe(30);
    expect(PHYSICS_FIXED_DELTA).toBe(true);
  });
});

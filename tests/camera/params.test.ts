import { describe, expect, it } from "vitest";

import {
  CAMERA_BOUNDS,
  CAMERA_ZOOM,
  DEADZONE_X,
  DEADZONE_Y,
  FOLLOW_LERP,
  FOLLOW_OFFSET_X,
  FOLLOW_OFFSET_Y,
  PHYSICS_FIXED_DELTA,
  PHYSICS_FPS,
  ROUND_PIXELS,
} from "../../src/camera/index.js";

describe("相机基本参数", () => {
  it("边界 2240×2240、缩放 1（不缩放）", () => {
    expect(CAMERA_BOUNDS).toEqual({ x: 0, y: 0, width: 2240, height: 2240 });
    expect(CAMERA_ZOOM).toBe(1);
  });

  it("硬跟随 lerp=1、偏移与死区均为 0", () => {
    expect(FOLLOW_LERP).toBe(1);
    expect(FOLLOW_OFFSET_X).toBe(0);
    expect(FOLLOW_OFFSET_Y).toBe(0);
    expect(DEADZONE_X).toBe(0);
    expect(DEADZONE_Y).toBe(0);
  });

  it("roundPixels 开、物理 30 FPS 固定步长", () => {
    expect(ROUND_PIXELS).toBe(true);
    expect(PHYSICS_FPS).toBe(30);
    expect(PHYSICS_FIXED_DELTA).toBe(true);
  });
});

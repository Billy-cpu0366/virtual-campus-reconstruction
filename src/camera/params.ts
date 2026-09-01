import type { CameraBounds } from "./contract.js";

// 相机边界。
export const CAMERA_BOUNDS: CameraBounds = {
  x: 0,
  y: 0,
  width: 2240,
  height: 2240,
};

// 缩放。
export const CAMERA_ZOOM = 1;

// 跟随。
export const FOLLOW_LERP = 1;
export const FOLLOW_OFFSET_X = 0;
export const FOLLOW_OFFSET_Y = 0;
export const DEADZONE_X = 0;
export const DEADZONE_Y = 0;

// 像素取整 + 物理帧率。
export const ROUND_PIXELS = true;
export const PHYSICS_FPS = 30;
export const PHYSICS_FIXED_DELTA = true;

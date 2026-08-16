import type { CameraBounds } from "./contract.js";

// 相机边界（FACT：setBounds(0,0,2240,2240)；2240 = 140 格 × 16px）。
export const CAMERA_BOUNDS: CameraBounds = {
  x: 0,
  y: 0,
  width: 2240,
  height: 2240,
};

// 缩放（FACT：setZoom(1)，全程无缩放）。
export const CAMERA_ZOOM = 1;

// 跟随（FACT：startFollow(player,true,1,1)，lerp=1 硬跟随，无平滑）。
export const FOLLOW_LERP = 1;
export const FOLLOW_OFFSET_X = 0;
export const FOLLOW_OFFSET_Y = 0;
export const DEADZONE_X = 0;
export const DEADZONE_Y = 0;

// 像素取整 + 物理帧率（FACT：roundPixels=true；physics 30 FPS fixedDelta）。
export const ROUND_PIXELS = true;
export const PHYSICS_FPS = 30;
export const PHYSICS_FIXED_DELTA = true;

import type { CameraPoint } from "./contract.js";

// 开场航拍 6 点序列（FACT：cameraSequence 字段 @333500；坐标 = 16 × 格坐标）。
export const CAMERA_SEQUENCE: readonly CameraPoint[] = [
  { x: 944, y: 928, duration: 0, stayDuration: 7000 }, // (59, 58)
  { x: 1552, y: 1216, duration: 15000, stayDuration: 7000 }, // (97, 76)
  { x: 912, y: 1136, duration: 15000, stayDuration: 5000 }, // (57, 71)
  { x: 1216, y: 656, duration: 15000, stayDuration: 5000 }, // (76, 41)
  { x: 2048, y: 2048, duration: 15000, stayDuration: 7000 }, // (128, 128)
  { x: 944, y: 928, duration: 15000, stayDuration: 5000 }, // (59, 58)
];

// 航拍总时长 = Σ(飞到耗时 + 停留)，≈ 111 秒（FACT：7+22+20+20+22+20 秒）。
export function cameraSequenceTotalDuration(
  sequence: readonly CameraPoint[],
): number {
  return sequence.reduce(
    (total, point) => total + point.duration + point.stayDuration,
    0,
  );
}

// 航拍结束落回玩家（FACT：tween scrollX/Y duration 3000、ease Power2）。
export const CAMERA_END_TWEEN_DURATION_MS = 3000;
export const CAMERA_END_TWEEN_EASE = "Power2";

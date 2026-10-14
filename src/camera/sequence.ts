import type { CameraPoint } from "./contract.js";

// 航拍总时长 = Σ(飞到耗时 + 停留)，≈ 111 秒。
export function cameraSequenceTotalDuration(
  sequence: readonly CameraPoint[],
): number {
  return sequence.reduce(
    (total, point) => total + point.duration + point.stayDuration,
    0,
  );
}


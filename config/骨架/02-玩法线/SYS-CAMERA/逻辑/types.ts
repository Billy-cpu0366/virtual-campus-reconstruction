import type { CameraPoint, CameraRuntimeCameraSettings } from "../../../../../src/camera/contract.js";

export interface CameraConfigs {
  readonly settings: CameraRuntimeCameraSettings;
  readonly sequence: readonly CameraPoint[];
  readonly pointEase: string;
  readonly returnDuration: number;
  readonly returnEase: string;
}

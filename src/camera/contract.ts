// SYS-CAMERA 确定性 CORE 的公共类型。

export type CameraPoint = {
  readonly x: number; // 相机中心世界坐标，不是 scrollX
  readonly y: number; // 相机中心世界坐标，不是 scrollY
  readonly duration: number; // 飞到该点耗时（ms）
  readonly stayDuration: number; // 到达后停留（ms）
};

export type CameraBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type CameraPosition = {
  readonly x: number;
  readonly y: number;
};

export type CameraViewport = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
};

export type CameraRuntimeCameraSettings = {
  readonly zoom: number;
  readonly lerpX: number;
  readonly lerpY: number;
  readonly followOffsetX: number;
  readonly followOffsetY: number;
  readonly deadzoneX: number;
  readonly deadzoneY: number;
  readonly roundPixels: boolean;
};

export interface CameraRuntimeCallbacks {
  readonly disableControls: () => void;
  readonly enableControls: () => void;
  readonly stopFollow: () => void;
  readonly startHardFollow: (
    settings: CameraRuntimeCameraSettings,
  ) => void;
  readonly installEffects?: () => void;
  readonly getViewport: () => CameraViewport;
  readonly outputViewport: (viewport: CameraViewport) => void;
  readonly getPlayerPosition: () => CameraPosition;
  readonly restoreCameraSettings: (
    settings: CameraRuntimeCameraSettings,
  ) => void;
}

export interface CameraRuntimeTimer {
  cancel(): void;
}

export interface CameraRuntimeTween {
  cancel(): void;
}

export interface CameraRuntimeTweenOptions {
  readonly ease?: string;
}

export interface CameraRuntimeDriver {
  delay(duration: number, callback: () => void): CameraRuntimeTimer;
  tween(
    from: CameraPosition,
    to: CameraPosition,
    duration: number,
    onUpdate: (position: CameraPosition) => void,
    onComplete: () => void,
    options?: CameraRuntimeTweenOptions,
  ): CameraRuntimeTween;
}

export interface CameraRuntimeStartOptions {
  readonly sequence?: readonly CameraPoint[];
  readonly returnDuration?: number;
}

export type CameraRunResult =
  | { readonly status: "completed" }
  | { readonly status: "failed"; readonly error: Error }
  | { readonly status: "cancelled" };

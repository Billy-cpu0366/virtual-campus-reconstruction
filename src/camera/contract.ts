// SYS-CAMERA 确定性 CORE 的公共类型。

export type CameraPoint = {
  readonly x: number;
  readonly y: number;
  readonly duration: number; // 飞到该点耗时（ms）
  readonly stayDuration: number; // 到达后停留（ms）
};

export type CameraBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

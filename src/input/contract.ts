// SYS-INPUT 确定性 CORE 的公共类型。

export type Direction =
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

export type DeviceKind = "desktop" | "tablet" | "mobile";

export interface DirectionVector {
  /** -1 | 0 | 1 */
  readonly dx: number;
  /** -1 | 0 | 1 */
  readonly dy: number;
}

// 键盘键态：cursors（方向键）与 wasdKeys 已合并后的四方向布尔。
export interface KeyState {
  readonly up: boolean;
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export interface JoystickParams {
  readonly radius: number;
  readonly baseDiameter: number;
  readonly thumbDiameter: number;
  readonly fixed: boolean;
  readonly forceMin: number;
  readonly position: "center-bottom" | "right-bottom";
}

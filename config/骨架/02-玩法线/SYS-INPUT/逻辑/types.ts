import type { DeviceKind, Direction, DirectionVector, KeyState } from "../../../../../src/input/index.js";

export interface InputConfigs {
  readonly speed: { readonly walk: number; readonly diagonal: number };
  readonly directions: readonly Direction[];
  readonly vectors: Readonly<Record<Direction, DirectionVector>>;
  readonly keyboard: { readonly mapping: Readonly<Record<string, keyof KeyState>> };
  readonly joystick: {
    readonly mainAxisRatio: number;
    readonly forceMin: number;
    readonly positionOffset: number;
    readonly depth: number;
    readonly device: Readonly<Record<DeviceKind, {
      readonly radius: number;
      readonly baseDiameter: number;
      readonly thumbDiameter: number;
      readonly position: "center-bottom" | "right-bottom";
    }>>;
    readonly style: {
      readonly baseFill: { readonly color: number; readonly alpha: number };
      readonly baseStroke: { readonly color: number; readonly alpha: number; readonly width: number };
      readonly thumbFill: { readonly color: number; readonly alpha: number };
      readonly thumbStroke: { readonly color: number; readonly alpha: number; readonly width: number };
    };
  };
  readonly device: { readonly tabletBreakpoint: number };
  readonly desktop: { readonly joystickVisible: boolean };
  readonly blurReset: boolean;
}

// SYS-LAYER 确定性 CORE 的公共类型。

export type LayerRole =
  | "visual"
  | "collision"
  | "marker"
  | "dynamic-visual"
  | "dynamic-collision";

export interface LayerStrategy {
  readonly name: string;
  readonly role: LayerRole;
  /** depth 设计默认；无显式层深度时为 undefined */
  readonly depth: number | undefined;
  /** marker 层允许的 GID；非 marker 层不设置 */
  readonly markerGids?: readonly number[];
  /** raw visual 层允许直接写入 Tilemap 的 GID；其他层不设置 */
  readonly rawGids?: readonly number[];
}

export type BridgeState = "up" | "down";

export type RoofState = "visible" | "faded";

export type RoofGroup = "concert" | "factory";

export interface RoofGroupState {
  readonly group: RoofGroup;
  readonly state: RoofState;
  readonly visible: boolean;
  readonly alpha: number;
  readonly durationMs: number;
}

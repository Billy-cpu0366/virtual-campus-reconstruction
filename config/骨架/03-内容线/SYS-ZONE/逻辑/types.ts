import type { ZoneMarker } from "../../../../../src/zone/index.js";

export type { ZoneMarker } from "../../../../../src/zone/index.js";

/** 区域触发的校园数值；触发点类型只转发 src/。 */
export interface ZoneConfigs {
  readonly markers: readonly ZoneMarker[];
  readonly interactionDistance: number;
  readonly intervalMs: number;
  readonly viewportPadding: number;
  readonly contentUpdateIntervalMs: number;
}

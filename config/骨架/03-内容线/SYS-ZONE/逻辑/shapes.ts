import { CONTENT_MENU_IDS } from "../../../../../src/content/contract.js";
import type { Spec } from "../../../公共/validate.js";

export const ZONE_SHAPES = {
  "03-内容线/SYS-ZONE/数据/zone-config.json": {
    kind: "object",
    fields: {
      markers: { kind: "array", of: { kind: "object", fields: {
        markerId: { kind: "string" },
        menuId: { kind: "string", oneOf: CONTENT_MENU_IDS },
        x: { kind: "number", unit: "pixel" },
        y: { kind: "number", unit: "pixel" },
      } } },
      interactionDistance: { kind: "number", unit: "pixel" },
      intervalMs: { kind: "number", unit: "ms" },
      viewportPadding: { kind: "number", unit: "pixel" },
      contentUpdateIntervalMs: { kind: "number", unit: "ms" },
    },
  },
} as const satisfies Record<string, Spec>;

export type ZoneConfigKey = keyof typeof ZONE_SHAPES;

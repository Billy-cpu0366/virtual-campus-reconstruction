import type { Spec } from "../../../公共/validate.js";

export const APP_SHAPES = {
  "04-独立件/SYS-APP/数据/app-config.json": {
    kind: "object",
    fields: {
      logicalWidth: { kind: "number" },
      logicalHeight: { kind: "number" },
      physicsFps: { kind: "number" },
      physicsFixedStep: { kind: "boolean" },
      physicsGravity: { kind: "object", fields: { x: { kind: "number" }, y: { kind: "number" } } },
      pixelArt: { kind: "boolean" },
      roundPixels: { kind: "boolean" },
      backgroundColor: { kind: "string" },
      showErrorDetail: { kind: "boolean" },
      entryTrainArrivalMs: { kind: "number" },
    },
  },
} as const satisfies Record<string, Spec>;

export type AppConfigKey = keyof typeof APP_SHAPES;

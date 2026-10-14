import type { Spec } from "../../../公共/validate.js";

export const WORLD_SHAPES = {
  "01-地图线/SYS-WORLD/数据/world-config.json": {
    kind: "object",
    fields: {
      entryCameraStart: { kind: "point", unit: "pixel" },
      entryCorridorSamples: { kind: "number", unit: "count" },
      bridgeCheckFrames: { kind: "number", unit: "count" },
      clearLayersPerFrame: { kind: "number", unit: "count" },
      cameraTestTour: { kind: "object", fields: {
        duration: { kind: "number", unit: "ms" },
        stayDuration: { kind: "number", unit: "ms" },
        returnDuration: { kind: "number", unit: "ms" },
      } },
      tileQuery: { kind: "object", fields: { layer: { kind: "string" } } },
    },
  },
} as const satisfies Record<string, Spec>;

export type WorldConfigKey = keyof typeof WORLD_SHAPES;

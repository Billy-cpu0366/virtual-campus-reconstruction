import type { Spec } from "../../../公共/validate.js";

const tileRect = {
  kind: "object",
  fields: {
    minX: { kind: "number", unit: "tile" },
    maxX: { kind: "number", unit: "tile" },
    minY: { kind: "number", unit: "tile" },
    maxY: { kind: "number", unit: "tile" },
  },
} as const;

const pixelRect = {
  kind: "object",
  fields: {
    left: { kind: "number", unit: "pixel" },
    right: { kind: "number", unit: "pixel" },
    top: { kind: "number", unit: "pixel" },
    bottom: { kind: "number", unit: "pixel" },
  },
} as const;

export const LAYER_SHAPES = {
  "02-玩法线/SYS-LAYER/数据/layer-config.json": {
    kind: "object",
    fields: {
      strategies: {
        kind: "array",
        of: {
          kind: "object",
          fields: {
            name: { kind: "string" },
            role: {
              kind: "string",
              oneOf: ["visual", "collision", "marker", "dynamic-visual", "dynamic-collision"],
            },
            depth: { kind: "number", nullable: true },
            markerGids: { kind: "array", of: { kind: "number" }, optional: true },
            rawGids: { kind: "array", of: { kind: "number" }, optional: true },
          },
        },
      },
      bridges: {
        kind: "object",
        fields: {
          bridge1: { kind: "object", fields: {
            up: { kind: "string" },
            down: { kind: "string" },
          } },
          bridge2: { kind: "object", fields: {
            up: { kind: "string" },
            down: { kind: "string" },
          } },
        },
      },
      roofGroups: {
        kind: "object",
        fields: {
          concert: { kind: "array", of: { kind: "string" } },
          factory: { kind: "array", of: { kind: "string" } },
        },
      },
      playerDepth: { kind: "object", fields: {
        base: { kind: "number" },
        yOffset: { kind: "number", unit: "pixel" },
        ratio: { kind: "number" },
      } },
      bridgePlayerDepth: { kind: "number" },
      roofFadeMs: { kind: "number", unit: "ms" },
      roofTweenEase: { kind: "string" },
      footstepDepth: { kind: "number" },
      collisionGidForced: { kind: "number" },
      nonCollisionGidForced: { kind: "number" },
      bridgeZones: { kind: "object", fields: {
        bridge1: { kind: "object", fields: {
          entry: { kind: "array", of: tileRect },
          exit: { kind: "array", of: tileRect },
        } },
        bridge2: { kind: "object", fields: {
          zones: { kind: "array", of: tileRect },
        } },
      } },
      roofZones: { kind: "object", fields: {
        factory: pixelRect,
        concert: pixelRect,
      } },
    },
  },
} as const satisfies Record<string, Spec>;

export type LayerConfigKey = keyof typeof LAYER_SHAPES;

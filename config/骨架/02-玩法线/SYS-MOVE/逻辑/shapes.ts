import type { Spec } from "../../../公共/validate.js";

export const MOVE_SHAPES = {
  "02-玩法线/SYS-MOVE/数据/move-config.json": {
    kind: "object",
    fields: {
      body: { kind: "object", fields: {
        width: { kind: "number", unit: "pixel" },
        height: { kind: "number", unit: "pixel" },
      } },
      drag: { kind: "number", unit: "pxPerSec" },
      maxVelocity: { kind: "number", unit: "pxPerSec" },
      collideWorldBounds: { kind: "boolean" },
      collisionLayerNames: { kind: "array", of: { kind: "string" } },
      walkableValue: { kind: "number" },
      blockedValue: { kind: "number" },
      outOfBoundsIsWalkable: { kind: "boolean" },
    },
  },
} as const satisfies Record<string, Spec>;

export type MoveConfigKey = keyof typeof MOVE_SHAPES;

import type { Spec } from "../../../公共/validate.js";

export const CAMERA_SHAPES = {
  "02-玩法线/SYS-CAMERA/数据/camera-config.json": {
    kind: "object",
    fields: {
      settings: { kind: "object", fields: {
        zoom: { kind: "number", unit: "ratio" },
        lerpX: { kind: "number", unit: "ratio" },
        lerpY: { kind: "number", unit: "ratio" },
        followOffsetX: { kind: "number" },
        followOffsetY: { kind: "number" },
        deadzoneX: { kind: "number", unit: "pixel" },
        deadzoneY: { kind: "number", unit: "pixel" },
        roundPixels: { kind: "boolean" },
      } },
      sequence: { kind: "array", of: { kind: "object", fields: {
        x: { kind: "number", unit: "pixel" },
        y: { kind: "number", unit: "pixel" },
        duration: { kind: "number", unit: "ms" },
        stayDuration: { kind: "number", unit: "ms" },
      } } },
      pointEase: { kind: "string" },
      returnDuration: { kind: "number", unit: "ms" },
      returnEase: { kind: "string" },
    },
  },
} as const satisfies Record<string, Spec>;

export type CameraConfigKey = keyof typeof CAMERA_SHAPES;

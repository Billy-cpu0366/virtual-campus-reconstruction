import type { Spec } from "../../../公共/validate.js";

const number: Spec = { kind: "number" };
const ratio: Spec = { kind: "number", unit: "ratio" };
const color: Spec = { kind: "object", fields: { color: number, alpha: ratio } };
const stroke: Spec = { kind: "object", fields: { color: number, alpha: ratio, width: number } };
const deviceParams: Spec = { kind: "object", fields: {
  radius: number, baseDiameter: number, thumbDiameter: number,
  position: { kind: "string", oneOf: ["center-bottom", "right-bottom"] },
} };

export const INPUT_SHAPES = {
  "02-玩法线/SYS-INPUT/数据/input-config.json": {
    kind: "object",
    fields: {
      speed: { kind: "object", fields: {
        walk: { kind: "number", unit: "pxPerSec" },
        diagonal: { kind: "number", unit: "pxPerSec" },
      } },
      directions: { kind: "array", of: { kind: "string", oneOf: [
        "north", "north-east", "east", "south-east", "south",
        "south-west", "west", "north-west",
      ] } },
      vectors: { kind: "record", of: { kind: "object", fields: { dx: number, dy: number } } },
      keyboard: { kind: "object", fields: { mapping: { kind: "record", of: {
        kind: "string", oneOf: ["up", "down", "left", "right"],
      } } } },
      joystick: { kind: "object", fields: {
        mainAxisRatio: ratio, forceMin: { kind: "number", unit: "pixel" },
        positionOffset: { kind: "number", unit: "pixel" }, depth: number,
        device: { kind: "object", fields: {
          desktop: deviceParams, tablet: deviceParams, mobile: deviceParams,
        } },
        style: { kind: "object", fields: {
          baseFill: color, baseStroke: stroke, thumbFill: color, thumbStroke: stroke,
        } },
      } },
      device: { kind: "object", fields: { tabletBreakpoint: { kind: "number", unit: "pixel" } } },
      desktop: { kind: "object", fields: { joystickVisible: { kind: "boolean" } } },
      blurReset: { kind: "boolean" },
    },
  },
} as const satisfies Record<string, Spec>;

export type InputConfigKey = keyof typeof INPUT_SHAPES;

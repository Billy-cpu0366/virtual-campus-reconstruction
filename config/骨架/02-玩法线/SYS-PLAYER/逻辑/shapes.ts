import type { Spec } from "../../../公共/validate.js";

const directionStarts = {
  kind: "object",
  fields: {
    east: { kind: "number" },
    "north-east": { kind: "number" },
    "north-west": { kind: "number" },
    north: { kind: "number" },
    "south-east": { kind: "number" },
    "south-west": { kind: "number" },
    south: { kind: "number" },
    west: { kind: "number" },
  },
} as const;

export const PLAYER_SHAPES = {
  "02-玩法线/SYS-PLAYER/数据/player-config.json": {
    kind: "object",
    fields: {
      spawn: { kind: "object", fields: { x: { kind: "number", unit: "pixel" }, y: { kind: "number", unit: "pixel" } } },
      texture: { kind: "string" },
      textureUrl: { kind: "string" },
      displaySize: { kind: "number", unit: "pixel" },
      specialDisplaySize: { kind: "number", unit: "pixel" },
      spritesheet: { kind: "object", fields: {
        frameSize: { kind: "object", fields: { width: { kind: "number", unit: "pixel" }, height: { kind: "number", unit: "pixel" } } },
      } },
      animation: { kind: "object", fields: {
        walkFramesPerDirection: { kind: "number" },
        frameRate: { kind: "number" },
        walkFrameStart: directionStarts,
      } },
      defaultFacing: { kind: "string", oneOf: ["east", "north-east", "north-west", "north", "south-east", "south-west", "south", "west"] },
      idle: { kind: "object", fields: {
        timeForIdleAction: { kind: "number", unit: "ms" },
        timeForSitting: { kind: "number", unit: "ms" },
        animations: { kind: "array", of: { kind: "string", oneOf: ["eating", "scratching", "tying-shoe"] } },
        textures: { kind: "array", of: { kind: "object", fields: {
          action: { kind: "string", oneOf: ["eating", "scratching", "tying-shoe", "sitting"] },
          key: { kind: "string" },
          url: { kind: "string" },
        } } },
        animationKeys: { kind: "object", fields: {
          eating: { kind: "string" },
          scratching: { kind: "string" },
          "tying-shoe": { kind: "string" },
          sittingDown: { kind: "string" },
          standingUp: { kind: "string" },
        } },
        assetFrames: { kind: "object", fields: {
          frameWidth: { kind: "number", unit: "pixel" },
          frameHeight: { kind: "number", unit: "pixel" },
          startFrame: { kind: "number" },
          endFrame: { kind: "number" },
        } },
      } },
      beach: { kind: "object", fields: { texture: { kind: "string" }, textureUrl: { kind: "string" } } },
      clothing: { kind: "object", fields: {
        offTexture: { kind: "string" },
        offTextureUrl: { kind: "string" },
        undressAnimationKey: { kind: "string" },
        dressAnimationKey: { kind: "string" },
        frameSize: { kind: "object", fields: { width: { kind: "number", unit: "pixel" }, height: { kind: "number", unit: "pixel" } } },
        assetFrames: { kind: "object", fields: { startFrame: { kind: "number" }, endFrame: { kind: "number" } } },
        frameRange: { kind: "object", fields: { start: { kind: "number" }, end: { kind: "number" } } },
        frameRate: { kind: "number" },
        offDisplaySize: { kind: "number", unit: "pixel" },
        cooldownMs: { kind: "number", unit: "ms" },
      } },
      beachTriggerGid: { kind: "number" },
    },
  },
} as const satisfies Record<string, Spec>;

export type PlayerConfigKey = keyof typeof PLAYER_SHAPES;

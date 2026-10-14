import type { Spec } from "../../../公共/validate.js";
import { STOP_AI_SMOKE_LAYERS, STOP_AI_SMOKE_SITES } from "../../../../../src/fx/index.js";

const point = {
  kind: "object",
  fields: { x: { kind: "number" }, y: { kind: "number" } },
} as const satisfies Spec;
const numberRange = {
  kind: "object",
  fields: { min: { kind: "number" }, max: { kind: "number" } },
} as const satisfies Spec;

export const FX_SHAPES = {
  "05-旁支/SYS-FX/数据/fx-config.json": {
    kind: "object",
    fields: {
      footstep: { kind: "object", fields: {
        textureKey: { kind: "string" }, poolSize: { kind: "number" }, alpha: { kind: "number" },
        spacing: { kind: "number" }, visibleMs: { kind: "number" }, fadeMs: { kind: "number" },
        speedThreshold: { kind: "number" }, maxPlayerDepth: { kind: "number" },
      } },
      factorySmoke: { kind: "object", fields: {
        x: { kind: "number" }, y: { kind: "number" }, width: { kind: "number" }, widthEnd: { kind: "number" },
        pathHeight: { kind: "number" }, quantity: { kind: "number" }, frequency: { kind: "number" },
        scaleStart: { kind: "number" }, alphaStart: { kind: "number" },
        maxAlpha: { kind: "number" }, alphaEnd: { kind: "number" }, scaleEnd: { kind: "number" },
        lifespan: { kind: "number" }, depth: { kind: "number" }, reactCars: { kind: "boolean" },
        reactPlayer: { kind: "boolean" }, viewportPadding: { kind: "number" }, presentationDepth: { kind: "number" },
      } },
      fog: { kind: "object", fields: {
        polygon: { kind: "array", of: point }, cellSize: { kind: "number" },
        viewportPadding: { kind: "number" }, clearAhead: { kind: "number" }, clearWidth: { kind: "number" },
        clearHeight: { kind: "number" }, carClearRadius: { kind: "number" }, respawnMs: { kind: "number" },
        depth: { kind: "number" }, blendMode: { kind: "string" }, scale: { kind: "number" }, alpha: { kind: "number" },
        speed: { kind: "number" }, quantity: { kind: "number" }, frequency: { kind: "number" },
        lifespan: numberRange, tint: { kind: "array", of: { kind: "number" } }, presentationQuantity: { kind: "number" },
      } },
      stopAiSmoke: { kind: "object", fields: {
        sites: { kind: "array", of: { kind: "object", fields: {
          site: { kind: "string", oneOf: STOP_AI_SMOKE_SITES.map((item) => item.site) },
          x: { kind: "number" }, y: { kind: "number" }, graphicColor: { kind: "number" }, graphicAngle: { kind: "number" }, angle: numberRange,
        } } },
        layers: { kind: "array", of: { kind: "string", oneOf: STOP_AI_SMOKE_LAYERS } },
        layerSettings: { kind: "object", fields: Object.fromEntries(STOP_AI_SMOKE_LAYERS.map((layer) => [layer, {
          kind: "object", fields: { alphaStart: { kind: "number" }, alphaEnd: { kind: "number" }, depth: { kind: "number" } },
        }])) },
        speed: numberRange, scale: { kind: "object", fields: { start: { kind: "number" }, end: { kind: "number" } } },
        lifespan: { kind: "number" }, quantity: { kind: "number" }, frequency: { kind: "number" }, gravityY: { kind: "number" },
        emitZoneRadius: { kind: "number" }, tint: { kind: "array", of: { kind: "number" } }, blendMode: { kind: "string" },
        emitterViewportPadding: { kind: "number" }, graphicViewportPadding: { kind: "number" }, visibilityCheckMs: { kind: "number" },
        windStartDelayMs: { kind: "number" }, windMinDelayMs: { kind: "number" }, windMaxDelayMs: { kind: "number" },
        windMinDurationMs: { kind: "number" }, windMaxDurationMs: { kind: "number" },
      } },
      concertLighting: { kind: "object", fields: {
        bounds: { kind: "object", fields: { left: { kind: "number" }, top: { kind: "number" }, right: { kind: "number" }, bottom: { kind: "number" } } },
        darkZoneDepth: { kind: "number" },
        spotlights: { kind: "array", of: { kind: "object", fields: {
          x: { kind: "number" }, y: { kind: "number" }, radius: { kind: "number" }, phase: { kind: "number" },
        } } },
        colorLights: { kind: "array", of: { kind: "object", fields: {
          x: { kind: "number" }, y: { kind: "number" }, color: { kind: "number" }, phase: { kind: "number" },
        } } },
        lasers: { kind: "array", of: { kind: "object", fields: {
          tileX: { kind: "number" }, tileY: { kind: "number" }, phase: { kind: "number" },
        } } },
        laserDepth: { kind: "number" },
      } },
      playerVisual: { kind: "object", fields: { stepMs: { kind: "number" }, snapDistance: { kind: "number" } } },
    },
  },
} as const satisfies Record<string, Spec>;

export type FxConfigKey = keyof typeof FX_SHAPES;

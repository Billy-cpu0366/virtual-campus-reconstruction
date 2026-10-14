import type { Spec } from "../../../公共/validate.js";

export const CHUNK_SHAPES = {
  "01-地图线/SYS-CHUNK/数据/chunk-config.json": {
    kind: "object",
    fields: {
      updateIntervalMs: { kind: "number", unit: "ms" },
      playerNeighborhoodRadius: { kind: "number", unit: "count" },
      cameraPadding: { kind: "number", unit: "count" },
      maxAttempts: { kind: "number", unit: "count" },
    },
  },
} as const satisfies Record<string, Spec>;

export type ChunkConfigKey = keyof typeof CHUNK_SHAPES;

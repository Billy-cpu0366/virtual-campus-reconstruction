import type { Spec } from "../../../公共/validate.js";
import { ENTITY_CLEANUP_STEPS } from "./types.js";

export const ENTITY_SHAPES = {
  "04-独立件/SYS-ENTITY/数据/entity-config.json": {
    kind: "object",
    fields: {
      cleanupOrder: {
        kind: "array",
        of: { kind: "string", oneOf: ENTITY_CLEANUP_STEPS },
      },
    },
  },
} as const satisfies Record<string, Spec>;

export type EntityConfigKey = keyof typeof ENTITY_SHAPES;

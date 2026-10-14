import type { Spec } from "../../../公共/validate.js";

export const GAME_UI_SHAPES = {
  "04-独立件/SYS-GAME-UI/数据/game-ui-config.json": {
    kind: "object",
    fields: {
      breakpoint: { kind: "object", fields: { mobile: { kind: "number" } } },
      focusRing: { kind: "string" },
      rootPadding: { kind: "object", fields: {
        desktop: { kind: "string" },
        mobile: { kind: "string" },
      } },
    },
  },
} as const satisfies Record<string, Spec>;

export type GameUiConfigKey = keyof typeof GAME_UI_SHAPES;

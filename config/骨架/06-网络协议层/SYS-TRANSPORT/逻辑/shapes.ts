import type { Spec } from "../../../公共/validate.js";

export const TRANSPORT_SHAPES = {
  "06-网络协议层/SYS-TRANSPORT/数据/transport-config.json": {
    kind: "object",
    fields: {
      timeouts: {
        kind: "object",
        fields: {
          // ms 单位：0 起步、上不封顶。0 本身会被加载器的正整数检查拦下。
          json: { kind: "number", unit: "ms" },
        },
      },
    },
  },
} as const satisfies Record<string, Spec>;

export type TransportConfigKey = keyof typeof TRANSPORT_SHAPES;

/**
 * SYS-ROUTE 每个配置文件的形状声明。
 *
 * 和 SYS-NPC 那份同一个规矩：单位由**这里**声明，不从 `meta.units` 读——
 * 代码是契约、数据是被检查的一方。两边一旦不一致，tests/config 里的交叉核对测试会失败。
 */
import type { Unit } from "../../../公共/config-source.js";
import type { Spec } from "../../../公共/validate.js";

const point = (unit: Unit): Spec => ({ kind: "point", unit });

/**
 * 偏移量：可以是负数（往上、往左偏），所以**不能**标 pixel——
 * 像素单位的范围是 0..2240，负数会被误当成「单位搞反了」拦下来。
 */
const OFFSET: Spec = {
  kind: "object",
  fields: {
    x: { kind: "number" },
    y: { kind: "number" },
  },
};

/** 一个宽高尺寸（像素）。 */
const SIZE: Spec = {
  kind: "object",
  fields: {
    width: { kind: "number", unit: "pixel" },
    height: { kind: "number", unit: "pixel" },
  },
};

/** 整张图的规格：只有取图地址。 */
const PRESENTATION_ASSET: Spec = {
  kind: "object",
  fields: {
    key: { kind: "string" },
    url: { kind: "string" },
  },
};

/** 要切片子的图：多两个**必填**字段。缺了动画就加载不出来，所以不设成可选。 */
const PRESENTATION_SPRITESHEET: Spec = {
  kind: "object",
  fields: {
    key: { kind: "string" },
    url: { kind: "string" },
    frameWidth: { kind: "number", unit: "pixel" },
    frameHeight: { kind: "number", unit: "pixel" },
  },
};

export const ROUTE_SHAPES = {
  "05-旁支/SYS-ROUTE/数据/train-config.json": {
    kind: "object",
    fields: {
      // startX 和 exitDistance 故意不标 pixel：火车是从地图外开进来的，
      // 这两个数本来就比世界宽度（2240）大，标了会被范围校验误伤。
      startX: { kind: "number" },
      endX: { kind: "number", unit: "pixel" },
      y: { kind: "number", unit: "pixel" },
      exitDistance: { kind: "number" },
      entryDurationMs: { kind: "number", unit: "ms" },
      holdDurationMs: { kind: "number", unit: "ms" },
      departureDurationMs: { kind: "number", unit: "ms" },
      tileSize: { kind: "number", unit: "pixel" },
      collisionTop: { kind: "number", unit: "pixel" },
      collisionBottom: { kind: "number", unit: "pixel" },
      // 这一段是「火车没动时」的本地横向区间，实际挡哪几格要现算。
      collisionXZones: {
        kind: "array",
        of: {
          kind: "object",
          fields: {
            left: { kind: "number", unit: "pixel" },
            right: { kind: "number", unit: "pixel" },
          },
        },
      },
    },
  },

  "05-旁支/SYS-ROUTE/数据/train-presentation.json": {
    kind: "object",
    fields: {
      presentationScale: { kind: "number", unit: "ratio" },
    },
  },

  "05-旁支/SYS-ROUTE/数据/vehicle-config.json": {
    kind: "object",
    fields: {
      helicopter: {
        kind: "object",
        fields: {
          position: point("pixel"),
          scale: { kind: "number" },
          depth: { kind: "number" },
          bladeDepth: { kind: "number" },
          frameEast: { kind: "number", unit: "count" },
          mainRotorSize: { kind: "number", unit: "pixel" },
          tailRotorSize: { kind: "number", unit: "pixel" },
          rotationSpeed: { kind: "number" },
          mainRotorOffset: OFFSET,
          tailRotorOffsetEast: OFFSET,
          // 角度，不是个数——所以不标 count。改这个数组的长度等于改桨叶片数。
          bladeAnglesDegrees: { kind: "array", of: { kind: "number" } },
          bladeDisplaySize: SIZE,
          mainRotorScaleEast: OFFSET,
          tailRotorScaleEast: OFFSET,
          highResolutionOffset: OFFSET,
        },
      },
      police: {
        kind: "object",
        fields: {
          depth: { kind: "number" },
          // 锚点是 0~1 的比例，不是像素。
          origin: point("ratio"),
          scale: { kind: "number" },
          collisionSize: SIZE,
          positions: {
            kind: "array",
            of: {
              kind: "object",
              fields: {
                x: { kind: "number", unit: "pixel" },
                y: { kind: "number", unit: "pixel" },
                frame: { kind: "number", unit: "count" },
              },
            },
          },
        },
      },
    },
  },

  "05-旁支/SYS-ROUTE/数据/vehicle-presentation.json": {
    kind: "object",
    fields: {
      // 五个角色名是代码里写死的，所以用 object 不用 record：
      // 加一个角色要同时改代码，不该在 JSON 里偷偷加。
      helicopterBody: PRESENTATION_SPRITESHEET,
      helicopterRotorBack: PRESENTATION_ASSET,
      helicopterRotorMain: PRESENTATION_ASSET,
      helicopterHighResolution: PRESENTATION_ASSET,
      policeBody: PRESENTATION_SPRITESHEET,
    },
  },
} as const satisfies Readonly<Record<string, Spec>>;

export type RouteConfigKey = keyof typeof ROUTE_SHAPES;

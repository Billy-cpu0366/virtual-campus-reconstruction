/**
 * SYS-NPC 每个配置文件的形状声明。
 *
 * 单位由**这里**声明，不从 `meta.units` 读——代码是契约、数据是被检查的一方。
 * 两边一旦不一致，tests/config 里的交叉核对测试会失败。
 * 为什么不让数据说了算：万一 meta.units 被改成错的，校验就会拿错的范围去比，
 * 那时候错误的数据反而「通过」了。
 */
import type { Unit } from "../../../公共/config-source.js";
import type { Spec } from "../../../公共/validate.js";

const point = (unit: Unit): Spec => ({ kind: "point", unit });

/** `STATIC_NPC_CONFIGS` `frameDurations[].frame` 是帧序号，不是格。 */
const FRAME_DURATION: Spec = {
  kind: "object",
  fields: {
    frame: { kind: "number", unit: "count" },
    duration: { kind: "number", unit: "ms" },
  },
};

export const NPC_SHAPES = {
  "05-旁支/SYS-NPC/数据/dancing-crowd-config.json": {
    kind: "object",
    fields: {
      minTileX: { kind: "number", unit: "tile" },
      minTileY: { kind: "number", unit: "tile" },
      maxTileX: { kind: "number", unit: "tile" },
      maxTileY: { kind: "number", unit: "tile" },
      npcCount: { kind: "number", unit: "count" },
      depth: { kind: "number" },
      scale: { kind: "number" },
      frameRate: { kind: "number" },
      // 这里原先有 directions。已删——见该文件 meta.notes：它同时是类型，
      // 不是纯数据。搬进来就得把 DancingDirection 这个联合类型放宽成普通字符串。
    },
  },

  "05-旁支/SYS-NPC/数据/dancing-crowd-presentation.json": {
    kind: "object",
    fields: {
      textureKeyPrefix: { kind: "string" },
      textureUrlPrefix: { kind: "string" },
      textureUrlSuffix: { kind: "string" },
      textureFrameWidth: { kind: "number", unit: "pixel" },
      textureFrameHeight: { kind: "number", unit: "pixel" },
      animationFrameStart: { kind: "number", unit: "count" },
      animationFrameEnd: { kind: "number", unit: "count" },
    },
  },

  "05-旁支/SYS-NPC/数据/bug-crowd-config.json": {
    kind: "object",
    fields: {
      id: { kind: "string" },
      startTiles: { kind: "array", of: point("tile") },
      endTiles: { kind: "array", of: point("tile") },
      npcCount: { kind: "number", unit: "count" },
      movementSpeed: { kind: "number", unit: "pxPerSec" },
      speedVariation: { kind: "number", unit: "ratio" },
      // mode 已删：合法取值只有 "wander" 一个，是类型不是配置。见该文件 meta.notes。
      randomPositions: { kind: "boolean" },
      wanderDistance: { kind: "number", unit: "pixel" },
      wanderInterval: { kind: "rangeMs" },
      sprite: { kind: "string" },
      maxActiveInViewport: { kind: "number", unit: "count" },
    },
  },

  "05-旁支/SYS-NPC/数据/bug-crowd-presentation.json": {
    kind: "object",
    fields: {
      frameWidth: { kind: "number", unit: "pixel" },
      frameHeight: { kind: "number", unit: "pixel" },
      frameCount: { kind: "number", unit: "count" },
      frameRate: { kind: "number" },
      displayScale: { kind: "number" },
      /** 锚点：图片的哪个点对齐到地面坐标。x/y 都是 0~1 的比例。 */
      origin: point("ratio"),
      /** 四个方向各自的起始帧号。键是方向名，**用 record 不用 object**——
       *  方向名将来由贴图排布决定，不该写死在代码里。 */
      facingFrameStart: { kind: "record", of: { kind: "number", unit: "count" } },
    },
  },

  "05-旁支/SYS-NPC/数据/venue-crowd-regions.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        id: { kind: "string" },
        type: { kind: "string", oneOf: ["concert", "protesters_rising"] },
        outline: { kind: "array", of: point("pixel") },
        count: { kind: "number", unit: "count" },
        spacing: { kind: "number", unit: "pixel" },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/route-crowd-configs.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        id: { kind: "string" },
        count: { kind: "number", unit: "count" },
        startTiles: { kind: "array", of: point("tile") },
        endTiles: { kind: "array", of: point("tile") },
        movementSpeed: { kind: "number", unit: "pxPerSec" },
        speedVariation: { kind: "rangeRatio" },
        delay: { kind: "rangeMs" },
        afterDelay: { kind: "rangeMs" },
        goBack: { kind: "boolean" },
        deleteAfterComplete: { kind: "boolean" },
        randomPositions: { kind: "boolean" },
        /** `null` = 不限（源码里是 undefined），加载器会还原。 */
        maxActiveInViewport: { kind: "number", unit: "count", nullable: true },
        pathRandomFactor: { kind: "number" },
        ignoreWalls: { kind: "boolean" },
        completionExit: { kind: "boolean" },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/route-crowd-presentation.json": {
    kind: "object",
    fields: {
      textures: { kind: "array", of: { kind: "string" } },
      /** 键是人群组 id。**用 record 不用 object**：换校园加一个特殊贴图组，
       *  应该只改这个文件，不该来改 TypeScript。 */
      specialTextures: { kind: "record", of: { kind: "array", of: { kind: "string" } } },
      /** 键同上。值是偏移像素数，0 表示不偏移。 */
      visualOffsets: { kind: "record", of: { kind: "number", unit: "pixel" } },
      textureFrameWidth: { kind: "number", unit: "pixel" },
      textureFrameHeight: { kind: "number", unit: "pixel" },
      /** 铁轨带：普通路人不能站进去的矩形（世界像素）。 */
      trackBand: {
        kind: "object",
        fields: {
          minX: { kind: "number", unit: "pixel" },
          maxX: { kind: "number", unit: "pixel" },
          minY: { kind: "number", unit: "pixel" },
          maxY: { kind: "number", unit: "pixel" },
        },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/static-crowd-regions.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        regionIndex: { kind: "number", unit: "count" },
        tileCount: { kind: "number", unit: "count" },
        type: { kind: "string", oneOf: ["crowd", "crowd_up"] },
        /** 46 个区域里只有一部分有名字，所以是可选。 */
        id: { kind: "string", optional: true },
        outline: { kind: "array", of: point("pixel") },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/static-crowd-tuning.json": {
    kind: "object",
    fields: {
      factor: { kind: "number", unit: "ratio" },
      upFactor: { kind: "number", unit: "ratio" },
      viewportMargin: { kind: "number", unit: "pixel" },
      minSpacing: { kind: "number", unit: "pixel" },
      coffeeMinSpacing: { kind: "number", unit: "pixel" },
      stopAiBackgroundRegionIndex: { kind: "number", unit: "count" },
      stopAiBackgroundCount: { kind: "number", unit: "count" },
      maxPlacementAttemptsPerInstance: { kind: "number", unit: "count" },
      footballCount: { kind: "number", unit: "count" },
      coffeeRegionIndexes: { kind: "array", of: { kind: "number", unit: "count" } },
      activeRegionExtraMargin: { kind: "number", unit: "pixel" },
      footballRegionIndexes: { kind: "array", of: { kind: "number", unit: "count" } },
      beachRegionIndexes: { kind: "array", of: { kind: "number", unit: "count" } },
      stationRegionIndexes: { kind: "array", of: { kind: "number", unit: "count" } },
    },
  },

  "05-旁支/SYS-NPC/数据/static-crowd-sprite-pools.json": {
    kind: "object",
    fields: {
      ordinary: { kind: "array", of: { kind: "string" } },
      beach: { kind: "array", of: { kind: "string" } },
      football: { kind: "array", of: { kind: "string" } },
    },
  },

  "05-旁支/SYS-NPC/数据/static-npc-configs.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        id: { kind: "string" },
        spriteKey: { kind: "string" },
        tileX: { kind: "number", unit: "tile" },
        tileY: { kind: "number", unit: "tile" },
        scale: { kind: "number" },
        frameRate: { kind: "number" },
        frameDurations: { kind: "array", of: FRAME_DURATION, optional: true },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/static-npc-presentation.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        key: { kind: "string" },
        url: { kind: "string" },
        frameWidth: { kind: "number", unit: "pixel" },
        frameHeight: { kind: "number", unit: "pixel" },
        /** 这张图上一共几帧，也就是动画循环播几帧。 */
        frameCount: { kind: "number", unit: "count" },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/sprayer-configs.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        id: { kind: "string" },
        tileX: { kind: "number", unit: "tile" },
        tileY: { kind: "number", unit: "tile" },
        depth: { kind: "number" },
        scale: { kind: "number" },
        frameRate: { kind: "number" },
        escapeRoute: { kind: "array", of: point("tile") },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/sprayer-presentation.json": {
    kind: "array",
    of: {
      kind: "object",
      fields: {
        key: { kind: "string" },
        /** 网页上的取图地址。和 static-npc-presentation.json 那份写法一致。 */
        url: { kind: "string" },
        frameWidth: { kind: "number", unit: "pixel" },
        frameHeight: { kind: "number", unit: "pixel" },
        startFrame: { kind: "number", unit: "count" },
        endFrame: { kind: "number", unit: "count" },
        /** 这张图上的动画每秒放几帧。两张图各一份。 */
        frameRate: { kind: "number" },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/static-crowd-disabled-regions.json": {
    kind: "object",
    fields: {
      disabledRegionIndexes: { kind: "array", of: { kind: "number", unit: "count" } },
    },
  },

  "05-旁支/SYS-NPC/数据/static-crowd-presentation.json": {
    kind: "object",
    fields: {
      defaultTexture: { kind: "string" },
      extraTextures: { kind: "array", of: { kind: "string" } },
      textureFrameWidth: { kind: "number", unit: "pixel" },
      textureFrameHeight: { kind: "number", unit: "pixel" },
      /** 视口判定的半宽。是估计值，不是贴图真实尺寸。 */
      npcHalfSize: { kind: "number", unit: "pixel" },
      lookAroundIntervalMs: { kind: "number", unit: "ms" },
      /** 每帧最多让几个人新出现，防止一次涌出一大片卡帧。和场馆人群那份同义。 */
      maxCreatePerSync: { kind: "number", unit: "count" },
    },
  },

  "05-旁支/SYS-NPC/数据/static-npc-tuning.json": {
    kind: "object",
    fields: { viewportMargin: { kind: "number", unit: "pixel" } },
  },

  "05-旁支/SYS-NPC/数据/route-crowd-tuning.json": {
    kind: "object",
    fields: {
      baseSpeed: { kind: "number", unit: "pxPerSec" },
      startBatchSize: { kind: "number", unit: "perFrame" },
      safeMargin: { kind: "number", unit: "pixel" },
    },
  },

  "05-旁支/SYS-NPC/数据/sprayer-tuning.json": {
    kind: "object",
    fields: {
      fleeSpeed: { kind: "number", unit: "pxPerSec" },
      groupDelay: { kind: "number", unit: "ms" },
      sprayDelayMax: { kind: "number", unit: "ms" },
      triggerVerticalMaxTiles: { kind: "number", unit: "tile" },
      triggerHorizontalTiles: { kind: "number", unit: "tile" },
    },
  },

  "05-旁支/SYS-NPC/数据/venue-crowd-tuning.json": {
    kind: "object",
    fields: {
      prewarmMargin: { kind: "number", unit: "pixel" },
      recycleMargin: { kind: "number", unit: "pixel" },
      maxPlacementAttempts: { kind: "number", unit: "count" },
    },
  },

  "05-旁支/SYS-NPC/数据/venue-crowd-presentation.json": {
    kind: "object",
    fields: {
      npcTexture: { kind: "string" },
      protesterAsset: {
        kind: "object",
        fields: {
          key: { kind: "string" },
          url: { kind: "string" },
          frameWidth: { kind: "number", unit: "pixel" },
          frameHeight: { kind: "number", unit: "pixel" },
        },
      },
      npcHalfSize: { kind: "number", unit: "pixel" },
      protesterHalfSize: { kind: "number", unit: "pixel" },
      slogans: { kind: "array", of: { kind: "string" } },
      speechMaxVisible: { kind: "number", unit: "count" },
      speechInitialDelayMs: { kind: "number", unit: "ms" },
      speechDurationMs: { kind: "number", unit: "ms" },
      speechIntervalMs: { kind: "number", unit: "ms" },
      /** 每帧最多让几个人新出现，防止一次涌出一大片卡帧。 */
      maxCreatePerSync: { kind: "number", unit: "count" },
      /** 同时最多几个人在做动作。 */
      maxConcurrentActs: { kind: "number", unit: "count" },
      /** 每 N 个抗议者里挑 1 个会做动作。3 = 三分之一。 */
      actCapableEveryNth: { kind: "number", unit: "count" },
      speechBubble: {
        kind: "object",
        fields: {
          fontFamily: { kind: "string" },
          fontStyle: { kind: "string" },
          color: { kind: "string" },
          backgroundColor: { kind: "string" },
          fontSizePx: { kind: "number", unit: "pixel" },
          wordWrapWidthPx: { kind: "number", unit: "pixel" },
          padding: {
            kind: "object",
            fields: {
              left: { kind: "number" },
              right: { kind: "number" },
              top: { kind: "number" },
              bottom: { kind: "number" },
            },
          },
          align: { kind: "string" },
          offsetYFromSpritePx: { kind: "number", unit: "pixel" },
        },
      },
    },
  },

  "05-旁支/SYS-NPC/数据/path-tuning.json": {
    kind: "object",
    fields: {
      tileSize: { kind: "number", unit: "pixel" },
      iterationsPerStep: { kind: "number", unit: "perFrame" },
      maxIterations: { kind: "number", unit: "count" },
      directions: {
        kind: "array",
        of: {
          kind: "object",
          fields: {
            // dx/dy 是「走几格」的步长，不是坐标，所以不标 tile——
            // 标了会被 0..140 的范围校验误伤（步长本来就该是 -1/0/1）。
            dx: { kind: "number" },
            dy: { kind: "number" },
            cost: { kind: "number" },
          },
        },
      },
    },
  },
} as const satisfies Readonly<Record<string, Spec>>;

export type NpcConfigKey = keyof typeof NPC_SHAPES;

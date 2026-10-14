/**
 * SYS-ROUTE 的配置类型。
 *
 * 和 SYS-NPC 那份同一个规矩：**能转发的就转发，不自己抄**。
 *
 * 上半截（火车那批）定义在 `src/route/` 里，这里只重新导出——类型是 `src/` 的代码
 * 要用的东西，而 `src/` 不许反过来认 `config/`。抄一遍就有两个真相，改一边忘一边必出事。
 *
 * 下半截（车辆与呈现那批）在 `src/` 里**没有对应物**：它们的来源是 `game/` 下那两个
 * Phaser 适配器，那儿原先只有 `as const` 字面量和模块私有常量，没有导出的 interface
 * 可以转发。所以只能在这儿定义。
 *
 * 定义时要**照着源码里的字面量写**，不能凭印象：结构对不上，接线时编译会炸；
 * 少写一个字段，校验就漏掉一个。
 */
export type {
  /** 火车：从地图外开进来、停一会儿、再开出去的那一趟 */
  TrainConfig,
  TrainCollisionRect,
  TrainCollisionZone,
  TrainRouteOptions,
  TrainRouteSnapshot,
  TrainRouteState,
} from "../../../../../src/route/index.js";

// ── 呈现层的类型（不是转发，是在这里定义的）────────────────────────────────
//
// 上面那一批是 `src/route/` 里已经有的类型，这里只转发。
// 下面这一批的来源是 `game/PhaserTrainRuntime.ts` 和 `game/PhaserVehicleRuntime.ts`。

/** 火车「显示上多大」。注意它同时决定挡路矩形的缩放——见 train-presentation.json 的说明。 */
export interface TrainPresentation {
  readonly presentationScale: number;
}

/** 直升机的数值：停在哪儿、多大、旋翼怎么转、一层层画在什么顺序上。 */
export interface VehicleHelicopterConfig {
  readonly position: { readonly x: number; readonly y: number };
  readonly scale: number;
  readonly depth: number;
  readonly bladeDepth: number;
  readonly frameEast: number;
  readonly mainRotorSize: number;
  readonly tailRotorSize: number;
  readonly rotationSpeed: number;
  /** 主旋翼相对机身的偏移。可以是负数（往上/往左偏），所以没有单位。 */
  readonly mainRotorOffset: { readonly x: number; readonly y: number };
  /** 尾桨相对机身的偏移（朝东那一面）。可以是负数。 */
  readonly tailRotorOffsetEast: { readonly x: number; readonly y: number };
  /** 五片桨叶各自的起始角度。改这个数等于改桨叶的片数。 */
  readonly bladeAnglesDegrees: readonly number[];
  /** 单片桨叶画多大。 */
  readonly bladeDisplaySize: {
    readonly width: number;
    readonly height: number;
  };
  /** 主旋翼的压扁比例，做出「俯视转圈」的透视感。 */
  readonly mainRotorScaleEast: { readonly x: number; readonly y: number };
  readonly tailRotorScaleEast: { readonly x: number; readonly y: number };
  /** 高清层相对机身的偏移。 */
  readonly highResolutionOffset: { readonly x: number; readonly y: number };
}

/** 一辆警车停在哪儿、显示哪一帧。 */
export interface VehiclePolicePosition {
  readonly x: number;
  readonly y: number;
  readonly frame: number;
}

/** 警车那一组的数值。`positions` 有几条就是几辆车——数量不再单独写一个数。 */
export interface VehiclePoliceConfig {
  readonly depth: number;
  /** 贴图锚点：图的哪个点对齐到上面的坐标。x/y 都是 0~1 的比例。 */
  readonly origin: { readonly x: number; readonly y: number };
  readonly scale: number;
  readonly collisionSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly positions: readonly VehiclePolicePosition[];
}

/** 车辆那一片的数值（直升机 + 警车）。 */
export interface VehicleConfig {
  readonly helicopter: VehicleHelicopterConfig;
  readonly police: VehiclePoliceConfig;
}

/**
 * 一张**整图**的规格：没有「每帧多大」这回事，只有取图地址。
 * 尾桨、主旋翼、高清层这三张是整图。
 */
export interface VehiclePresentationAsset {
  readonly key: string;
  readonly url: string;
}

/**
 * 一张**要切片子**的图的规格，比整图多两个字段。
 *
 * 这样分开写是有意的：机身那两张没有 frameWidth 就等于加载不出动画，
 * 但那是**运行到一半才发现**的。写在类型里，缺了当场编译不过。
 */
export interface VehiclePresentationSpritesheetAsset
  extends VehiclePresentationAsset {
  /** 一张大图里每小格多大。不是显示大小。 */
  readonly frameWidth: number;
  readonly frameHeight: number;
}

/**
 * 五张贴图按**角色**排好。角色名是代码里写死的，所以不能自己加一个。
 *
 * 为什么不排成一个数组：代码里要按「哪张是机身、哪张是主旋翼」取图，
 * 数组得靠下标认，改一次顺序就全错，而且不报错。
 */
export interface VehiclePresentation {
  readonly helicopterBody: VehiclePresentationSpritesheetAsset;
  readonly helicopterRotorBack: VehiclePresentationAsset;
  readonly helicopterRotorMain: VehiclePresentationAsset;
  readonly helicopterHighResolution: VehiclePresentationAsset;
  readonly policeBody: VehiclePresentationSpritesheetAsset;
}

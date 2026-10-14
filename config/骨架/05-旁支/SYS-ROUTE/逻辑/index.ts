/**
 * SYS-ROUTE 的配置加载入口：把 4 个配置文件读成一个对象交给游戏。
 *
 * 这一块是**照 SYS-NPC 那三小步做出来的样板**，步骤写在
 * `config/文档/接入一个板块.md` 里。走到哪一步、后面还剩什么，看那份。
 */
import type { ConfigSource } from "../../../公共/config-source.js";
import { validate } from "../../../公共/validate.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import type {
  TrainConfig,
  TrainPresentation,
  VehicleConfig,
  VehiclePresentation,
} from "./types.js";
import { ROUTE_SHAPES, type RouteConfigKey } from "./shapes.js";

/**
 * 类型的**唯一出处是 `src/`**，`config/` 只转手，不自己定一份。
 * `TrainPresentation` 和车辆那几个原本就只活在呈现层，没有对应的 `src/` 定义，
 * 所以它们定在 `./types.js` 里，这里照样转出去给调用方用。
 */
export type {
  TrainConfig,
  TrainCollisionRect,
  TrainCollisionZone,
  TrainPresentation,
  TrainRouteOptions,
  TrainRouteSnapshot,
  TrainRouteState,
  VehicleConfig,
  VehicleHelicopterConfig,
  VehiclePoliceConfig,
  VehiclePolicePosition,
  VehiclePresentation,
  VehiclePresentationAsset,
  VehiclePresentationSpritesheetAsset,
} from "./types.js";

/** 一个校园的全部路线与车辆配置。接线之后，游戏就读这个对象。 */
export interface RouteConfigs {
  /** 火车：从地图外开进来、停一会儿、再开出去的那一趟。 */
  readonly train: TrainConfig;
  /** 直升机与三辆警车的数值。 */
  readonly vehicle: VehicleConfig;
  /**
   * 呈现层：显示上多大、用哪几张图、每帧切多大。
   *
   * 和上面两组分开，因为**来源不同**：`train` 来自 `src/route/`（数据层），
   * `vehicle` 和 `presentation` 来自 `game/` 下的 Phaser 适配器（呈现层）。
   */
  readonly presentation: RoutePresentation;
}

/** 呈现层的全部配置。 */
export interface RoutePresentation {
  readonly train: TrainPresentation;
  readonly vehicle: VehiclePresentation;
}

/**
 * 读一个文件：来源取生数据 → 整理成可信文件（查信封、查 meta、冻结）→ 按形状校验数据。
 *
 * 整理这一步**在这里重做一次**，即使来源已经做过。多花的那点可以忽略，
 * 换来的是「换一个 ConfigSource 实现不会把校验和冻结一并换掉」。
 */
export const readRouteConfig = async <T>(
  key: RouteConfigKey,
  source: ConfigSource,
): Promise<T> => {
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  return validate<T>(key, ROUTE_SHAPES[key], file.data);
};

/** 按形状声明列出全部配置文件的 key。测试用它核对清单与磁盘是否一致。 */
export const ROUTE_CONFIG_KEYS = Object.keys(
  ROUTE_SHAPES,
) as readonly RouteConfigKey[];

/**
 * 读一个校园的全部路线与车辆配置。
 *
 * `source` **必须由调用方递进来**，这里不自备默认值。理由和「公共不许 import
 * 板块」是同一条：读法会变（现在是 fetch，将来后台可能带鉴权、带缓存层），
 * 而这一层只管「读哪些、怎么拼起来」。让这里挑一个默认实现，等于把某个
 * 读法焊死在 SYS-ROUTE 上，测试也就没法在不起服务器的情况下跑。
 *
 * 游戏里的调用方是 `game/main.ts`；测试里递的是从磁盘直接读的那个。
 *
 * 用 `Promise.all` 一次发 4 个请求，不是一个个排队等：
 * 这 4 份都是「开游戏前必须拿到」的，排队只会让首屏多等三趟网络。
 */
export const loadRouteConfigs = async (
  source: ConfigSource,
): Promise<RouteConfigs> => {
  const [train, trainPresentation, vehicle, vehiclePresentation] =
    await Promise.all([
      readRouteConfig<TrainConfig>(
        "05-旁支/SYS-ROUTE/数据/train-config.json",
        source,
      ),
      readRouteConfig<TrainPresentation>(
        "05-旁支/SYS-ROUTE/数据/train-presentation.json",
        source,
      ),
      readRouteConfig<VehicleConfig>(
        "05-旁支/SYS-ROUTE/数据/vehicle-config.json",
        source,
      ),
      readRouteConfig<VehiclePresentation>(
        "05-旁支/SYS-ROUTE/数据/vehicle-presentation.json",
        source,
      ),
    ]);

  return Object.freeze({
    train,
    vehicle,
    presentation: Object.freeze({
      train: trainPresentation,
      vehicle: vehiclePresentation,
    }),
  });
};

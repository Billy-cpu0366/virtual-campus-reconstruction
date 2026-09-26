/**
 * SYS-NPC 的配置加载入口：把 22 个配置文件读成一个对象交给游戏。
 *
 * 第一小步的验收物是「读出来的东西和 `src/npc/` 里那几个常量一模一样」——
 * 那时 `src/` 还留着原值好逐个比对。**第二小步之后 src/ 里的值已经删掉了**，
 * 这条比对不再成立，验收方式随之换成「改一个数、刷新页面能看见」。
 *
 * 值删掉之前，「抽得对不对」和「游戏有没有被搞坏」是两个独立的信号；
 * 删掉之后只剩后者，所以要格外留意测试有没有被顺手改松。
 */
import type { ConfigSource } from "../../../公共/config-source.js";
import { validate } from "../../../公共/validate.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import type {
  BugCrowdConfig,
  BugCrowdPresentation,
  DancingCrowdConfig,
  DancingCrowdPresentation,
  RouteCrowdConfig,
  RouteCrowdPresentation,
  SprayerConfig,
  SprayerPresentationAsset,
  StaticCrowdDisabledRegions,
  StaticCrowdPresentation,
  StaticCrowdRegion,
  StaticCrowdSpritePools,
  StaticNpcConfig,
  StaticNpcPresentationAsset,
  VenueCrowdPresentation,
  VenueRegion,
} from "./types.js";
import type {
  NpcTuning,
  PathTuning,
  RouteCrowdTuning,
  SprayerTuning,
  StaticCrowdTuning,
  StaticNpcTuning,
  VenueCrowdTuning,
} from "./tuning.js";
import { NPC_SHAPES, type NpcConfigKey } from "./shapes.js";

/** 一个校园的全部 NPC 配置。第二小步之后，游戏就读这个对象，不再读 src/ 的常量。 */
export interface NpcConfigs {
  readonly dancingCrowd: DancingCrowdConfig;
  readonly bugCrowd: BugCrowdConfig;
  readonly venueCrowdRegions: readonly VenueRegion[];
  readonly routeCrowdConfigs: readonly RouteCrowdConfig[];
  readonly staticCrowdRegions: readonly StaticCrowdRegion[];
  readonly staticCrowdSpritePools: StaticCrowdSpritePools;
  readonly staticNpcConfigs: readonly StaticNpcConfig[];
  readonly sprayerConfigs: readonly SprayerConfig[];
  /** 哪几块区域不站路人。序号对应 `staticCrowdRegions` 里的 regionIndex。 */
  readonly staticCrowdDisabledRegionIndexes: readonly number[];
  readonly tuning: NpcTuning;
  /**
   * 呈现层规格：贴图怎么切、显示上怎么错开、气泡长什么样。
   *
   * 和 `tuning` 分开，因为**来源不同**：`tuning` 来自 `src/npc/`（数据层），
   * 这里的全部来自 `game/` 下的 Phaser 适配器（呈现层）。
   * 接线的进度也不一样——`tuning` 归第二小步，这批归第 3 步。
   */
  readonly presentation: NpcPresentation;
}

/** 呈现层的全部配置，按 NPC 类型分组。 */
export interface NpcPresentation {
  readonly staticNpc: readonly StaticNpcPresentationAsset[];
  readonly staticCrowd: StaticCrowdPresentation;
  readonly routeCrowd: RouteCrowdPresentation;
  readonly venueCrowd: VenueCrowdPresentation;
  readonly bugCrowd: BugCrowdPresentation;
  readonly dancingCrowd: DancingCrowdPresentation;
  readonly sprayer: readonly SprayerPresentationAsset[];
}

/**
 * 读一个文件：来源取生数据 → 整理成可信文件（查信封、查 meta、冻结）→ 按形状校验数据。
 *
 * 整理这一步**在这里重做一次**，即使来源已经做过。多花的那点可以忽略，
 * 换来的是「换一个 ConfigSource 实现不会把校验和冻结一并换掉」——
 * 这是第二小步最容易踩的坑。
 */
export const readNpcConfig = async <T>(
  key: NpcConfigKey,
  source: ConfigSource,
): Promise<T> => {
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  return validate<T>(key, NPC_SHAPES[key], file.data);
};

/** 按形状声明列出全部 NPC 配置文件的 key。测试用它核对清单与磁盘是否一致。 */
export const NPC_CONFIG_KEYS = Object.keys(NPC_SHAPES) as readonly NpcConfigKey[];

/**
 * 读一个校园的全部 NPC 配置。
 *
 * `source` **必须由调用方递进来**，这里不自备默认值。理由和「公共不许 import
 * 板块」是同一条：读法会变（现在是 fetch，将来后台可能带鉴权、带缓存层），
 * 而这一层只管「读哪些、怎么拼起来」。让这里挑一个默认实现，等于把某个
 * 读法焊死在 SYS-NPC 上，测试也就没法在不起服务器的情况下跑。
 *
 * 游戏里的调用方是 `game/CampusScene.ts`；测试里递的是从磁盘直接读的那个。
 */
export const loadNpcConfigs = async (
  source: ConfigSource,
): Promise<NpcConfigs> => {
  const [
    dancingCrowd,
    bugCrowd,
    venueCrowdRegions,
    routeCrowdRaw,
    staticCrowdRegions,
    staticCrowdSpritePools,
    staticNpcConfigs,
    sprayerConfigs,
    staticCrowdTuning,
    staticNpcTuning,
    routeCrowdTuning,
    sprayerTuning,
    venueCrowdTuning,
    pathTuning,
    staticNpcPresentation,
    staticCrowdPresentation,
    routeCrowdPresentation,
    venueCrowdPresentation,
    bugCrowdPresentation,
    dancingCrowdPresentation,
    sprayerPresentation,
    staticCrowdDisabledRegions,
  ] = await Promise.all([
    readNpcConfig<DancingCrowdConfig>("05-旁支/SYS-NPC/数据/dancing-crowd-config.json", source),
    readNpcConfig<BugCrowdConfig>("05-旁支/SYS-NPC/数据/bug-crowd-config.json", source),
    readNpcConfig<readonly VenueRegion[]>("05-旁支/SYS-NPC/数据/venue-crowd-regions.json", source),
    readNpcConfig<readonly RouteCrowdConfig[]>(
      "05-旁支/SYS-NPC/数据/route-crowd-configs.json",
      source,
    ),
    readNpcConfig<readonly StaticCrowdRegion[]>(
      "05-旁支/SYS-NPC/数据/static-crowd-regions.json",
      source,
    ),
    readNpcConfig<StaticCrowdSpritePools>(
      "05-旁支/SYS-NPC/数据/static-crowd-sprite-pools.json",
      source,
    ),
    readNpcConfig<readonly StaticNpcConfig[]>(
      "05-旁支/SYS-NPC/数据/static-npc-configs.json",
      source,
    ),
    readNpcConfig<readonly SprayerConfig[]>("05-旁支/SYS-NPC/数据/sprayer-configs.json", source),
    readNpcConfig<StaticCrowdTuning>("05-旁支/SYS-NPC/数据/static-crowd-tuning.json", source),
    readNpcConfig<StaticNpcTuning>("05-旁支/SYS-NPC/数据/static-npc-tuning.json", source),
    readNpcConfig<RouteCrowdTuning>("05-旁支/SYS-NPC/数据/route-crowd-tuning.json", source),
    readNpcConfig<SprayerTuning>("05-旁支/SYS-NPC/数据/sprayer-tuning.json", source),
    readNpcConfig<VenueCrowdTuning>("05-旁支/SYS-NPC/数据/venue-crowd-tuning.json", source),
    readNpcConfig<PathTuning>("05-旁支/SYS-NPC/数据/path-tuning.json", source),
    // ── 呈现层（来源是 game/ 下的适配器，不是 src/）─────────────────────
    readNpcConfig<readonly StaticNpcPresentationAsset[]>(
      "05-旁支/SYS-NPC/数据/static-npc-presentation.json",
      source,
    ),
    readNpcConfig<StaticCrowdPresentation>(
      "05-旁支/SYS-NPC/数据/static-crowd-presentation.json",
      source,
    ),
    readNpcConfig<RouteCrowdPresentation>(
      "05-旁支/SYS-NPC/数据/route-crowd-presentation.json",
      source,
    ),
    readNpcConfig<VenueCrowdPresentation>(
      "05-旁支/SYS-NPC/数据/venue-crowd-presentation.json",
      source,
    ),
    readNpcConfig<BugCrowdPresentation>(
      "05-旁支/SYS-NPC/数据/bug-crowd-presentation.json",
      source,
    ),
    readNpcConfig<DancingCrowdPresentation>(
      "05-旁支/SYS-NPC/数据/dancing-crowd-presentation.json",
      source,
    ),
    readNpcConfig<readonly SprayerPresentationAsset[]>(
      "05-旁支/SYS-NPC/数据/sprayer-presentation.json",
      source,
    ),
    readNpcConfig<StaticCrowdDisabledRegions>(
      "05-旁支/SYS-NPC/数据/static-crowd-disabled-regions.json",
      source,
    ),
  ]);

  // JSON 没有 undefined，导出时把「不限」写成了 null，这里还原回 undefined，
  // 好让类型和 src/ 里那份 `number | undefined` 对得上。
  const routeCrowdConfigs: readonly RouteCrowdConfig[] = routeCrowdRaw.map(
    (config) =>
      Object.freeze({
        ...config,
        maxActiveInViewport: config.maxActiveInViewport ?? undefined,
      }),
  );

  return Object.freeze({
    dancingCrowd,
    bugCrowd,
    venueCrowdRegions,
    routeCrowdConfigs: Object.freeze(routeCrowdConfigs),
    staticCrowdRegions,
    staticCrowdSpritePools,
    staticNpcConfigs,
    sprayerConfigs,
    staticCrowdDisabledRegionIndexes: staticCrowdDisabledRegions.disabledRegionIndexes,
    tuning: Object.freeze({
      staticCrowd: staticCrowdTuning,
      staticNpc: staticNpcTuning,
      routeCrowd: routeCrowdTuning,
      sprayer: sprayerTuning,
      venueCrowd: venueCrowdTuning,
      path: pathTuning,
    }),
    presentation: Object.freeze({
      staticNpc: staticNpcPresentation,
      staticCrowd: staticCrowdPresentation,
      routeCrowd: routeCrowdPresentation,
      venueCrowd: venueCrowdPresentation,
      bugCrowd: bugCrowdPresentation,
      dancingCrowd: dancingCrowdPresentation,
      sprayer: sprayerPresentation,
    }),
  });
};

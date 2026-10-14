import Phaser from "./phaser.js";
import { fetchJson } from "./fetchJson.js";

import {
  ChunkCoordinator,
  ChunkDataStore,
  targetChunks,
  tilesetFirstGid,
  type CameraViewport,
  type ChunkCoordinate,
  type ChunkGeometry,
  type JsonLoader,
} from "../src/chunk/index.js";
import {
  keyboardDirection,
  resolveMovement,
  type Direction,
  type KeyState,
} from "../src/input/index.js";
import { blockedInDirection, velocityForDirection } from "../src/move/index.js";
import {
  beachWalkAnimation,
  walkFrameRange,
  walkFrameStart,
} from "../src/player/index.js";
import {
  PhaserPlayerRuntime,
  preloadPhaserPlayerRuntimeAssets,
  type PhaserPlayerSceneLike,
  type PhaserPlayerVisualLike,
} from "./PhaserPlayerRuntime.js";
import {
  PhaserPlayerVisualInterpolator,
  type PhaserPlayerVisualSceneLike,
  type PhaserPlayerVisualSourceLike,
} from "./PhaserPlayerVisualInterpolator.js";
import {
  PhaserCameraRuntime,
  type PhaserCameraSceneLike,
} from "./PhaserCameraRuntime.js";
import {
  type CameraRunResult,
  type CameraRuntimeStartOptions,
} from "../src/camera/index.js";
import type { CameraConfigs } from "../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js";
import {
  type ContentMenuId,
  type GameUiPort,
  type GameplayControlLeaseToken,
} from "../src/content/contract.js";
import { InteractRuntime } from "../src/interact/index.js";
import {
  DomModalGameUi,
  type DomModalElements,
  type DomModalKeyboard,
  type DomModalTarget,
  type DomModalViewport,
} from "../src/game-ui/index.js";
import type { DomModalFocusPort } from "../src/game-ui/dom-modal.js";
import {
  ZoneRuntime,
  type ZoneMarker,
  type ZoneSnapshot,
} from "../src/zone/index.js";
import { CampusContentResolver } from "./CampusContentResolver.js";
import { AppGameUiBridge } from "./AppGameUiBridge.js";
import { GameplayControlLeaseRuntime } from "./GameplayControlLeaseRuntime.js";
import {
  PhaserTrainArrivalAdapter,
  ProductEntryCameraAdapter,
} from "./ProductEntryAdapters.js";
import {
  PhaserTrainRuntime,
  type PhaserTrainCollisionShapeLike,
  type PhaserTrainSceneLike,
} from "./PhaserTrainRuntime.js";
import {
  PhaserSprayerRuntime,
  preloadSprayerRuntimeAssets,
  type PhaserSprayerSceneLike,
} from "./PhaserSprayerRuntime.js";
import {
  PhaserRouteCrowdRuntime,
  preloadRouteCrowdRuntimeAssets,
} from "./PhaserRouteCrowdRuntime.js";
import {
  PhaserStaticNpcRuntime,
  preloadStaticNpcRuntimeAssets,
} from "./PhaserStaticNpcRuntime.js";
import {
  PhaserStaticCrowdRuntime,
  preloadStaticCrowdRuntimeAssets,
} from "./PhaserStaticCrowdRuntime.js";
import { PhaserBugCrowdRuntime, preloadBugCrowdRuntimeAssets } from "./PhaserBugCrowdRuntime.js";
import { PhaserVenueCrowdRuntime, preloadVenueCrowdRuntimeAssets } from "./PhaserVenueCrowdRuntime.js";
import { PhaserDancingCrowdRuntime, preloadDancingCrowdRuntimeAssets } from "./PhaserDancingCrowdRuntime.js";
import { GridRouteCrowdPathProvider } from "../src/npc/index.js";
import type { NpcConfigs } from "../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";
import type { RouteConfigs } from "../config/骨架/05-旁支/SYS-ROUTE/逻辑/index.js";
import type { MoveConfigs } from "../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js";
import type { InputConfigs } from "../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js";
import type { WorldConfigs } from "../config/骨架/01-地图线/SYS-WORLD/逻辑/index.js";
import {
  PhaserFactorySmokeRuntime,
  preloadFactorySmokeRuntimeAssets,
  type PhaserFactorySmokeSceneLike,
} from "./PhaserFactorySmokeRuntime.js";
import {
  PhaserStopAiSmokeRuntime,
  type PhaserStopAiSmokeSceneLike,
} from "./PhaserStopAiSmokeRuntime.js";
import {
  PhaserFogRuntime,
  type PhaserFogSceneLike,
} from "./PhaserFogRuntime.js";
import {
  PhaserVehicleRuntime,
  type PhaserVehicleSceneLike,
} from "./PhaserVehicleRuntime.js";
import {
  PhaserFootstepRuntime,
  type PhaserFootstepSceneLike,
} from "./PhaserFootstepRuntime.js";
import {
  PhaserCampusMapRuntime,
  type CampusMapElementLike,
  type CampusMapMarker,
  type CampusMapMarkerView,
} from "./PhaserCampusMapRuntime.js";
import {
  ProductEntryRuntime,
  type ProductEntryGuideTarget,
  type ProductEntryResult,
  type ProductEntrySnapshot,
} from "./ProductEntryRuntime.js";
import {
  isBeachTriggerTile,
  isBridge1EntryZone,
  isBridge1ExitZone,
  isBridge2Zone,
  playerDepth,
  type RoofGroupState,
} from "../src/layer/index.js";
import { createWorld, worldSpecFromMaster, type WorldSpec } from "../src/world/index.js";
import { PhaserWorldMutationScheduler } from "./PhaserWorldMutationScheduler.js";
import {
  PhaserWorldRenderer,
  type TilemapLayerLike,
} from "./PhaserWorldRenderer.js";
import {
  deviceKindForPhaserScene,
  PhaserVirtualJoystick,
  type JoystickSceneLike,
} from "./PhaserVirtualJoystick.js";
// 地图资源地址一律走 src/asset 的拼装函数，这里不再出现字面量路径。
// 根值 `/assets/maps` 与原站运行期一致（`MAP_BASE_URL`）。
import {
  chunkMasterUrl,
  independentLayerUrl,
  tilesetImageUrl,
} from "../src/asset/index.js";
import type { ChunkConfigs } from "../config/骨架/01-地图线/SYS-CHUNK/逻辑/index.js";
import type { ZoneConfigs } from "../config/骨架/03-内容线/SYS-ZONE/逻辑/index.js";
import type { InteractConfigs } from "../config/骨架/03-内容线/SYS-INTERACT/逻辑/index.js";
import type { LayerConfigs } from "../config/骨架/02-玩法线/SYS-LAYER/逻辑/index.js";
import type { EntityCleanupStep, EntityConfigs } from "../config/骨架/04-独立件/SYS-ENTITY/逻辑/index.js";
import type { PlayerConfigs } from "../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";
import type { FxConfigs } from "../config/骨架/05-旁支/SYS-FX/逻辑/index.js";
import type { TransportConfigs } from "../config/骨架/06-网络协议层/SYS-TRANSPORT/逻辑/index.js";

const CHUNK_MASTER_URL = chunkMasterUrl();
const PHASER_ASSET_PROGRESS_WEIGHT = 0.72;
const MASTER_READY_PROGRESS = 0.8;
const WORLD_OWNER_READY_PROGRESS = 0.88;
const INITIAL_TARGETS_STARTED_PROGRESS = 0.92;
const INITIAL_TARGETS_READY_PROGRESS = 0.98;
const LOGICAL_VIEWPORT_WIDTH = 480;
const LOGICAL_VIEWPORT_HEIGHT = 270;
type RoofTweenHandle = { stop?(): unknown; remove?(): unknown };
const CONTENT_MARKER_LABELS: Readonly<Record<ContentMenuId, string>> =
  Object.freeze({
    about: "About me",
    cv: "Resume(CV)",
    projects: "Projects",
    contact: "Contact",
    tech: "Technologies",
    memo1: "Memo #1",
    memo2: "Memo #2",
    memo3: "Memo #3",
    memo4: "Memo #4",
    memo5: "Memo #5",
    memo6: "Memo #6",
  });
function mergeChunkTargets(
  ...groups: readonly (readonly ChunkCoordinate[])[]
): readonly ChunkCoordinate[] {
  const unique = new Map<string, ChunkCoordinate>();
  for (const group of groups) {
    for (const coordinate of group) {
      unique.set(`${coordinate.x}_${coordinate.y}`, coordinate);
    }
  }
  return Object.freeze(
    [...unique.values()].sort(
      (left, right) => left.y - right.y || left.x - right.x,
    ),
  );
}

export interface CampusAmbientGuideStep {
  readonly direction: "north" | "south" | "east" | "west";
  readonly tiles: number;
}

export interface CampusAmbientGuideTarget {
  readonly id: "trackside-sprayers" | "factory-smoke";
  readonly label: string;
  readonly steps: readonly CampusAmbientGuideStep[];
}

const TRACKSIDE_SPRAYER_GUIDE: CampusAmbientGuideTarget = Object.freeze({
  id: "trackside-sprayers",
  label: "Trackside crew",
  steps: Object.freeze([
    Object.freeze({ direction: "east", tiles: 20 }),
    Object.freeze({ direction: "south", tiles: 7 }),
    Object.freeze({ direction: "west", tiles: 8 }),
  ]),
});

const FACTORY_SMOKE_GUIDE: CampusAmbientGuideTarget = Object.freeze({
  id: "factory-smoke",
  label: "Factory smoke",
  steps: Object.freeze([
    Object.freeze({ direction: "west", tiles: 30 }),
    Object.freeze({ direction: "south", tiles: 8 }),
  ]),
});

export interface CampusSceneEntryCallbacks {
  readonly onLoadProgress?: (progress: number) => void;
  readonly onReady?: () => void;
  readonly onEntryStatus?: (snapshot: ProductEntrySnapshot) => void;
  readonly onGuide?: (target: ProductEntryGuideTarget) => void | boolean;
  readonly onAmbientGuide?: (target: CampusAmbientGuideTarget) => void;
  readonly onModalVisibility?: (visible: boolean) => void;
  readonly onError?: (error: Error) => void;
}

export interface CampusSceneShutdownReceipt {
  readonly trainColliderActive: boolean;
  readonly trainColliderCount: number;
  readonly trainCollisionShapeCount: number;
  readonly trainBlockingCellCount: number;
  readonly trainSpriteActive: boolean;
  readonly trainCollisionShapeActive: boolean;
  readonly sprayerSpriteCount: number;
  readonly staticNpcSpriteCount: number;
  readonly staticCrowdSpriteCount: number;
  readonly smokeEmitterActive: boolean;
  readonly footstepActiveCount: number;
  readonly factoryRoofTweenActive: boolean;
  readonly concertRoofTweenActive: boolean;
  readonly mapHudHidden: boolean;
  readonly mapRootHidden: boolean;
  readonly mapLeaseActive: boolean;
  readonly sideFailures: readonly string[];
  readonly physicsColliderCount: number | null;
}


export class CampusScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerRuntime: PhaserPlayerRuntime | undefined;
  private playerVisualInterpolator: PhaserPlayerVisualInterpolator | undefined;
  private cameraRuntime: PhaserCameraRuntime | undefined;
  private cameraRunResult: CameraRunResult | undefined;
  private pendingCameraViewport: CameraViewport | undefined;
  private cameraViewportUpdates = 0;
  private cameraControlDisables = 0;
  private cameraControlEnables = 0;
  private cameraLeaseToken: GameplayControlLeaseToken | undefined;
  private entryRuntime: ProductEntryRuntime | undefined;
  private entryCameraRuntime: PhaserCameraRuntime | undefined;
  private entryTrainAdapter: PhaserTrainArrivalAdapter | undefined;
  private entryResult: ProductEntryResult | undefined;
  private trainRuntime: PhaserTrainRuntime | undefined;
  private sprayerRuntime: PhaserSprayerRuntime | undefined;
  private routeCrowdRuntime: PhaserRouteCrowdRuntime | undefined;
  private staticNpcRuntime: PhaserStaticNpcRuntime | undefined;
  private staticCrowdRuntime: PhaserStaticCrowdRuntime | undefined;
  private bugCrowdRuntime: PhaserBugCrowdRuntime | undefined;
  private venueCrowdRuntime: PhaserVenueCrowdRuntime | undefined;
  private dancingCrowdRuntime: PhaserDancingCrowdRuntime | undefined;
  private smokeRuntime: PhaserFactorySmokeRuntime | undefined;
  private stopAiSmokeRuntime: PhaserStopAiSmokeRuntime | undefined;
  private fogRuntime: PhaserFogRuntime | undefined;
  private vehicleRuntime: PhaserVehicleRuntime | undefined;
  private footstepRuntime: PhaserFootstepRuntime | undefined;
  private mapRuntime: PhaserCampusMapRuntime | undefined;
  private mapLeaseToken: GameplayControlLeaseToken | undefined;
  private nextMapResidenceNumber = 1;
  private factoryRoofInside: boolean | undefined;
  private concertRoofInside: boolean | undefined;
  private factoryRoofTween: RoofTweenHandle | undefined;
  private concertRoofTween: RoofTweenHandle | undefined;
  private trainColliderActive = false;
  private trainColliderCount = 0;
  private trainBlockingCells: readonly string[] = Object.freeze([]);
  private readonly sideFailures: string[] = [];
  private shutdownTask: Promise<CampusSceneShutdownReceipt> | undefined;
  private sceneReady = false;
  private requiredLoadError: Error | undefined;
  private contentLeaseRuntime: GameplayControlLeaseRuntime | undefined;
  private contentUi: GameUiPort | undefined;
  private interactRuntime: InteractRuntime | undefined;
  private zoneRuntime: ZoneRuntime | undefined;
  private contentUpdateElapsed = 0;
  private zoneConfigs: ZoneConfigs | undefined;
  private moveConfigs: MoveConfigs | undefined;
  private inputConfigs: InputConfigs | undefined;
  private worldConfigs: WorldConfigs | undefined;
  private cameraConfigs: CameraConfigs | undefined;
  private interactConfigs: InteractConfigs | undefined;
  private layerConfigs: LayerConfigs | undefined;
  private entityConfigs: EntityConfigs | undefined;
  private fxConfigs: FxConfigs | undefined;
  private entityConfigsPromise: Promise<EntityConfigs> | undefined;
  /**
   * §17 传输配置的实测面：create() 里存下的值就是包装 JsonLoader 时
   * 喂给 fetchJson 的那份超时。config-live 冒烟量它，证明配置穿过了运行路径。
   */
  transportSnapshot: { readonly jsonTimeoutMs: number } | undefined;
  private joystick!: PhaserVirtualJoystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private lastDirection: Direction;
  private coordinator: ChunkCoordinator | undefined;
  private worldRenderer: PhaserWorldRenderer | undefined;
  private dataStore: ChunkDataStore | undefined;
  private dynamicWorldShutdown: Promise<void> | undefined;
  private worldSpec: WorldSpec | undefined;
  private entryChunkTargetLock: readonly ChunkCoordinate[] | undefined;
  private chunkUpdateElapsed = 0;
  private chunkConfigs: ChunkConfigs | undefined;
  private bridgeCheckFrames = 0;
  private bridge1DownVisible = true;
  private bridge2DownVisible = true;
  private playerWasInBridge1EntryZone = false;
  private playerWasInBridge1ExitZone = false;
  private playerWasInBridge2Zone = false;
  /** 上一次巡检时玩家脚下的瓦片编号。换装的「离开沙滩」判定靠它做边沿检测。 */
  private playerLastTileIndex: number | null = null;
  private sceneDestroyed = false;
  private readonly testHooksEnabled =
    import.meta.env.DEV || import.meta.env.MODE === "test-hooks";
  private readonly cameraTestHooksEnabled =
    import.meta.env.MODE === "test-hooks";
  private debugHook: (() => unknown) | undefined;
  private collisionTestHook:
    | { setPlayerPosition(x: number, y: number): void }
    | undefined;
  private lifecycleTestHook:
    | { shutdown(): Promise<CampusSceneShutdownReceipt> }
    | undefined;
  private contentTestHook:
    | {
        setPlayerPosition(x: number, y: number): void;
        tick(): unknown;
        snapshot(): unknown;
      }
    | undefined;
  private readonly collisionColliders = new Map<
    TilemapLayerLike,
    { destroy(): void }
  >();
  private readonly vehicleColliders = new Set<{
    active?: boolean;
    destroy(): void;
  }>();
  private readonly heldMovementKeys = new Set<keyof KeyState>();
  private readonly mutationScheduler = new PhaserWorldMutationScheduler();

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = this.inputConfigs?.keyboard.mapping[event.code];
    if (key !== undefined) {
      this.heldMovementKeys.add(key);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = this.inputConfigs?.keyboard.mapping[event.code];
    if (key !== undefined) {
      this.heldMovementKeys.delete(key);
    }
  };

  private readonly handleWindowBlur = (): void => {
    if (this.inputConfigs?.blurReset === false) return;
    if (this.playerRuntime !== undefined) {
      this.playerRuntime.blur(this.time.now);
      return;
    }
    this.heldMovementKeys.clear();
    this.input.keyboard?.resetKeys?.();
    this.joystick?.reset();
    this.stopPlayerMovement();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") {
      this.handleWindowBlur();
    }
  };

  /**
   * 三份配置都是**场景造出来之前就读好的**。
   *
   * 为什么非得这么早：`preload()` 是同步的，而登记贴图必须在那时候说清楚
   * 「这图每一帧多大、一共几帧」。这些数字全在配置里。所以顺序只能是
   * 先读配置 → 再造 Phaser 游戏对象 → `preload()` 才有数可依。
   *
   * 各板块分别递入配置：板块之间不该互相认识，新增一块时只增加自己的入口。
   */
  constructor(
    private readonly npcConfigs: NpcConfigs,
    private readonly routeConfigs: RouteConfigs,
    private readonly playerConfigs: PlayerConfigs,
    private readonly transportConfigs: TransportConfigs,
    private readonly loadChunkConfigs: () => Promise<ChunkConfigs>,
    private readonly loadZoneConfigs: () => Promise<ZoneConfigs>,
    private readonly loadMoveConfigs: () => Promise<MoveConfigs>,
    private readonly loadInputConfigs: () => Promise<InputConfigs>,
    private readonly loadWorldConfigs: () => Promise<WorldConfigs>,
    private readonly loadCameraConfigs: () => Promise<CameraConfigs>,
    private readonly loadInteractConfigs: () => Promise<InteractConfigs>,
    private readonly loadLayerConfigs: () => Promise<LayerConfigs>,
    private readonly loadEntityConfigs: () => Promise<EntityConfigs>,
    private readonly loadFxConfigs: () => Promise<FxConfigs>,
    private readonly entryCallbacks: CampusSceneEntryCallbacks = {},
  ) {
    super("campus");
    this.lastDirection = playerConfigs.defaultFacing;
  }

  preload(): void {
    this.load.on("progress", (progress: number) => {
      this.entryCallbacks.onLoadProgress?.(
        Math.max(0, Math.min(1, progress)) * PHASER_ASSET_PROGRESS_WEIGHT,
      );
    });
    this.load.on("loaderror", (file: { readonly key?: unknown }) => {
      if (this.sceneDestroyed) return;
      const key = typeof file?.key === "string" ? file.key : "required asset";
      if (this.playerConfigs.idle.textures.some((texture) => texture.key === key)) {
        this.recordSideFailure(`optional-player-asset:${key}`);
        return;
      }
      if (this.requiredLoadError !== undefined) return;
      this.requiredLoadError = new Error(`required asset failed: ${key}`);
      this.entryCallbacks.onError?.(this.requiredLoadError);
    });
    this.trainRuntime = new PhaserTrainRuntime(
      this as unknown as PhaserTrainSceneLike,
      {
        route: this.routeConfigs,
        blockingZone: {
          setTrainBlockingZone: (cells) => {
            this.trainBlockingCells = Object.freeze([...(cells ?? [])]);
          },
        },
        connectCollision: (shape) => this.connectTrainCollision(shape),
        viewport: () => this.smokeViewport(),
        onDeparture: () => {
          if (this.sceneDestroyed) return;
          this.routeCrowdRuntime?.pauseGroup("loop-crowd");
          this.routeCrowdRuntime?.startTrain(this.time.now);
        },
        onLeaveViewport: () => {
          this.routeCrowdRuntime?.resumeGroup("loop-crowd");
        },
        onComplete: () => {
          this.routeCrowdRuntime?.resumeGroup("loop-crowd");
          if (!this.sceneDestroyed) {
            this.entryCallbacks.onAmbientGuide?.(TRACKSIDE_SPRAYER_GUIDE);
          }
        },
        onError: (reason) => this.recordSideFailure(`train:${reason}`),
      },
      () => this.layerConfigs!.playerDepth,
    );
    this.vehicleRuntime = new PhaserVehicleRuntime(
      this as unknown as PhaserVehicleSceneLike,
      {
        route: this.routeConfigs,
        onError: (reason) => this.recordSideFailure(`vehicle:${reason}`),
      },
    );
    const presentation = this.npcConfigs.presentation;
    preloadSprayerRuntimeAssets(this.load, presentation.sprayer);
    this.trainRuntime.preload();
    preloadFactorySmokeRuntimeAssets(this.load);
    this.vehicleRuntime.preload();
    preloadRouteCrowdRuntimeAssets(this.load, presentation.routeCrowd);
    preloadStaticNpcRuntimeAssets(this.load, presentation.staticNpc);
    preloadStaticCrowdRuntimeAssets(this.load, presentation.staticCrowd);
    preloadBugCrowdRuntimeAssets(this.load, presentation.bugCrowd);
    preloadVenueCrowdRuntimeAssets(this.load, presentation.venueCrowd);
    preloadDancingCrowdRuntimeAssets(this.load, presentation.dancingCrowd);

    this.load.image("exterior", tilesetImageUrl("exterior-final.webp"));
    this.load.image("collisions-objects", tilesetImageUrl("collisions-objects.webp"));
    this.load.json("walls-layer", independentLayerUrl("walls-layer.json"));
    this.load.image("tileset-particles", tilesetImageUrl("tileset-particles.webp"));
    this.load.spritesheet(this.playerConfigs.texture, this.playerConfigs.textureUrl, {
      frameWidth: this.playerConfigs.spritesheet.frameSize.width,
      frameHeight: this.playerConfigs.spritesheet.frameSize.height,
      startFrame: 0,
      endFrame: this.playerConfigs.spritesheet.frames - 1,
    });
    this.load.spritesheet(this.playerConfigs.beach.texture, this.playerConfigs.beach.textureUrl, {
      frameWidth: this.playerConfigs.spritesheet.frameSize.width,
      frameHeight: this.playerConfigs.spritesheet.frameSize.height,
      startFrame: 0,
      endFrame: this.playerConfigs.spritesheet.frames - 1,
    });
    this.load.spritesheet(this.playerConfigs.clothing.offTexture, this.playerConfigs.clothing.offTextureUrl, {
      frameWidth: this.playerConfigs.clothing.frameSize.width,
      frameHeight: this.playerConfigs.clothing.frameSize.height,
      startFrame: this.playerConfigs.clothing.assetFrames.startFrame,
      endFrame: this.playerConfigs.clothing.assetFrames.endFrame,
    });
    preloadPhaserPlayerRuntimeAssets(this.load, this.playerConfigs);
  }

  create(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.events.once("shutdown", () => {
      void this.beginShutdown().catch((error: unknown) => {
        console.error("场景销毁失败", error);
      });
    });
    void this.initializeDynamicWorld().catch((error: unknown) => {
      if (!this.sceneDestroyed) {
        const failure =
          error instanceof Error ? error : new Error(String(error));
        this.entryCallbacks.onError?.(failure);
        console.error("动态世界初始化失败", error);
      }
    });
  }

  startProductEntry(): Promise<ProductEntryResult> {
    if (this.entryResult !== undefined) {
      return Promise.resolve(this.entryResult);
    }
    if (!this.sceneReady || this.requiredLoadError !== undefined) {
      return Promise.resolve(
        Object.freeze({
          status: "failed" as const,
          error: this.requiredLoadError ?? new Error("scene is not ready"),
        }),
      );
    }
    if (this.entryRuntime !== undefined) return this.entryRuntime.start();

    this.player.setVisible(true);
    const cameraRuntime = this.createEntryCameraRuntime();
    const trainRuntime = this.trainRuntime;
    if (trainRuntime === undefined) {
      return Promise.resolve(
        Object.freeze({
          status: "failed" as const,
          error: new Error("train runtime is not ready"),
        }),
      );
    }
    const trainAdapter = new PhaserTrainArrivalAdapter(
      trainRuntime,
      this.events,
      () => this.time.now,
    );
    const entryRuntime = new ProductEntryRuntime({
      lease: this.contentLeaseRuntime!,
      camera: new ProductEntryCameraAdapter(
        cameraRuntime,
        () => {
          const camera = this.cameras.main;
          const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0
            ? camera.zoom
            : 1;
          return Object.freeze({
            x: camera.scrollX + camera.width / (2 * zoom),
            y: camera.scrollY + camera.height / (2 * zoom),
          });
        },
        this.cameraConfigs!.returnDuration,
      ),
      train: trainAdapter,
      guide: {
        publish: (target) => this.entryCallbacks.onGuide?.(target),
      },
      onStatus: (snapshot) => {
        if (snapshot.cameraStable) this.releaseEntryChunkTargetLock();
        this.entryCallbacks.onEntryStatus?.(snapshot);
      },
    });
    this.entryCameraRuntime = cameraRuntime;
    this.entryTrainAdapter = trainAdapter;
    this.entryRuntime = entryRuntime;
    const run = entryRuntime.start();
    void run.then((result) => {
      this.entryResult = result;
      if (result.status === "failed" && !this.sceneDestroyed) {
        this.entryCallbacks.onError?.(result.error);
      }
      if (result.status === "completed") {
        this.mapRuntime?.setHudEnabled(true);
        this.maybeStartCameraTestTour();
      }
    });
    return run;
  }

  update(): void {
    if (this.sceneDestroyed) return;
    if (!this.sceneReady) return;
    if (this.moveConfigs === undefined || this.inputConfigs === undefined) return;
    this.routeCrowdRuntime?.update(this.time.now);
    this.staticNpcRuntime?.update();
    this.staticCrowdRuntime?.update();
    this.bugCrowdRuntime?.update(this.time.now);
    this.venueCrowdRuntime?.update();
    this.dancingCrowdRuntime?.update();
    if (document.visibilityState !== "visible") {
      this.stopPlayerMovement();
      return;
    }

    const keys: KeyState = {
      up: this.heldMovementKeys.has("up"),
      down: this.heldMovementKeys.has("down"),
      left: this.heldMovementKeys.has("left"),
      right: this.heldMovementKeys.has("right"),
    };

    const keyboard = keyboardDirection(keys);
    const resolvedDirection = resolveMovement(
      keyboard,
      this.joystick.direction,
      this.joystick.active,
    );
    const playerUpdate = this.playerRuntime?.update(
      resolvedDirection,
      this.time.now,
    );
    const direction =
      playerUpdate === undefined
        ? resolvedDirection
        : playerUpdate.movementDirection;
    if (direction !== null) {
      this.lastDirection = direction;
      const { vx, vy } = velocityForDirection(
        direction, this.inputConfigs.vectors, this.inputConfigs.speed,
      );
      this.player.setVelocity(vx, vy);
      if (blockedInDirection(direction, this.player.body.blocked)) {
        this.player.anims.stop();
        this.player.setFrame(walkFrameStart(direction, this.playerConfigs.animation.walkFrameStart));
      } else {
        this.player.anims.play(
          playerUpdate?.onBeach === true
            ? beachWalkAnimation(direction)
            : `walk-${direction}`,
          true,
        );
      }
    } else {
      this.player.setVelocity(0, 0);
      if (playerUpdate?.visualLocked !== true) {
        this.player.anims.stop();
        this.player.setFrame(walkFrameStart(this.lastDirection, this.playerConfigs.animation.walkFrameStart));
      }
    }

    this.updatePlayerDepth();
    this.updateFactoryRoof();
    this.updateConcertRoof();
    this.updateFootsteps();
    this.bridgeCheckFrames += 1;
    if (this.bridgeCheckFrames >= this.worldConfigs!.bridgeCheckFrames) {
      this.bridgeCheckFrames = 0;
      this.updateBridgeZones();
      this.updateBeachClothing();
    }

    const delta = this.game?.loop?.delta ?? 16.67;
    this.contentUpdateElapsed += delta;
    if (this.zoneConfigs !== undefined &&
        this.contentUpdateElapsed >= this.zoneConfigs.contentUpdateIntervalMs) {
      this.contentUpdateElapsed = 0;
      this.updateContentZones();
    }
    this.chunkUpdateElapsed += delta;
    if (this.chunkConfigs !== undefined &&
        this.chunkUpdateElapsed >= this.chunkConfigs.updateIntervalMs) {
      this.chunkUpdateElapsed = 0;
      this.updateDynamicTargets();
    }
    this.playerVisualInterpolator?.update(this.time.now);
  }

  private createPlayerAndInput(): void {
    const move = this.moveConfigs!;
    const player = this.playerConfigs;
    const offsetX = (player.displaySize - move.body.width) / 2;
    const offsetY = player.displaySize - move.body.height - 4;
    this.player = this.physics.add.sprite(player.spawn.x, player.spawn.y, player.texture);
    this.player.setDisplaySize(player.displaySize, player.displaySize);
    this.player.setCollideWorldBounds(move.collideWorldBounds);
    this.player.body
      .setSize(move.body.width, move.body.height)
      .setOffset(offsetX, offsetY)
      .setDrag(move.drag, move.drag)
      .setMaxVelocity(move.maxVelocity, move.maxVelocity);

    for (const dir of this.inputConfigs!.directions) {
      const range = walkFrameRange(
        dir,
        player.animation.walkFrameStart,
        player.animation.walkFramesPerDirection,
      );
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers(player.texture, range),
        frameRate: player.animation.frameRate,
        repeat: -1,
      });
      // 泳装走路：帧布局与常服完全一致，只是换一张贴图。
      this.anims.create({
        key: beachWalkAnimation(dir),
        frames: this.anims.generateFrameNumbers(player.beach.texture, range),
        frameRate: player.animation.frameRate,
        repeat: -1,
      });
    }
    this.cursors = this.input.keyboard!.createCursorKeys();
    const wasdKeys = this.input.keyboard!.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    this.wasd = {
      up: wasdKeys.W,
      down: wasdKeys.S,
      left: wasdKeys.A,
      right: wasdKeys.D,
    };
    this.joystick = new PhaserVirtualJoystick(
      this as unknown as JoystickSceneLike,
      deviceKindForPhaserScene(this, this.inputConfigs!.device.tabletBreakpoint),
      this.inputConfigs!,
    );
    this.playerRuntime = new PhaserPlayerRuntime(
      this as unknown as PhaserPlayerSceneLike,
      this.player as unknown as PhaserPlayerVisualLike,
      this.playerConfigs,
      {
        now: () => this.time.now,
        effects: {
          resetKeyboard: () => {
            this.heldMovementKeys.clear();
            this.input.keyboard?.resetKeys?.();
          },
          resetJoystick: () => this.joystick.reset(),
          stopMovement: () => this.stopPlayerMovement(),
        },
      },
    );
    this.playerRuntime.createAnimations();
    this.player.setVisible(false);
    this.playerRuntime.disableControls(this.time.now);
    this.playerVisualInterpolator = new PhaserPlayerVisualInterpolator(
      this as unknown as PhaserPlayerVisualSceneLike,
      this.player as unknown as PhaserPlayerVisualSourceLike,
      this.fxConfigs!.playerVisual,
    );
  }

  private campusMapMarkers(): readonly CampusMapMarker[] {
    return Object.freeze(this.zoneConfigs!.markers.map((marker: ZoneMarker) =>
      Object.freeze({
        ...marker,
        label: CONTENT_MARKER_LABELS[marker.menuId],
        kind: marker.menuId.startsWith("memo")
          ? "vortex" as const
          : "sunburn" as const,
        enabled: this.interactConfigs!.visibleMenuIds.includes(marker.menuId),
      }),
    ));
  }

  private createContentFoundation(): void {
    const CAMPUS_MAP_MARKERS = this.campusMapMarkers();
    const domTarget = (id: string): DomModalTarget | undefined => {
      const element = document.getElementById(id);
      return element === null
        ? undefined
        : (element as unknown as DomModalTarget);
    };
    const root = domTarget("content-ui-root");
    const backdrop = domTarget("content-backdrop");
    const modal = domTarget("content-modal");
    const title = domTarget("content-title");
    const body = domTarget("content-body");
    const closeButton = domTarget("content-close");
    const elements: Partial<DomModalElements> = {
      ...(root === undefined ? {} : { root }),
      ...(backdrop === undefined ? {} : { backdrop }),
      ...(modal === undefined ? {} : { modal }),
      ...(title === undefined ? {} : { title }),
      ...(body === undefined ? {} : { body }),
      ...(closeButton === undefined ? {} : { closeButton }),
    };
    const viewport: DomModalViewport = {
      getSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
      subscribeResize: (listener) => {
        const handleResize = (): void => listener();
        window.addEventListener("resize", handleResize);
        window.visualViewport?.addEventListener("resize", handleResize);
        return () => {
          window.removeEventListener("resize", handleResize);
          window.visualViewport?.removeEventListener("resize", handleResize);
        };
      },
    };
    const keyboard: DomModalKeyboard = {
      subscribe: (listener) => {
        const handler = (event: KeyboardEvent): void => listener(event);
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
      },
    };
    const focus: DomModalFocusPort = {
      getActiveElement: () =>
        document.activeElement === null
          ? undefined
          : (document.activeElement as unknown as DomModalTarget),
      focus: (target) => target.focus?.(),
      getFocusableElements: (target) =>
        [...(target as unknown as Element).querySelectorAll(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        )] as unknown as readonly DomModalTarget[],
    };
    const modalUi = new DomModalGameUi(
      elements,
      viewport,
      this.interactConfigs!.modal.desktopMaxHeightRatio,
      this.interactConfigs!.modal.mobileMaxHeightRatio,
      {
      keyboard,
      focus,
      focusRing: "3px solid #facc15",
      },
    );
    const ui = new AppGameUiBridge(modalUi, (visible) => {
      this.mapRuntime?.setContentModalVisible(visible);
      this.entryCallbacks.onModalVisibility?.(visible);
    });
    const lease = new GameplayControlLeaseRuntime({
      disableControls: () => {
        const playerRuntime = this.playerRuntime;
        if (playerRuntime === undefined) return false;
        if (!playerRuntime.control.enabled) return true;
        return playerRuntime.disableControls(this.time.now);
      },
      enableControls: () => {
        const playerRuntime = this.playerRuntime;
        if (playerRuntime === undefined) return false;
        if (playerRuntime.control.enabled) return true;
        return playerRuntime.enableControls(this.time.now);
      },
    });
    const resolver = new CampusContentResolver(this.interactConfigs!.content);
    let zone: ZoneRuntime | undefined;
    const interact = new InteractRuntime({
      resolver,
      ui,
      lease,
      onVisitReceipt: (receipt) => {
        zone?.acceptVisitReceipt(receipt);
      },
    },
    this.interactConfigs!.behavior.pauseGame,
    this.interactConfigs!.behavior.hideOnLeave,
    this.interactConfigs!.behavior.suppressAfterUserClose);
    // Map selections have no physical zone that can emit a leave event.
    // Subscribe after Interact so its successful close is committed first.
    ui.subscribeUserClose((event) => {
      if (!event.residenceId.startsWith("map-residence-") || interact.active !== undefined) return;
      const marker = CAMPUS_MAP_MARKERS.find((item) => item.menuId === event.menuId);
      if (marker !== undefined) interact.handleResidenceEvent({
        markerId: marker.markerId,
        menuId: event.menuId,
        residenceId: event.residenceId,
        phase: "leave",
      });
    });
    zone = new ZoneRuntime({
      markers: this.zoneConfigs!.markers,
      intervalMs: this.zoneConfigs!.intervalMs,
      viewportPadding: this.zoneConfigs!.viewportPadding,
      interactionDistance: this.zoneConfigs!.interactionDistance,
      onResidence: (event) => {
        interact.handleResidenceEvent(event);
      },
    });
    this.contentUi = ui;
    this.contentLeaseRuntime = lease;
    this.interactRuntime = interact;
    this.zoneRuntime = zone;
  }

  private createMapFoundation(): void {
    const CAMPUS_MAP_MARKERS = this.campusMapMarkers();
    const requiredMapElement = (id: string): CampusMapElementLike => {
      const element = document.getElementById(id);
      if (element === null) throw new Error(`missing campus map element: #${id}`);
      return element as unknown as CampusMapElementLike;
    };
    const markerViews = (attribute: string): readonly CampusMapMarkerView[] =>
      CAMPUS_MAP_MARKERS.map((marker) => {
        const element = document.querySelector(
          `[${attribute}="${marker.markerId}"]`,
        );
        if (element === null) {
          throw new Error(`missing campus map marker: ${attribute}=${marker.markerId}`);
        }
        return Object.freeze({
          markerId: marker.markerId,
          element: element as unknown as CampusMapElementLike,
        });
      });
    const runtime = new PhaserCampusMapRuntime({
      worldWidth: this.worldSpec!.worldPixelWidth,
      worldHeight: this.worldSpec!.worldPixelHeight,
      markers: CAMPUS_MAP_MARKERS,
      elements: {
        hud: requiredMapElement("campus-map-hud"),
        openButton: requiredMapElement("campus-map-open"),
        root: requiredMapElement("campus-map-root"),
        backdrop: requiredMapElement("campus-map-backdrop"),
        dialog: requiredMapElement("campus-map-dialog"),
        closeButton: requiredMapElement("campus-map-close"),
        miniPlayer: requiredMapElement("campus-mini-map-player"),
        bigPlayer: requiredMapElement("campus-big-map-player"),
        miniMarkers: markerViews("data-mini-map-marker"),
        bigMarkers: markerViews("data-big-map-marker"),
      },
      onOpen: () => this.acquireMapControlLease(),
      onClose: () => this.releaseMapControlLease(),
      onSelect: (marker) => this.openContentFromMap(marker),
    });
    runtime.update(
      { x: this.player.x, y: this.player.y },
      this.zoneRuntime?.visitedMarkerIds ?? [],
    );
    this.mapRuntime = runtime;
  }

  private acquireMapControlLease(): boolean {
    if (
      this.sceneDestroyed ||
      this.mapLeaseToken !== undefined ||
      this.interactRuntime?.active !== undefined
    ) {
      return false;
    }
    const acquired = this.contentLeaseRuntime?.acquire("map-open");
    if (acquired?.ok !== true) return false;
    this.mapLeaseToken = acquired.token;
    this.entryCallbacks.onModalVisibility?.(true);
    return true;
  }

  private releaseMapControlLease(): void {
    const token = this.mapLeaseToken;
    if (token === undefined) return;
    const released = this.contentLeaseRuntime?.release(token);
    if (
      released?.ok === true ||
      released?.reason === "unknown-token" ||
      released?.reason === "stale-token"
    ) {
      this.mapLeaseToken = undefined;
    } else {
      this.recordSideFailure(`map-lease:${released?.reason ?? "missing-runtime"}`);
    }
    this.entryCallbacks.onModalVisibility?.(false);
  }

  private openContentFromMap(marker: CampusMapMarker): void {
    if (this.sceneDestroyed || !marker.enabled) return;
    const residenceId = `map-residence-${this.nextMapResidenceNumber}`;
    this.nextMapResidenceNumber += 1;
    const result = this.interactRuntime?.handleResidenceEvent({
      markerId: marker.markerId,
      menuId: marker.menuId,
      residenceId,
      phase: "enter",
    });
    if (result !== "shown" && result !== "already-visible") {
      this.recordSideFailure(`map-content:${marker.markerId}:${result ?? "missing"}`);
    }
  }

  private contentZoneSnapshot(): ZoneSnapshot {
    const camera = this.cameras.main;
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0
      ? camera.zoom
      : 1;
    return {
      player: {
        x: this.player.x,
        y: this.player.y,
      },
      viewport: {
        x: camera.scrollX,
        y: camera.scrollY,
        width: camera.width / zoom,
        height: camera.height / zoom,
      },
    };
  }

  private updateContentZones(): void {
    if (this.sceneDestroyed) return;
    this.zoneRuntime?.tick(this.contentZoneSnapshot());
    this.mapRuntime?.update(
      { x: this.player.x, y: this.player.y },
      this.zoneRuntime?.visitedMarkerIds ?? [],
    );
  }

  private contentDebugSnapshot(): unknown {
    const root = document.getElementById("content-ui-root");
    const backdrop = document.getElementById("content-backdrop");
    const modal = document.getElementById("content-modal");
    return {
      active: this.interactRuntime?.active ?? null,
      suppressed: this.interactRuntime?.suppressedResidenceIds ?? [],
      pendingReleases: this.interactRuntime?.pendingReleaseCount ?? 0,
      visited: this.zoneRuntime?.visitedMarkerIds ?? [],
      activeResidenceCount: this.zoneRuntime?.activeResidenceCount ?? 0,
      map: this.mapRuntime?.snapshot ?? null,
      leases: this.contentLeaseRuntime?.activeLeaseCount ?? 0,
      controlsDisabled: this.contentLeaseRuntime?.isDisabled ?? false,
      playerControlEnabled: this.playerRuntime?.control.enabled ?? false,
      ui: {
        rootHidden: root?.hidden ?? true,
        backdropHidden: backdrop?.hidden ?? true,
        modalHidden: modal?.hidden ?? true,
        title: document.getElementById("content-title")?.textContent ?? "",
        body: document.getElementById("content-body")?.textContent ?? "",
        maxHeight: modal?.style.maxHeight ?? "",
      },
    };
  }

  private smokeViewport() {
    const camera = this.cameras.main;
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0
      ? camera.zoom
      : 1;
    return {
      left: camera.scrollX,
      top: camera.scrollY,
      width: camera.width / zoom,
      height: camera.height / zoom,
    };
  }

  private sideDebugSnapshot(): unknown {
    return {
      sprayer: this.sprayerRuntime?.snapshot ?? null,
      sprayerSpriteCount: this.sprayerRuntime?.spriteCount ?? 0,
      sprayerVisuals: this.sprayerRuntime?.visualSnapshots ?? [],
      routeCrowd: this.routeCrowdRuntime?.snapshot ?? null,
      routeCrowdConfigIds: this.routeCrowdRuntime?.configIds ?? [],
      routeCrowdStarted: this.routeCrowdRuntime?.started ?? false,
      routeCrowdTrainStarted: this.routeCrowdRuntime?.trainStarted ?? false,
      routeCrowdSpriteCount: this.routeCrowdRuntime?.spriteCount ?? 0,
      staticNpc: this.staticNpcRuntime?.snapshot ?? null,
      staticNpcSpriteCount: this.staticNpcRuntime?.spriteCount ?? 0,
      staticCrowd: this.staticCrowdRuntime?.snapshot ?? null,
      staticCrowdSpriteCount: this.staticCrowdRuntime?.spriteCount ?? 0,
      train: this.trainRuntime?.snapshot ?? null,
      trainVisual: this.trainRuntime?.visualSnapshot ?? null,
      trainHasSprite: this.trainRuntime?.hasSprite ?? false,
      trainHasCollisionShape: this.trainRuntime?.hasCollisionShape ?? false,
      trainAdapter: this.entryTrainAdapter?.status ?? null,
      trainColliderActive: this.trainColliderActive,
      trainColliderCount: this.trainColliderCount,
      trainCollisionShapeCount: this.trainRuntime?.collisionShapeCount ?? 0,
      trainBlockingCellCount: this.trainBlockingCells.length,
      smoke: this.smokeRuntime?.snapshot ?? null,
      smokeVisual: this.smokeRuntime?.visualSnapshot ?? null,
      smokeHasEmitter: this.smokeRuntime?.hasEmitter ?? false,
      stopAiSmoke: this.stopAiSmokeRuntime?.snapshot ?? null,
      stopAiSmokeEmitterCount: this.stopAiSmokeRuntime?.emitterCount ?? 0,
      fog: this.fogRuntime?.snapshot ?? null,
      fogEmitterCount: this.fogRuntime?.emitterCount ?? 0,
      vehicle: this.vehicleRuntime?.snapshot ?? null,
      failures: Object.freeze([...this.sideFailures]),
    };
  }

  private recordSideFailure(reason: string): void {
    if (this.sideFailures.length >= 20) return;
    this.sideFailures.push(reason);
  }

  private connectPoliceCollisions(): void {
    this.disconnectPoliceCollisions();
    for (const target of this.vehicleRuntime?.policeCollisionTargets ?? []) {
      const collider = this.physics.add.collider(
        this.player,
        target as any,
      ) as { active?: boolean; destroy(): void } | undefined;
      if (collider === undefined) {
        this.recordSideFailure("vehicle:police-collider-create-failed");
        continue;
      }
      this.vehicleColliders.add(collider);
    }
  }

  private disconnectPoliceCollisions(): void {
    for (const collider of this.vehicleColliders) {
      collider.active = false;
      this.physics?.world?.removeCollider?.(collider as any);
      collider.destroy();
    }
    this.vehicleColliders.clear();
  }

  private connectTrainCollision(
    shape: PhaserTrainCollisionShapeLike,
  ): () => void {
    const collider = this.physics.add.collider(
      this.player,
      shape as any,
    ) as { active?: boolean; destroy(): void } | undefined;
    if (collider === undefined) {
      throw new Error("train player collider creation failed");
    }
    this.trainColliderCount += 1;
    this.trainColliderActive = true;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.trainColliderCount = Math.max(0, this.trainColliderCount - 1);
      this.trainColliderActive = this.trainColliderCount > 0;
      collider.active = false;
      this.physics.world.removeCollider?.(collider);
      collider.destroy();
    };
  }

  async shutdownForGeneration(): Promise<CampusSceneShutdownReceipt> {
    return this.beginShutdown();
  }

  private beginShutdown(): Promise<CampusSceneShutdownReceipt> {
    if (this.shutdownTask !== undefined) return this.shutdownTask;
    this.shutdownTask = this.performShutdown().catch((error: unknown) => {
      this.shutdownTask = undefined;
      throw error;
    });
    return this.shutdownTask;
  }

  private async performShutdown(): Promise<CampusSceneShutdownReceipt> {
    this.sceneDestroyed = true;
    this.sceneReady = false;
    this.entryChunkTargetLock = undefined;

    const failures: unknown[] = [];
    const cleanup = (name: string, operation: () => unknown): void => {
      try {
        operation();
      } catch (error) {
        failures.push(error);
        this.recordSideFailure(`cleanup:${name}`);
      }
    };

    const operations: Record<EntityCleanupStep, () => void> = {
      "scene-destroyed": () => {
        this.sceneDestroyed = true;
        this.sceneReady = false;
        this.entryChunkTargetLock = undefined;
      },
      entry: () => cleanup("entry", () => this.entryRuntime?.shutdown()),
      sprayer: () => cleanup("sprayer", () => this.sprayerRuntime?.shutdown()),
      "route-crowd": () => cleanup("route-crowd", () => this.routeCrowdRuntime?.shutdown()),
      "static-npc": () => cleanup("static-npc", () => this.staticNpcRuntime?.shutdown()),
      "static-crowd": () => cleanup("static-crowd", () => this.staticCrowdRuntime?.shutdown()),
      "bug-crowd": () => cleanup("bug-crowd", () => this.bugCrowdRuntime?.shutdown()),
      "venue-crowd": () => cleanup("venue-crowd", () => this.venueCrowdRuntime?.shutdown()),
      "dancing-crowd": () => cleanup("dancing-crowd", () => this.dancingCrowdRuntime?.shutdown()),
      "stop-ai-smoke": () => cleanup("stop-ai-smoke", () => this.stopAiSmokeRuntime?.shutdown()),
      fog: () => cleanup("fog", () => this.fogRuntime?.shutdown()),
      "police-colliders": () => cleanup("police-colliders", () => this.disconnectPoliceCollisions()),
      vehicle: () => cleanup("vehicle", () => this.vehicleRuntime?.shutdown()),
      "factory-smoke": () => cleanup("factory-smoke", () => this.smokeRuntime?.shutdown()),
      train: () => cleanup("train", () => this.trainRuntime?.shutdown(this.time?.now)),
      "entry-camera": () => cleanup("entry-camera", () => this.entryCameraRuntime?.shutdown()),
      "entry-train": () => cleanup("entry-train", () => this.entryTrainAdapter?.shutdown()),
      camera: () => cleanup("camera", () => this.cameraRuntime?.shutdown()),
      "camera-lease": () => cleanup("camera-lease", () => this.releaseCameraControlLease()),
      map: () => cleanup("map", () => this.mapRuntime?.destroy()),
      zone: () => cleanup("zone", () => this.zoneRuntime?.destroy()),
      interact: () => cleanup("interact", () => this.interactRuntime?.destroy()),
      "content-lease": () => cleanup("content-lease", () => this.contentLeaseRuntime?.shutdown()),
      roof: () => cleanup("roof", () => this.stopRoofTweens()),
      footstep: () => cleanup("footstep", () => this.footstepRuntime?.shutdown()),
      player: () => cleanup("player", () => this.playerRuntime?.shutdown()),
      "player-visual": () => cleanup("player-visual", () => this.playerVisualInterpolator?.shutdown()),
      joystick: () => cleanup("joystick", () => this.joystick?.shutdown()),
      movement: () => cleanup("movement", () => this.stopPlayerMovement()),
      scheduler: () => cleanup("scheduler", () => this.mutationScheduler.destroy()),
    };
    let cleanupOrder: readonly EntityCleanupStep[] = [];
    try {
      const entityConfigs = this.entityConfigs ?? await this.loadEntityConfigsOnce();
      this.entityConfigs = entityConfigs;
      cleanupOrder = entityConfigs.cleanupOrder;
    } catch (error) {
      failures.push(error);
    }
    for (const step of cleanupOrder) operations[step]();

    this.entryRuntime = undefined;
    this.entryCameraRuntime = undefined;
    this.entryTrainAdapter = undefined;
    this.cameraRuntime = undefined;
    this.pendingCameraViewport = undefined;
    this.mapRuntime = undefined;
    this.zoneRuntime = undefined;
    this.interactRuntime = undefined;
    this.contentUi = undefined;
    this.contentLeaseRuntime = undefined;
    this.playerVisualInterpolator = undefined;
    cleanup("test-hooks", () => this.clearRuntimeTestHooks());
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );

    this.dynamicWorldShutdown = this.shutdownDynamicWorld();
    try {
      await this.dynamicWorldShutdown;
    } catch (error) {
      failures.push(error);
      this.recordSideFailure("cleanup:dynamic-world");
    }
    try {
      this.scene.stop();
    } catch {
      // A generation can fail during preload before ScenePlugin is active.
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Scene cleanup reported failures");
    }
    const physicsColliderCount =
      (this.physics?.world?.colliders as any)?.getActive?.().length ?? null;
    const receipt = Object.freeze({
      trainColliderActive: this.trainColliderActive,
      trainColliderCount: this.trainColliderCount,
      trainCollisionShapeCount: this.trainRuntime?.collisionShapeCount ?? 0,
      trainBlockingCellCount: this.trainBlockingCells.length,
      trainSpriteActive: this.trainRuntime?.hasSprite ?? false,
      trainCollisionShapeActive: this.trainRuntime?.hasCollisionShape ?? false,
      sprayerSpriteCount: this.sprayerRuntime?.spriteCount ?? 0,
      staticNpcSpriteCount: this.staticNpcRuntime?.spriteCount ?? 0,
      staticCrowdSpriteCount: this.staticCrowdRuntime?.spriteCount ?? 0,
      smokeEmitterActive: this.smokeRuntime?.hasEmitter ?? false,
      footstepActiveCount: this.footstepRuntime?.activeCount ?? 0,
      factoryRoofTweenActive: this.factoryRoofTween !== undefined,
      concertRoofTweenActive: this.concertRoofTween !== undefined,
      mapHudHidden: document.getElementById("campus-map-hud")?.hidden ?? true,
      mapRootHidden: document.getElementById("campus-map-root")?.hidden ?? true,
      mapLeaseActive: this.mapLeaseToken !== undefined,
      sideFailures: Object.freeze([...this.sideFailures]),
      physicsColliderCount,
    });
    this.sprayerRuntime = undefined;
    this.staticNpcRuntime = undefined;
    this.staticCrowdRuntime = undefined;
    this.bugCrowdRuntime = undefined;
    this.venueCrowdRuntime = undefined;
    this.dancingCrowdRuntime = undefined;
    this.stopAiSmokeRuntime = undefined;
    this.fogRuntime = undefined;
    this.vehicleRuntime = undefined;
    this.smokeRuntime = undefined;
    this.trainRuntime = undefined;
    return receipt;
  }

  private createCamera(bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }): void {
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);
    this.player.setCollideWorldBounds(this.moveConfigs!.collideWorldBounds);
    const camera = this.cameras.main;
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.stopFollow();
    const settings = this.cameraConfigs!.settings;
    camera.setZoom(settings.zoom);
    camera.setFollowOffset(settings.followOffsetX, settings.followOffsetY);
    camera.setDeadzone(settings.deadzoneX, settings.deadzoneY);
    camera.centerOn(this.worldConfigs!.entryCameraStart.x,
      this.worldConfigs!.entryCameraStart.y);
    camera.roundPixels = settings.roundPixels;
  }

  private async initializeDynamicWorld(): Promise<void> {
    // NPC 配置在**造这个场景之前**就读好了（见构造函数说明），这里只是取用。
    // 读不到、或者读回来不合规范（缺字段、值超范围），那一步会直接抛——
    // 错误会走到弹错误页。**宁可进不去，也不要拿一份半对的配置把场景糊起来**：
    // 糊起来的表现是「有一部分 NPC 站错地方」，比干脆报错难查得多。
    const npcConfigs = this.npcConfigs;
    [this.chunkConfigs, this.zoneConfigs, this.moveConfigs, this.inputConfigs,
      this.worldConfigs, this.cameraConfigs, this.interactConfigs, this.layerConfigs,
      this.entityConfigs, this.fxConfigs] = await Promise.all([
      this.loadChunkConfigs(),
      this.loadZoneConfigs(),
      this.loadMoveConfigs(),
      this.loadInputConfigs(),
      this.loadWorldConfigs(),
      this.loadCameraConfigs(),
      this.loadInteractConfigs(),
      this.loadLayerConfigs(),
      this.loadEntityConfigsOnce(),
      this.loadFxConfigs(),
    ]);
    this.chunkUpdateElapsed = this.chunkConfigs.updateIntervalMs;
    this.contentUpdateElapsed = this.zoneConfigs.contentUpdateIntervalMs;
    if (this.sceneDestroyed) return;
    const stopAiPlayerPosition = () => {
      const position = this.playerRuntime?.position;
      if (position === undefined || this.player === undefined) return undefined;
      return {
        ...position,
        bodyBottom: (this.player.body as any).bottom as number,
        depth: (this.player as any).depth as number,
      };
    };
    this.smokeRuntime = new PhaserFactorySmokeRuntime(
      this as unknown as PhaserFactorySmokeSceneLike,
      this.fxConfigs.factorySmoke,
      {
        viewport: () => this.smokeViewport(),
        onError: (reason) => this.recordSideFailure(`smoke:${reason}`),
      },
    );
    this.stopAiSmokeRuntime = new PhaserStopAiSmokeRuntime(
      this as unknown as PhaserStopAiSmokeSceneLike,
      this.fxConfigs.stopAiSmoke,
      {
        viewport: () => this.smokeViewport(),
        playerPosition: stopAiPlayerPosition,
        onError: (reason) => this.recordSideFailure(`stop-ai-smoke:${reason}`),
      },
    );
    this.fogRuntime = new PhaserFogRuntime(
      this as unknown as PhaserFogSceneLike,
      this.fxConfigs.fog,
      {
        viewport: () => this.smokeViewport(),
        player: () => {
          const position = this.playerRuntime?.position;
          if (position === undefined || this.player === undefined) return undefined;
          return {
            ...position,
            velocityX: this.player.body.velocity.x,
            velocityY: this.player.body.velocity.y,
          };
        },
        onError: (reason) => this.recordSideFailure(`fog:${reason}`),
      },
    );
    const footstepStrategy = this.layerConfigs.strategiesByName["footsteps"];
    if (footstepStrategy?.markerGids === undefined) {
      throw new Error("SYS-LAYER 缺少 footsteps.markerGids");
    }
    this.footstepRuntime = new PhaserFootstepRuntime(
      this as unknown as PhaserFootstepSceneLike,
      this.fxConfigs.footstep,
      this.layerConfigs.footstepDepth,
      footstepStrategy.markerGids,
    );
    this.footstepRuntime.start();
    const jsonTimeoutMs = this.transportConfigs.timeouts.json;
    this.transportSnapshot = Object.freeze({ jsonTimeoutMs });
    // §17 transport.timeouts.json：超时从这里穿进 fetchJson（不再用模块默认值）。
    const jsonLoader: JsonLoader = (url, signal) =>
      fetchJson(url, signal, jsonTimeoutMs);
    const store = new ChunkDataStore(
      CHUNK_MASTER_URL,
      jsonLoader,
      { maxAttempts: this.chunkConfigs.maxAttempts },
      this.layerConfigs!.strategies,
    );
    this.dataStore = store;
    const master = await store.loadMaster();
    if (this.sceneDestroyed) return;
    this.entryCallbacks.onLoadProgress?.(MASTER_READY_PROGRESS);

    const spec = worldSpecFromMaster(master);
    this.worldSpec = spec;
    this.createPlayerAndInput();
    this.createCamera({
      x: 0,
      y: 0,
      width: spec.worldPixelWidth,
      height: spec.worldPixelHeight,
    });
    this.createContentFoundation();
    this.createMapFoundation();

    const map = this.make.tilemap({
      tileWidth: spec.tileWidthPixels,
      tileHeight: spec.tileHeightPixels,
      width: spec.worldWidthTiles,
      height: spec.worldHeightTiles,
    });
    const exterior = map.addTilesetImage(
      "exterior",
      "exterior",
      spec.tileWidthPixels,
      spec.tileHeightPixels,
      0,
      0,
      tilesetFirstGid(master, "exterior"),
    );
    const collisions = map.addTilesetImage(
      "collisions-objects",
      "collisions-objects",
      spec.tileWidthPixels,
      spec.tileHeightPixels,
      0,
      0,
      tilesetFirstGid(master, "collisions-objects"),
    );
    const particles = map.addTilesetImage(
      "tileset-particles",
      "tileset-particles",
      spec.tileWidthPixels,
      spec.tileHeightPixels,
      0,
      0,
      tilesetFirstGid(master, "tileset-particles"),
    );
    if (!exterior || !collisions || !particles) {
      throw new Error("运行时 tileset 加载失败");
    }
    const tilesets = [exterior, collisions, particles];
    const renderer = new PhaserWorldRenderer(
      map,
      tilesets,
      spec,
      this.layerConfigs!,
      this.worldConfigs.clearLayersPerFrame,
      {
        onCollisionLayerCreated: this.handleCollisionLayerCreated,
        onCollisionLayerDestroyed: this.handleCollisionLayerDestroyed,
        onRoofStateApplied: (state, layers) => {
          this.applyRoofTween(state, layers);
        },
      },
    );
    this.worldRenderer = renderer;
    this.configureInitialCollisionLayers();
    const worldResult = createWorld(spec, {
      layerPlan: this.layerConfigs!.strategies,
      hooks: renderer.hooks(),
    });
    if (worldResult.kind !== "ready") {
      throw new Error(`World 创建失败：${worldResult.reason}`);
    }

    this.coordinator = new ChunkCoordinator(store, worldResult.world, {
      scheduleMutation: this.mutationScheduler.schedule,
    });
    this.entryCallbacks.onLoadProgress?.(WORLD_OWNER_READY_PROGRESS);
    if (this.testHooksEnabled) {
      const debugHook = (): unknown => ({
        state: this.coordinator?.state,
        entryChunkTargetLock: this.entryChunkTargetLock ?? [],
        rendererLayers: renderer.layers.size,
        teardown: renderer.teardownSnapshot,
        markerRecords: renderer.markerRecords.length,
        particles3Diagnostics: renderer.particles3Diagnostics.length,
        rawParticleLayers: [...renderer.layers.keys()].filter(
          (id) => id.startsWith("particles@") || id.startsWith("particles2@"),
        ).length,
        particleTextureLoaded: this.textures.exists("tileset-particles"),
        roofStates: {
          concert: renderer.getRoofState("concert"),
          factory: renderer.getRoofState("factory"),
          factoryInside: this.factoryRoofInside ?? false,
          concertInside: this.concertRoofInside ?? false,
          tweenActive: this.factoryRoofTween !== undefined,
          concertTweenActive: this.concertRoofTween !== undefined,
          layerAlphas: Object.fromEntries(
            [...renderer.layers.entries()]
              .filter(([id]) =>
                id.startsWith("roof_factory@") ||
                id.startsWith("roof_factory2@") ||
                id.startsWith("roof_concert@") ||
                id.startsWith("roof_concert2@"),
              )
              .map(([id, layer]) => [id, (layer as any).alpha ?? null]),
          ),
        },
        footsteps: {
          surfaceMarkerCount: renderer.markerRecords.filter(
            (marker) => marker.layerName === "footsteps",
          ).length,
          activeCount: this.footstepRuntime?.activeCount ?? 0,
          visuals: this.footstepRuntime?.visualSnapshots ?? [],
        },
        collisionLayers: this.collisionColliders.size,
        physicsColliders:
          (this.physics.world.colliders as any).getActive?.().length ?? null,
        player: {
          x: this.player.x,
          y: this.player.y,
          depth: (this.player as any).depth,
          visible: (this.player as any).visible,
          texture: (this.player as any).texture?.key ?? null,
          frame: (this.player as any).frame?.name ?? null,
          animation: (this.player as any).anims?.currentAnim?.key ?? null,
          animationPlaying: (this.player as any).anims?.isPlaying ?? null,
        },
        playerVisual: this.playerVisualInterpolator?.position ?? null,
        playerRuntime: {
          position: this.playerRuntime?.position ?? null,
          control: this.playerRuntime?.control ?? null,
          onBeach: this.playerRuntime?.onBeach ?? null,
          clothingChange: this.playerRuntime?.clothingChange ?? null,
          clothesChange: {
            tileIndex: renderer.tileIndexAtWorld(
              this.worldConfigs!.tileQuery.layer,
              this.player.x,
              this.player.y,
            ),
            lastTileIndex: this.playerLastTileIndex,
          },
        },
        entry: {
          sceneReady: this.sceneReady,
          result: this.entryResult?.status ?? null,
          train: this.entryTrainAdapter?.status ?? null,
          snapshot: this.entryRuntime?.snapshot ?? null,
          leaseCount: this.contentLeaseRuntime?.activeLeaseCount ?? 0,
        },
        cameraRuntime: {
          status: this.cameraRuntime?.status ?? null,
          result: this.cameraRunResult?.status ?? null,
          viewportUpdates: this.cameraViewportUpdates,
          controlDisables: this.cameraControlDisables,
          controlEnables: this.cameraControlEnables,
          pendingViewport: this.pendingCameraViewport ?? null,
          nativeScaleSettings: this.cameraRuntime?.nativeScaleSettings ?? null,
          effectAvailability:
            this.cameraRuntime?.effectAvailability ?? null,
        },
        camera: {
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
          zoom: this.cameras.main.zoom,
          roundPixels: this.cameras.main.roundPixels,
        },
        body: {
          width: this.moveConfigs!.body.width,
          height: this.moveConfigs!.body.height,
          offsetX: (this.playerConfigs.displaySize - this.moveConfigs!.body.width) / 2,
          offsetY: this.playerConfigs.displaySize - this.moveConfigs!.body.height - 4,
          blocked: this.player.body.blocked,
        },
        playerVelocity: {
          x: this.player.body.velocity.x,
          y: this.player.body.velocity.y,
        },
        bridge1DownVisible: this.bridge1DownVisible,
        bridge2DownVisible: this.bridge2DownVisible,
        joystick: this.joystick.debugState(),
        content: this.contentDebugSnapshot(),
        side: this.sideDebugSnapshot(),
      });
      this.debugHook = debugHook;
      (window as any).__campusDebug = debugHook;
      if (new URLSearchParams(window.location.search).has("collision-test")) {
        const collisionTestHook = {
          setPlayerPosition: (x: number, y: number): void => {
            (this.player as any).setPosition(x, y);
          },
        };
        this.collisionTestHook = collisionTestHook;
        (window as any).__campusCollisionTest = collisionTestHook;
      }
      if (new URLSearchParams(window.location.search).has("lifecycle-test")) {
        const lifecycleHook = {
          shutdown: (): Promise<CampusSceneShutdownReceipt> =>
            this.shutdownForGeneration(),
        };
        this.lifecycleTestHook = lifecycleHook;
        (window as any).__campusLifecycleTest = lifecycleHook;
      }
      if (new URLSearchParams(window.location.search).has("content-smoke")) {
        const contentTestHook = {
          setPlayerPosition: (x: number, y: number): void => {
            (this.player as any).setPosition(x, y);
            this.cameras.main.centerOn(x, y);
            this.stopPlayerMovement();
          },
          tick: (): unknown => {
            this.updateContentZones();
            return this.contentDebugSnapshot();
          },
          snapshot: (): unknown => this.contentDebugSnapshot(),
        };
        this.contentTestHook = contentTestHook;
        (window as any).__campusContentTest = contentTestHook;
      }
    }
    const entryGeometry = this.coordinator.store.geometry;
    if (entryGeometry === undefined) {
      throw new Error("入口分块屏障缺少master geometry");
    }
    this.entryChunkTargetLock = this.createEntryChunkTargetLock(entryGeometry);
    this.entryCallbacks.onLoadProgress?.(INITIAL_TARGETS_STARTED_PROGRESS);
    await this.updateDynamicTargetsNow();
    if (this.sceneDestroyed || this.requiredLoadError !== undefined) return;
    this.entryCallbacks.onLoadProgress?.(INITIAL_TARGETS_READY_PROGRESS);
    const failedChunks = this.coordinator?.state.failed ?? [];
    if (failedChunks.length > 0) {
      throw new Error(
        `initial world chunks failed: ${failedChunks
          .map((failure) => `${failure.coordinate.x},${failure.coordinate.y}`)
          .join(";")}`,
      );
    }

    // 喷水器要在这一步才造得出来：它的位置和路线来自 sprayer-configs.json，
    // 而配置是这一步开头才读到的（preload 阶段读不了）。
    this.sprayerRuntime = new PhaserSprayerRuntime(
      this as unknown as PhaserSprayerSceneLike,
      {
        configs: npcConfigs.sprayerConfigs,
        tuning: npcConfigs.tuning.sprayer,
        presentation: npcConfigs.presentation.sprayer,
        playerPosition: () => this.playerRuntime?.position,
        onTriggered: () => {
          if (!this.sceneDestroyed) {
            this.entryCallbacks.onAmbientGuide?.(FACTORY_SMOKE_GUIDE);
          }
        },
        onError: (reason) => this.recordSideFailure(`sprayer:${reason}`),
      },
      this.playerConfigs,
    );
    this.sprayerRuntime.createAnimations();
    const sprayerStarted = this.sprayerRuntime.start(this.time.now);
    if (!sprayerStarted.ok) {
      throw new Error(`sprayer runtime failed: ${sprayerStarted.reason}`);
    }
    const wallData = this.cache.json.get("walls-layer") as { grid?: readonly (readonly number[])[] } | undefined;
    if (wallData?.grid === undefined) throw new Error("route crowd walls grid unavailable");
    // 警车的位置和碰撞尺寸都来自配置——寻路要绕开它们，所以得跟车停的地方是同一份数。
    const policeConfig = this.routeConfigs.vehicle.police;
    const isPoliceBlocked = (point: { readonly x: number; readonly y: number }): boolean =>
      policeConfig.positions.some((police) =>
        Math.abs(point.x - police.x) <= policeConfig.collisionSize.width / 2 + 24 &&
        Math.abs(point.y - police.y) <= policeConfig.collisionSize.height / 2 + 24,
      );
    const pathProvider = new GridRouteCrowdPathProvider(wallData.grid, {
      ...npcConfigs.tuning.path,
      isBlocked: isPoliceBlocked,
    }, this.moveConfigs!.walkableValue, this.moveConfigs!.blockedValue,
    this.moveConfigs!.outOfBoundsIsWalkable);
    this.routeCrowdRuntime = new PhaserRouteCrowdRuntime(
      this as unknown as import("./PhaserRouteCrowdRuntime.js").PhaserRouteCrowdSceneLike, {
      configs: npcConfigs.routeCrowdConfigs,
      tuning: npcConfigs.tuning.routeCrowd,
      presentation: npcConfigs.presentation.routeCrowd,
      pathProvider,
      isBlocked: (point) => isPoliceBlocked(point) || this.trainBlockingCells.includes(
        `${Math.floor(point.x / 16)},${Math.floor(point.y / 16)}`,
      ),
      visualSpacing: {
        minDistance: 56,
        isInScope: (point) => point.x >= 1_200 && point.x <= 1_600 &&
          point.y >= 800 && point.y <= 1_080,
        allowedConfigIdsInScope: ["vertical-crowd-reverse"],
        checkMovement: false,
      },
      viewport: () => ({ left: this.cameras.main.worldView.x, top: this.cameras.main.worldView.y, width: this.cameras.main.worldView.width, height: this.cameras.main.worldView.height }),
      scheduleNextUpdate: (callback) => this.events.once("update", callback),
    }, this.playerConfigs);
    this.staticNpcRuntime = new PhaserStaticNpcRuntime(
      this as unknown as import("./PhaserStaticNpcRuntime.js").PhaserStaticNpcSceneLike,
      {
        viewport: () => ({
          left: this.cameras.main.worldView.x,
          top: this.cameras.main.worldView.y,
          width: this.cameras.main.worldView.width,
          height: this.cameras.main.worldView.height,
        }),
        configs: npcConfigs.staticNpcConfigs,
        viewportMargin: npcConfigs.tuning.staticNpc.viewportMargin,
        presentation: npcConfigs.presentation.staticNpc,
        onError: (reason) => this.recordSideFailure(`static-npc:${reason}`),
      },
    );
    this.staticCrowdRuntime = new PhaserStaticCrowdRuntime(
      this as unknown as import("./PhaserStaticCrowdRuntime.js").PhaserStaticCrowdSceneLike,
      {
        viewport: () => ({
          left: this.cameras.main.worldView.x,
          top: this.cameras.main.worldView.y,
          width: this.cameras.main.worldView.width,
          height: this.cameras.main.worldView.height,
        }),
        crowd: {
          regions: npcConfigs.staticCrowdRegions,
          spritePools: npcConfigs.staticCrowdSpritePools,
          disabledRegionIndexes: npcConfigs.staticCrowdDisabledRegionIndexes,
          tuning: npcConfigs.tuning.staticCrowd,
        },
        presentation: npcConfigs.presentation.staticCrowd,
        // 铁轨带读的是路线人群那份表——铁轨在哪是世界事实，两边共读一处。
        trackBand: npcConfigs.presentation.routeCrowd.trackBand,
        onError: (reason) => this.recordSideFailure(`static-crowd:${reason}`),
      },
      this.playerConfigs,
    );
    const staticNpcStarted = this.staticNpcRuntime.start();
    if (!staticNpcStarted.ok) {
      this.recordSideFailure(`static-npc:${staticNpcStarted.reason}`);
    }
    if (!this.staticCrowdRuntime.start()) {
      this.recordSideFailure("static-crowd:start-failed");
    }
    const vehicleStarted = this.vehicleRuntime?.start(this.time.now);
    if (vehicleStarted === undefined || !vehicleStarted.ok) {
      this.recordSideFailure(`vehicle:${vehicleStarted?.reason ?? "missing-owner"}`);
    } else {
      this.connectPoliceCollisions();
    }
    this.bugCrowdRuntime = new PhaserBugCrowdRuntime(
      this as unknown as import("./PhaserBugCrowdRuntime.js").PhaserBugCrowdSceneLike,
      { config: npcConfigs.bugCrowd, pathProvider, presentation: npcConfigs.presentation.bugCrowd, viewport: () => ({ left: this.cameras.main.worldView.x, top: this.cameras.main.worldView.y, width: this.cameras.main.worldView.width, height: this.cameras.main.worldView.height }), onError: (reason) => this.recordSideFailure(`bug-crowd:${reason}`) },
    );
    if (!this.bugCrowdRuntime.start(this.time.now)) this.recordSideFailure("bug-crowd:start-failed");
    this.venueCrowdRuntime = new PhaserVenueCrowdRuntime(this as unknown as import("./PhaserVenueCrowdRuntime.js").PhaserVenueCrowdSceneLike, () => ({ left: this.cameras.main.worldView.x, top: this.cameras.main.worldView.y, width: this.cameras.main.worldView.width, height: this.cameras.main.worldView.height }), { regions: npcConfigs.venueCrowdRegions, tuning: npcConfigs.tuning.venueCrowd }, npcConfigs.presentation.venueCrowd, this.playerConfigs, Date.now);
    if (!this.venueCrowdRuntime.start()) this.recordSideFailure("venue-crowd:start-failed");
    this.dancingCrowdRuntime = new PhaserDancingCrowdRuntime(this as unknown as import("./PhaserDancingCrowdRuntime.js").PhaserDancingCrowdSceneLike, () => ({ left: this.cameras.main.worldView.x, top: this.cameras.main.worldView.y, width: this.cameras.main.worldView.width, height: this.cameras.main.worldView.height }), npcConfigs.dancingCrowd, npcConfigs.presentation.dancingCrowd);
    if (!this.dancingCrowdRuntime.start()) this.recordSideFailure("dancing-crowd:start-failed");
    const smokeStarted = this.smokeRuntime?.start();
    if (smokeStarted === undefined || !smokeStarted.ok) {
      throw new Error(
        `factory smoke runtime failed: ${smokeStarted?.reason ?? "missing-owner"}`,
      );
    }
    const stopAiSmokeStarted = this.stopAiSmokeRuntime?.start();
    if (stopAiSmokeStarted === undefined || !stopAiSmokeStarted.ok) {
      throw new Error(
        `Stop AI smoke runtime failed: ${stopAiSmokeStarted?.reason ?? "missing-owner"}`,
      );
    }
    const fogStarted = this.fogRuntime?.start();
    if (fogStarted === undefined || !fogStarted.ok) {
      throw new Error(
        `orange smoke fog runtime failed: ${fogStarted?.reason ?? "missing-owner"}`,
      );
    }

    this.entryCallbacks.onLoadProgress?.(1);
    this.sceneReady = true;
    this.entryCallbacks.onReady?.();
    window.setTimeout(() => {
      if (!this.sceneDestroyed) this.routeCrowdRuntime?.start(this.time.now);
    }, 0);
  }

  private loadEntityConfigsOnce(): Promise<EntityConfigs> {
    if (this.entityConfigsPromise === undefined) {
      this.entityConfigsPromise = this.loadEntityConfigs();
      void this.entityConfigsPromise.catch(() => undefined);
    }
    return this.entityConfigsPromise;
  }

  private createEntryCameraRuntime(): PhaserCameraRuntime {
    const playerRuntime = this.playerRuntime;
    if (playerRuntime === undefined) {
      throw new Error("player runtime unavailable for product entry");
    }
    const camera = this.cameras.main;
    return new PhaserCameraRuntime(
      this as unknown as PhaserCameraSceneLike,
      {
        controlGate: {
          disableControls: () => undefined,
          enableControls: () => undefined,
        },
        getPlayerPosition: () => playerRuntime.position,
        startHardFollow: (settings) => {
          camera.startFollow(
            this.playerVisualInterpolator?.sprite ?? this.player,
            true,
            settings.lerpX,
            settings.lerpY,
          );
        },
        nativeScaleProvider: () => window.devicePixelRatio,
        onViewport: (viewport) => {
          this.pendingCameraViewport = viewport;
          this.cameraViewportUpdates += 1;
        },
        warn: () => undefined,
      },
      this.cameraConfigs!,
    );
  }

  private maybeStartCameraTestTour(): void {
    if (
      this.cameraTestHooksEnabled &&
      new URLSearchParams(window.location.search).has("camera-smoke")
    ) {
      this.startCameraTour();
    }
  }

  private startCameraTour(): void {
    const playerRuntime = this.playerRuntime;
    if (playerRuntime === undefined || this.sceneDestroyed) return;

    const camera = this.cameras.main;
    const runtime = new PhaserCameraRuntime(
      this as unknown as PhaserCameraSceneLike,
      {
        controlGate: {
          disableControls: () => this.acquireCameraControlLease(),
          enableControls: () => this.releaseCameraControlLease(),
        },
        getPlayerPosition: () => playerRuntime.position,
        startHardFollow: (settings) => {
          camera.startFollow(
            this.playerVisualInterpolator?.sprite ?? this.player,
            true,
            settings.lerpX,
            settings.lerpY,
          );
        },
        nativeScaleProvider: () => window.devicePixelRatio,
        onViewport: (viewport) => {
          this.pendingCameraViewport = viewport;
          this.cameraViewportUpdates += 1;
        },
      },
      this.cameraConfigs!,
    );
    this.cameraRuntime = runtime;
    const options: CameraRuntimeStartOptions | undefined = this.cameraTestHooksEnabled
      ? {
        sequence: this.cameraConfigs!.sequence.map((point) => ({
          ...point,
          duration: point.duration === 0 ? 0 : this.worldConfigs!.cameraTestTour.duration,
          stayDuration: this.worldConfigs!.cameraTestTour.stayDuration,
        })),
        returnDuration: this.worldConfigs!.cameraTestTour.returnDuration,
      }
      : undefined;
    const run = options === undefined ? runtime.start() : runtime.start(options);
    void run
      .then((result) => {
        this.cameraRunResult = result;
        if (result.status === "failed" && !this.sceneDestroyed) {
          console.error("相机航拍失败", result.error);
        }
      })
      .catch((error: unknown) => {
        if (!this.sceneDestroyed) {
          console.error("相机航拍启动失败", error);
        }
      });
  }

  private acquireCameraControlLease(): void {
    if (this.cameraLeaseToken !== undefined) return;
    const result = this.contentLeaseRuntime?.acquire("camera-tour");
    if (result === undefined || !result.ok) {
      const reason = result?.reason ?? "missing-provider";
      throw new Error(`camera control lease acquire failed: ${reason}`);
    }
    this.cameraLeaseToken = result.token;
    this.cameraControlDisables += 1;
  }

  private releaseCameraControlLease(): void {
    const token = this.cameraLeaseToken;
    if (token === undefined) return;
    const result = this.contentLeaseRuntime?.release(token);
    if (result === undefined) {
      throw new Error("camera control lease provider missing");
    }
    if (!result.ok && result.reason === "enable-failed") {
      throw new Error("camera control lease enable failed");
    }
    this.cameraLeaseToken = undefined;
    this.cameraControlEnables += 1;
  }

  private async shutdownDynamicWorld(): Promise<void> {
    let firstError: unknown;
    const rememberError = (error: unknown): void => {
      if (firstError === undefined) {
        firstError = error;
      }
    };

    try {
      if (this.coordinator !== undefined) {
        await this.coordinator.destroyAsync();
      } else {
        this.dataStore?.destroy();
      }
    } catch (error) {
      rememberError(error);
    }

    try {
      await this.mutationScheduler.waitForActiveIdle();
    } catch (error) {
      rememberError(error);
    }

    try {
      await this.worldRenderer?.destroyAsync();
    } catch (error) {
      rememberError(error);
    }

    this.coordinator = undefined;
    this.worldRenderer = undefined;
    this.dataStore = undefined;

    if (firstError !== undefined) {
      throw firstError;
    }
  }

  private readonly handleCollisionLayerCreated = (
    name: string,
    layer: TilemapLayerLike,
  ): void => {
    if (this.sceneDestroyed || this.collisionColliders.has(layer) ||
        !this.moveConfigs!.collisionLayerNames.includes(name)) {
      return;
    }
    const collider = this.physics.add.collider(
      this.player,
      layer as any,
    ) as { destroy(): void } | undefined;
    if (collider !== undefined) {
      this.collisionColliders.set(layer, collider);
    }
  };

  private waitForColliderRemoval(collider: { destroy(): void }): Promise<void> {
    const colliders = this.physics.world.colliders as any;
    const isActive = (): boolean =>
      colliders.getActive?.().includes(collider) ?? false;
    if (!isActive()) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = (): void => {
        if (!isActive()) {
          resolve();
          return;
        }
        if (Date.now() - startedAt >= 2_000) {
          reject(new Error("timed out removing Phaser collider"));
          return;
        }
        setTimeout(check, 0);
      };
      setTimeout(check, 0);
    });
  }

  private readonly handleCollisionLayerDestroyed = async (
    _name: string,
    layer: TilemapLayerLike,
  ): Promise<void> => {
    const collider = this.collisionColliders.get(layer);
    if (collider !== undefined) {
      (collider as any).active = false;
      this.physics?.world?.removeCollider?.(collider);
      collider.destroy();
      await this.waitForColliderRemoval(collider);
    }
    this.collisionColliders.delete(layer);
  };

  private clearRuntimeTestHooks(): void {
    const runtime = window as any;
    if (
      this.debugHook !== undefined &&
      runtime.__campusDebug === this.debugHook
    ) {
      delete runtime.__campusDebug;
    }
    if (
      this.collisionTestHook !== undefined &&
      runtime.__campusCollisionTest === this.collisionTestHook
    ) {
      delete runtime.__campusCollisionTest;
    }
    if (
      this.lifecycleTestHook !== undefined &&
      runtime.__campusLifecycleTest === this.lifecycleTestHook
    ) {
      delete runtime.__campusLifecycleTest;
    }
    if (
      this.contentTestHook !== undefined &&
      runtime.__campusContentTest === this.contentTestHook
    ) {
      delete runtime.__campusContentTest;
    }
    this.debugHook = undefined;
    this.collisionTestHook = undefined;
    this.lifecycleTestHook = undefined;
    this.contentTestHook = undefined;
  }

  private configureInitialCollisionLayers(): void {
    const renderer = this.worldRenderer;
    if (renderer === undefined) {
      return;
    }
    renderer.setCollisionLayerEnabled("walls", true);
    renderer.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge1.down, true);
    renderer.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge1.up, false);
    renderer.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge2.down, true);
    renderer.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge2.up, false);
  }

  private setBridge1DownVisible(value: boolean): void {
    this.bridge1DownVisible = value;
    this.worldRenderer?.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge1.down, value);
    this.worldRenderer?.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge1.up, !value);
    this.updatePlayerDepth();
  }

  private setBridge2DownVisible(value: boolean): void {
    this.bridge2DownVisible = value;
    this.worldRenderer?.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge2.down, value);
    this.worldRenderer?.setCollisionLayerEnabled(this.layerConfigs!.bridges.bridge2.up, !value);
    this.updatePlayerDepth();
  }

  private updatePlayerDepth(): void {
    if (this.player === undefined) {
      return;
    }
    const bridgeIsRaised =
      !this.bridge1DownVisible || !this.bridge2DownVisible;
    this.player.setDepth(
      bridgeIsRaised
        ? this.layerConfigs!.bridgePlayerDepth
        : this.playerDepthForY(this.player.y),
    );
  }

  private playerDepthForY(worldY: number): number {
    const config = this.layerConfigs!.playerDepth;
    return playerDepth(worldY, config.base, config.yOffset, config.ratio);
  }

  private updateBridgeZones(): void {
    const tileX = Math.floor(this.player.x / 16);
    const tileY = Math.floor(this.player.y / 16);
    const inBridge1Entry = isBridge1EntryZone(
      tileX,
      tileY,
      this.layerConfigs!.bridgeZones.bridge1.entry,
    );
    const inBridge1Exit = isBridge1ExitZone(
      tileX,
      tileY,
      this.layerConfigs!.bridgeZones.bridge1.exit,
    );
    const inBridge1ExitTrigger = inBridge1Exit && !inBridge1Entry;
    const inBridge2 = isBridge2Zone(
      tileX,
      tileY,
      this.layerConfigs!.bridgeZones.bridge2.zones,
    );

    if (
      inBridge1Entry &&
      !this.playerWasInBridge1EntryZone &&
      this.bridge1DownVisible
    ) {
      this.setBridge1DownVisible(false);
    } else if (
      inBridge1ExitTrigger &&
      !this.playerWasInBridge1ExitZone &&
      !this.bridge1DownVisible
    ) {
      this.setBridge1DownVisible(true);
    }
    if (inBridge2 && !this.playerWasInBridge2Zone) {
      this.setBridge2DownVisible(!this.bridge2DownVisible);
    }

    this.playerWasInBridge1EntryZone = inBridge1Entry;
    this.playerWasInBridge1ExitZone = inBridge1ExitTrigger;
    this.playerWasInBridge2Zone = inBridge2;
  }

  /**
   * 沙滩换装。原站每 3 帧查一次玩家脚下的瓦片编号（`wallLayer.getTileAtWorldXY`）：
   * 踩到 GID 69353 就脱衣换泳装；离开后再踩回 69353 时穿回常服。
   *
   * 「该穿」的判断要求「上一次巡检时脚下是 69353」，这是离开沙滩的边沿条件——
   * 否则玩家一脱下泳装就会被立刻判定为「不在沙滩」而反复换装。
   */
  private updateBeachClothing(): void {
    const renderer = this.worldRenderer;
    const runtime = this.playerRuntime;
    if (renderer === undefined || runtime === undefined) return;

    const tileIndex = renderer.tileIndexAtWorld(
      this.worldConfigs!.tileQuery.layer,
      this.player.x,
      this.player.y,
    );
    const onBeachTile = isBeachTriggerTile(tileIndex, this.playerConfigs.beachTriggerGid);
    const changing = runtime.clothingChange !== null;

    if (onBeachTile && !runtime.onBeach && !changing) {
      runtime.beginClothingChange("undressing", this.time.now);
    } else if (
      !onBeachTile &&
      tileIndex !== this.layerConfigs!.collisionGidForced &&
      runtime.onBeach &&
      !changing &&
      this.playerLastTileIndex === this.playerConfigs.beachTriggerGid
    ) {
      runtime.beginClothingChange("dressing", this.time.now);
    }

    this.playerLastTileIndex = tileIndex;
  }

  private stopPlayerMovement(): void {
    if (this.player === undefined || this.player.body === undefined) {
      return;
    }
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setFrame(walkFrameStart(this.lastDirection, this.playerConfigs.animation.walkFrameStart));
  }

  private updateFactoryRoof(): void {
    this.updateRoofGroup("factory", this.layerConfigs!.roofZones.factory);
  }

  private updateConcertRoof(): void {
    this.updateRoofGroup("concert", this.layerConfigs!.roofZones.concert);
  }

  private updateRoofGroup(
    group: RoofGroupState["group"],
    bounds: Readonly<{
      readonly left: number;
      readonly right: number;
      readonly top: number;
      readonly bottom: number;
    }>,
  ): void {
    const renderer = this.worldRenderer;
    if (renderer === undefined) return;
    const inside =
      this.player.x >= bounds.left &&
      this.player.x <= bounds.right &&
      this.player.y >= bounds.top &&
      this.player.y <= bounds.bottom;
    const previous = group === "factory"
      ? this.factoryRoofInside
      : this.concertRoofInside;
    if (inside === previous) return;
    if (group === "factory") this.factoryRoofInside = inside;
    else this.concertRoofInside = inside;
    renderer.setRoofState(group, inside ? "faded" : "visible");
  }

  private updateFootsteps(): void {
    const runtime = this.footstepRuntime;
    if (runtime === undefined) return;
    runtime.update(
      this.time.now,
      {
        x: this.player.x,
        y: this.player.y,
        depth: (this.player as any).depth ?? this.playerDepthForY(this.player.y),
        velocityX: this.player.body.velocity.x,
        velocityY: this.player.body.velocity.y,
        controlsEnabled: this.playerRuntime?.control.enabled ?? false,
        teleporting: false,
      },
      this.worldRenderer?.markerRecords ?? [],
    );
  }

  private applyRoofTween(
    state: RoofGroupState,
    layers: readonly TilemapLayerLike[],
  ): void {
    this.stopRoofTween(state.group);
    if (layers.length === 0) return;
    let tween: RoofTweenHandle | undefined;
    tween = this.tweens.add({
      targets: [...layers],
      alpha: state.alpha,
      duration: state.durationMs,
      ease: this.layerConfigs!.roofTweenEase,
      onComplete: () => {
        if (this.getRoofTween(state.group) === tween) {
          this.setRoofTween(state.group, undefined);
        }
      },
    }) as RoofTweenHandle;
    this.setRoofTween(state.group, tween);
  }

  private getRoofTween(
    group: RoofGroupState["group"],
  ): RoofTweenHandle | undefined {
    return group === "factory"
      ? this.factoryRoofTween
      : this.concertRoofTween;
  }

  private setRoofTween(
    group: RoofGroupState["group"],
    tween: RoofTweenHandle | undefined,
  ): void {
    if (group === "factory") this.factoryRoofTween = tween;
    else this.concertRoofTween = tween;
  }

  private stopRoofTween(group: RoofGroupState["group"]): void {
    const tween = this.getRoofTween(group);
    tween?.stop?.();
    tween?.remove?.();
    this.setRoofTween(group, undefined);
  }

  private stopRoofTweens(): void {
    this.stopRoofTween("factory");
    this.stopRoofTween("concert");
  }

  private updateDynamicTargets(): void {
    void this.updateDynamicTargetsNow().catch((error: unknown) => {
      console.error("动态分块更新失败", error);
    });
  }

  private releaseEntryChunkTargetLock(): void {
    if (this.entryChunkTargetLock === undefined) return;
    this.entryChunkTargetLock = undefined;
    void this.updateDynamicTargetsNow().catch((error: unknown) => {
      if (!this.sceneDestroyed) {
        console.error("入口分块屏障释放失败", error);
      }
    });
  }

  private createEntryChunkTargetLock(
    geometry: ChunkGeometry,
  ): readonly ChunkCoordinate[] {
    const targets: Array<readonly ChunkCoordinate[]> = [];
    const centers = [
      this.worldConfigs!.entryCameraStart,
      Object.freeze({
        x: this.fxConfigs?.factorySmoke.x ?? 0,
        y: this.fxConfigs?.factorySmoke.y ?? 0,
      }),
      this.playerConfigs.spawn,
    ];
    for (let segment = 1; segment < centers.length; segment += 1) {
      const from = centers[segment - 1]!;
      const to = centers[segment]!;
      for (let index = 0; index <= this.worldConfigs!.entryCorridorSamples; index += 1) {
        const progress = index / this.worldConfigs!.entryCorridorSamples;
        const centerX = from.x + (to.x - from.x) * progress;
        const centerY = from.y + (to.y - from.y) * progress;
        targets.push(
          targetChunks(
            this.playerConfigs.spawn.x,
            this.playerConfigs.spawn.y,
            {
              scrollX: centerX - LOGICAL_VIEWPORT_WIDTH / 2,
              scrollY: centerY - LOGICAL_VIEWPORT_HEIGHT / 2,
              width: LOGICAL_VIEWPORT_WIDTH,
              height: LOGICAL_VIEWPORT_HEIGHT,
              zoom: this.cameraConfigs!.settings.zoom,
            },
            geometry,
            this.chunkConfigs!.playerNeighborhoodRadius,
            this.chunkConfigs!.cameraPadding,
          ),
        );
      }
    }
    return mergeChunkTargets(...targets);
  }

  private async updateDynamicTargetsNow(): Promise<void> {
    const coordinator = this.coordinator;
    const geometry = coordinator?.store.geometry;
    const spec = this.worldSpec;
    if (
      coordinator === undefined ||
      geometry === undefined ||
      spec === undefined ||
      this.sceneDestroyed
    ) {
      return;
    }

    const camera = this.cameras.main;
    const viewport: CameraViewport =
      this.pendingCameraViewport ?? {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        width: camera.width,
        height: camera.height,
        zoom: camera.zoom,
      };
    this.pendingCameraViewport = undefined;
    const playerPosition = this.playerRuntime?.position ?? {
      x: this.player.x,
      y: this.player.y,
    };
    const currentTargets = targetChunks(
      playerPosition.x,
      playerPosition.y,
      {
        ...viewport,
        width: LOGICAL_VIEWPORT_WIDTH,
        height: LOGICAL_VIEWPORT_HEIGHT,
      },
      geometry,
      this.chunkConfigs!.playerNeighborhoodRadius,
      this.chunkConfigs!.cameraPadding,
    );
    await coordinator.updateTargets(
      this.entryChunkTargetLock === undefined
        ? currentTargets
        : mergeChunkTargets(currentTargets, this.entryChunkTargetLock),
    );
    if (this.sceneReady && !this.sceneDestroyed) {
      await coordinator.retryFailedTargets();
    }
    await this.mutationScheduler.waitForIdle();
  }
}

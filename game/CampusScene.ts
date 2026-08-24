import Phaser from "./phaser.js";

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
  DIRECTIONS,
  keyboardDirection,
  resolveMovement,
  type Direction,
  type KeyState,
} from "../src/input/index.js";
import {
  COLLIDE_WORLD_BOUNDS,
  PLAYER_BODY_HEIGHT,
  PLAYER_BODY_OFFSET_X,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_BODY_WIDTH,
  PLAYER_DRAG,
  PLAYER_MAX_VELOCITY,
  blockedInDirection,
  velocityForDirection,
} from "../src/move/index.js";
import {
  ANIMATION_FRAME_RATE,
  DEFAULT_FACING,
  DISPLAY_SIZE,
  SPAWN_X,
  SPAWN_Y,
  WALK_FRAMES_PER_DIRECTION,
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
  CAMERA_BOUNDS,
  CAMERA_SEQUENCE,
  CAMERA_ZOOM,
  FOLLOW_LERP,
  type CameraRunResult,
  type CameraRuntimeStartOptions,
} from "../src/camera/index.js";
import { FACTORY_SMOKE_CONFIG } from "../src/fx/index.js";
import {
  type ContentMenuId,
  type GameUiPort,
  type GameplayControlLeaseToken,
} from "../src/content/contract.js";
import { isVisibleContentMenuId } from "../src/content/index.js";
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
import { createCampusContentResolver } from "./CampusContentResolver.js";
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
  type PhaserSprayerSceneLike,
} from "./PhaserSprayerRuntime.js";
import {
  PhaserFactorySmokeRuntime,
  type PhaserFactorySmokeSceneLike,
} from "./PhaserFactorySmokeRuntime.js";
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
  BRIDGE_PLAYER_DEPTH,
  BRIDGES,
  LAYER_STRATEGIES,
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

const CHUNK_MASTER_URL = "/maps/chunks/master.json";
const PHASER_ASSET_PROGRESS_WEIGHT = 0.72;
const MASTER_READY_PROGRESS = 0.8;
const WORLD_OWNER_READY_PROGRESS = 0.88;
const INITIAL_TARGETS_STARTED_PROGRESS = 0.92;
const INITIAL_TARGETS_READY_PROGRESS = 0.98;
const CHUNK_UPDATE_INTERVAL_MS = 500;
const CONTENT_UPDATE_INTERVAL_MS = 100;
const LOGICAL_VIEWPORT_WIDTH = 480;
const LOGICAL_VIEWPORT_HEIGHT = 270;
const ENTRY_CORRIDOR_SAMPLES = 6;
const ENTRY_CAMERA_START = Object.freeze({ x: 944, y: 928 });
const FACTORY_ROOF_BOUNDS = Object.freeze({
  left: 112,
  right: 640,
  top: 736,
  bottom: 1_152,
});
const CONCERT_ROOF_BOUNDS = Object.freeze({
  left: 1_632,
  right: 2_208,
  top: 384,
  bottom: 848,
});
type RoofTweenHandle = { stop?(): unknown; remove?(): unknown };
const CONTENT_MARKERS: readonly ZoneMarker[] = Object.freeze([
  { markerId: "about", menuId: "about", x: 944, y: 768 },
  { markerId: "cv", menuId: "cv", x: 480, y: 1776 },
  { markerId: "projects", menuId: "projects", x: 1264, y: 1264 },
  { markerId: "contact", menuId: "contact", x: 1664, y: 2016 },
  { markerId: "tech", menuId: "tech", x: 260, y: 990 },
  { markerId: "memo1", menuId: "memo1", x: 1760, y: 1280 },
  { markerId: "memo2", menuId: "memo2", x: 208, y: 2096 },
  { markerId: "memo3", menuId: "memo3", x: 1952, y: 1696 },
  { markerId: "memo4", menuId: "memo4", x: 2096, y: 208 },
  { markerId: "memo5", menuId: "memo5", x: 1808, y: 624 },
  { markerId: "memo6", menuId: "memo6", x: 496, y: 176 },
]);
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
const CAMPUS_MAP_MARKERS: readonly CampusMapMarker[] = Object.freeze(
  CONTENT_MARKERS.map((marker) =>
    Object.freeze({
      ...marker,
      label: CONTENT_MARKER_LABELS[marker.menuId],
      kind: marker.menuId.startsWith("memo")
        ? "vortex" as const
        : "sunburn" as const,
      enabled: isVisibleContentMenuId(marker.menuId),
    }),
  ),
);
const CAMERA_TEST_HOOK_START_OPTIONS: CameraRuntimeStartOptions = Object.freeze({
  sequence: CAMERA_SEQUENCE.map((point) =>
    Object.freeze({
      ...point,
      duration: point.duration === 0 ? 0 : 200,
      stayDuration: 100,
    }),
  ),
  returnDuration: 200,
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

const MOVEMENT_KEY_BY_CODE = new Map<string, keyof KeyState>([
  ["ArrowUp", "up"],
  ["KeyW", "up"],
  ["ArrowDown", "down"],
  ["KeyS", "down"],
  ["ArrowLeft", "left"],
  ["KeyA", "left"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
]);

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
  readonly trainBlockingCellCount: number;
  readonly trainSpriteActive: boolean;
  readonly trainCollisionShapeActive: boolean;
  readonly sprayerSpriteCount: number;
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

async function fetchJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response =
    signal === undefined ? await fetch(url) : await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`请求 ${url} 失败：HTTP ${response.status}`);
  }
  return response.json();
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
  private smokeRuntime: PhaserFactorySmokeRuntime | undefined;
  private footstepRuntime: PhaserFootstepRuntime | undefined;
  private mapRuntime: PhaserCampusMapRuntime | undefined;
  private mapLeaseToken: GameplayControlLeaseToken | undefined;
  private nextMapResidenceNumber = 1;
  private factoryRoofInside: boolean | undefined;
  private concertRoofInside: boolean | undefined;
  private factoryRoofTween: RoofTweenHandle | undefined;
  private concertRoofTween: RoofTweenHandle | undefined;
  private trainColliderActive = false;
  private trainBlockingCells: readonly string[] = Object.freeze([]);
  private readonly sideFailures: string[] = [];
  private shutdownTask: Promise<CampusSceneShutdownReceipt> | undefined;
  private sceneReady = false;
  private requiredLoadError: Error | undefined;
  private contentLeaseRuntime: GameplayControlLeaseRuntime | undefined;
  private contentUi: GameUiPort | undefined;
  private interactRuntime: InteractRuntime | undefined;
  private zoneRuntime: ZoneRuntime | undefined;
  private contentUpdateElapsed = CONTENT_UPDATE_INTERVAL_MS;
  private joystick!: PhaserVirtualJoystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private lastDirection: Direction = DEFAULT_FACING;
  private coordinator: ChunkCoordinator | undefined;
  private worldRenderer: PhaserWorldRenderer | undefined;
  private dataStore: ChunkDataStore | undefined;
  private dynamicWorldShutdown: Promise<void> | undefined;
  private worldSpec: WorldSpec | undefined;
  private entryChunkTargetLock: readonly ChunkCoordinate[] | undefined;
  private chunkUpdateElapsed = CHUNK_UPDATE_INTERVAL_MS;
  private bridgeCheckFrames = 0;
  private bridge1DownVisible = true;
  private bridge2DownVisible = true;
  private playerWasInBridge1EntryZone = false;
  private playerWasInBridge1ExitZone = false;
  private playerWasInBridge2Zone = false;
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
  private readonly heldMovementKeys = new Set<keyof KeyState>();
  private readonly mutationScheduler = new PhaserWorldMutationScheduler();

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = MOVEMENT_KEY_BY_CODE.get(event.code);
    if (key !== undefined) {
      this.heldMovementKeys.add(key);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = MOVEMENT_KEY_BY_CODE.get(event.code);
    if (key !== undefined) {
      this.heldMovementKeys.delete(key);
    }
  };

  private readonly handleWindowBlur = (): void => {
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

  constructor(
    private readonly entryCallbacks: CampusSceneEntryCallbacks = {},
  ) {
    super("campus");
  }

  preload(): void {
    this.load.on("progress", (progress: number) => {
      this.entryCallbacks.onLoadProgress?.(
        Math.max(0, Math.min(1, progress)) * PHASER_ASSET_PROGRESS_WEIGHT,
      );
    });
    this.load.once("loaderror", (file: { readonly key?: unknown }) => {
      const key = typeof file?.key === "string" ? file.key : "required asset";
      this.requiredLoadError = new Error(`required asset failed: ${key}`);
      this.entryCallbacks.onError?.(this.requiredLoadError);
    });
    this.sprayerRuntime = new PhaserSprayerRuntime(
      this as unknown as PhaserSprayerSceneLike,
      {
        playerPosition: () => this.playerRuntime?.position,
        onTriggered: () => {
          if (!this.sceneDestroyed) {
            this.entryCallbacks.onAmbientGuide?.(FACTORY_SMOKE_GUIDE);
          }
        },
        onError: (reason) => this.recordSideFailure(`sprayer:${reason}`),
      },
    );
    this.trainRuntime = new PhaserTrainRuntime(
      this as unknown as PhaserTrainSceneLike,
      {
        blockingZone: {
          setTrainBlockingZone: (cells) => {
            this.trainBlockingCells = Object.freeze([...(cells ?? [])]);
          },
        },
        connectCollision: (shape) => this.connectTrainCollision(shape),
        onComplete: () => {
          if (!this.sceneDestroyed) {
            this.entryCallbacks.onAmbientGuide?.(TRACKSIDE_SPRAYER_GUIDE);
          }
        },
        onError: (reason) => this.recordSideFailure(`train:${reason}`),
      },
    );
    this.smokeRuntime = new PhaserFactorySmokeRuntime(
      this as unknown as PhaserFactorySmokeSceneLike,
      {
        viewport: () => this.smokeViewport(),
        onError: (reason) => this.recordSideFailure(`smoke:${reason}`),
      },
    );
    this.sprayerRuntime.preload();
    this.trainRuntime.preload();
    this.smokeRuntime.preload();

    this.load.image("exterior", "/maps/exterior-final.webp");
    this.load.image("collisions-objects", "/maps/collisions-objects.png");
    this.load.image("tileset-particles", "/maps/tileset-particles.png");
    this.load.spritesheet("player", "/sprites/player.webp", {
      frameWidth: 48,
      frameHeight: 48,
    });
    preloadPhaserPlayerRuntimeAssets(this.load);
  }

  create(): void {
    this.createPlayerAndInput();
    this.createCamera(CAMERA_BOUNDS);
    this.createContentFoundation();
    this.createMapFoundation();
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
      const { vx, vy } = velocityForDirection(direction);
      this.player.setVelocity(vx, vy);
      if (blockedInDirection(direction, this.player.body.blocked)) {
        this.player.anims.stop();
        this.player.setFrame(walkFrameStart(direction));
      } else {
        this.player.anims.play(`walk-${direction}`, true);
      }
    } else {
      this.player.setVelocity(0, 0);
      if (playerUpdate?.visualLocked !== true) {
        this.player.anims.stop();
        this.player.setFrame(walkFrameStart(this.lastDirection));
      }
    }

    this.updatePlayerDepth();
    this.updateFactoryRoof();
    this.updateConcertRoof();
    this.updateFootsteps();
    this.bridgeCheckFrames += 1;
    if (this.bridgeCheckFrames >= 3) {
      this.bridgeCheckFrames = 0;
      this.updateBridgeZones();
    }

    const delta = this.game?.loop?.delta ?? 16.67;
    this.contentUpdateElapsed += delta;
    if (this.contentUpdateElapsed >= CONTENT_UPDATE_INTERVAL_MS) {
      this.contentUpdateElapsed = 0;
      this.updateContentZones();
    }
    this.chunkUpdateElapsed += delta;
    if (this.chunkUpdateElapsed >= CHUNK_UPDATE_INTERVAL_MS) {
      this.chunkUpdateElapsed = 0;
      this.updateDynamicTargets();
    }
    this.playerVisualInterpolator?.update(this.time.now);
  }

  private createPlayerAndInput(): void {
    this.player = this.physics.add.sprite(SPAWN_X, SPAWN_Y, "player");
    this.player.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
    this.player.setCollideWorldBounds(COLLIDE_WORLD_BOUNDS);
    this.player.body
      .setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT)
      .setOffset(PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y)
      .setDrag(PLAYER_DRAG, PLAYER_DRAG)
      .setMaxVelocity(PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY);

    for (const dir of DIRECTIONS) {
      const start = walkFrameStart(dir);
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers("player", {
          start,
          end: start + WALK_FRAMES_PER_DIRECTION - 1,
        }),
        frameRate: ANIMATION_FRAME_RATE,
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
      deviceKindForPhaserScene(this),
    );
    this.playerRuntime = new PhaserPlayerRuntime(
      this as unknown as PhaserPlayerSceneLike,
      this.player as unknown as PhaserPlayerVisualLike,
      {
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
    );
    this.footstepRuntime = new PhaserFootstepRuntime(
      this as unknown as PhaserFootstepSceneLike,
    );
    this.footstepRuntime.start();
  }

  private createContentFoundation(): void {
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
    const modalUi = new DomModalGameUi(elements, viewport, {
      keyboard,
      focus,
      focusRing: "3px solid #facc15",
    });
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
    const resolver = createCampusContentResolver();
    let zone: ZoneRuntime | undefined;
    const interact = new InteractRuntime({
      resolver,
      ui,
      lease,
      onVisitReceipt: (receipt) => {
        zone?.acceptVisitReceipt(receipt);
      },
    });
    zone = new ZoneRuntime({
      markers: CONTENT_MARKERS,
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
      worldWidth: CAMERA_BOUNDS.width,
      worldHeight: CAMERA_BOUNDS.height,
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
      train: this.trainRuntime?.snapshot ?? null,
      trainVisual: this.trainRuntime?.visualSnapshot ?? null,
      trainHasSprite: this.trainRuntime?.hasSprite ?? false,
      trainHasCollisionShape: this.trainRuntime?.hasCollisionShape ?? false,
      trainAdapter: this.entryTrainAdapter?.status ?? null,
      trainColliderActive: this.trainColliderActive,
      trainBlockingCellCount: this.trainBlockingCells.length,
      smoke: this.smokeRuntime?.snapshot ?? null,
      smokeVisual: this.smokeRuntime?.visualSnapshot ?? null,
      smokeHasEmitter: this.smokeRuntime?.hasEmitter ?? false,
      failures: Object.freeze([...this.sideFailures]),
    };
  }

  private recordSideFailure(reason: string): void {
    if (this.sideFailures.length >= 20) return;
    this.sideFailures.push(reason);
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
    this.trainColliderActive = true;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.trainColliderActive = false;
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
    this.shutdownTask = this.performShutdown();
    return this.shutdownTask;
  }

  private async performShutdown(): Promise<CampusSceneShutdownReceipt> {
    this.sceneDestroyed = true;
    this.sceneReady = false;
    this.entryChunkTargetLock = undefined;

    this.entryRuntime?.shutdown();
    this.sprayerRuntime?.shutdown();
    this.smokeRuntime?.shutdown();
    this.trainRuntime?.shutdown(this.time?.now);
    this.entryRuntime = undefined;
    this.entryCameraRuntime = undefined;
    this.entryTrainAdapter = undefined;

    this.cameraRuntime?.shutdown();
    this.releaseCameraControlLease();
    this.cameraRuntime = undefined;
    this.pendingCameraViewport = undefined;

    this.mapRuntime?.destroy();
    this.zoneRuntime?.destroy();
    this.interactRuntime?.destroy();
    this.contentLeaseRuntime?.shutdown();
    this.mapRuntime = undefined;
    this.zoneRuntime = undefined;
    this.interactRuntime = undefined;
    this.contentUi = undefined;
    this.contentLeaseRuntime = undefined;

    this.stopRoofTweens();
    this.footstepRuntime?.shutdown();
    this.playerRuntime?.shutdown();
    this.playerVisualInterpolator?.shutdown();
    this.playerVisualInterpolator = undefined;
    this.joystick?.shutdown();
    this.stopPlayerMovement();
    this.mutationScheduler.destroy();
    this.clearRuntimeTestHooks();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );

    this.dynamicWorldShutdown = this.shutdownDynamicWorld();
    await this.dynamicWorldShutdown;
    try {
      this.scene.stop();
    } catch {
      // A generation can fail during preload before ScenePlugin is active.
    }
    const physicsColliderCount =
      (this.physics?.world?.colliders as any)?.getActive?.().length ?? null;
    const receipt = Object.freeze({
      trainColliderActive: this.trainColliderActive,
      trainBlockingCellCount: this.trainBlockingCells.length,
      trainSpriteActive: this.trainRuntime?.hasSprite ?? false,
      trainCollisionShapeActive: this.trainRuntime?.hasCollisionShape ?? false,
      sprayerSpriteCount: this.sprayerRuntime?.spriteCount ?? 0,
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
    this.player.setCollideWorldBounds(COLLIDE_WORLD_BOUNDS);
    const camera = this.cameras.main;
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.stopFollow();
    camera.setZoom(CAMERA_ZOOM);
    camera.setFollowOffset(0, 0);
    camera.setDeadzone(0, 0);
    camera.centerOn(ENTRY_CAMERA_START.x, ENTRY_CAMERA_START.y);
    camera.roundPixels = true;
  }

  private async initializeDynamicWorld(): Promise<void> {
    const store = new ChunkDataStore(
      CHUNK_MASTER_URL,
      fetchJson as JsonLoader,
      { maxAttempts: 2 },
    );
    this.dataStore = store;
    const master = await store.loadMaster();
    if (this.sceneDestroyed) return;
    this.entryCallbacks.onLoadProgress?.(MASTER_READY_PROGRESS);

    const spec = worldSpecFromMaster(master);
    this.worldSpec = spec;
    this.createCamera({
      x: 0,
      y: 0,
      width: spec.worldPixelWidth,
      height: spec.worldPixelHeight,
    });

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
      LAYER_STRATEGIES,
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
    const worldResult = createWorld(spec, { hooks: renderer.hooks() });
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
        },
        playerVisual: this.playerVisualInterpolator?.position ?? null,
        playerRuntime: {
          position: this.playerRuntime?.position ?? null,
          control: this.playerRuntime?.control ?? null,
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
          width: PLAYER_BODY_WIDTH,
          height: PLAYER_BODY_HEIGHT,
          offsetX: PLAYER_BODY_OFFSET_X,
          offsetY: PLAYER_BODY_OFFSET_Y,
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

    this.sprayerRuntime?.createAnimations();
    const sprayerStarted = this.sprayerRuntime?.start(this.time.now);
    if (sprayerStarted === undefined || !sprayerStarted.ok) {
      throw new Error(
        `sprayer runtime failed: ${sprayerStarted?.reason ?? "missing-owner"}`,
      );
    }
    const smokeStarted = this.smokeRuntime?.start();
    if (smokeStarted === undefined || !smokeStarted.ok) {
      throw new Error(
        `factory smoke runtime failed: ${smokeStarted?.reason ?? "missing-owner"}`,
      );
    }

    this.entryCallbacks.onLoadProgress?.(1);
    this.sceneReady = true;
    this.entryCallbacks.onReady?.();
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
    );
    this.cameraRuntime = runtime;
    const options = this.cameraTestHooksEnabled
      ? CAMERA_TEST_HOOK_START_OPTIONS
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
    _name: string,
    layer: TilemapLayerLike,
  ): void => {
    if (this.sceneDestroyed || this.collisionColliders.has(layer)) {
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
    renderer.setCollisionLayerEnabled(BRIDGES.bridge1.down, true);
    renderer.setCollisionLayerEnabled(BRIDGES.bridge1.up, false);
    renderer.setCollisionLayerEnabled(BRIDGES.bridge2.down, true);
    renderer.setCollisionLayerEnabled(BRIDGES.bridge2.up, false);
  }

  private setBridge1DownVisible(value: boolean): void {
    this.bridge1DownVisible = value;
    this.worldRenderer?.setCollisionLayerEnabled(BRIDGES.bridge1.down, value);
    this.worldRenderer?.setCollisionLayerEnabled(BRIDGES.bridge1.up, !value);
    this.updatePlayerDepth();
  }

  private setBridge2DownVisible(value: boolean): void {
    this.bridge2DownVisible = value;
    this.worldRenderer?.setCollisionLayerEnabled(BRIDGES.bridge2.down, value);
    this.worldRenderer?.setCollisionLayerEnabled(BRIDGES.bridge2.up, !value);
    this.updatePlayerDepth();
  }

  private updatePlayerDepth(): void {
    if (this.player === undefined) {
      return;
    }
    const bridgeIsRaised =
      !this.bridge1DownVisible || !this.bridge2DownVisible;
    this.player.setDepth(
      bridgeIsRaised ? BRIDGE_PLAYER_DEPTH : playerDepth(this.player.y),
    );
  }

  private updateBridgeZones(): void {
    const tileX = Math.floor(this.player.x / 16);
    const tileY = Math.floor(this.player.y / 16);
    const inBridge1Entry = isBridge1EntryZone(tileX, tileY);
    const inBridge1Exit = isBridge1ExitZone(tileX, tileY);
    const inBridge1ExitTrigger = inBridge1Exit && !inBridge1Entry;
    const inBridge2 = isBridge2Zone(tileX, tileY);

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

  private stopPlayerMovement(): void {
    if (this.player === undefined || this.player.body === undefined) {
      return;
    }
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setFrame(walkFrameStart(this.lastDirection));
  }

  private updateFactoryRoof(): void {
    this.updateRoofGroup("factory", FACTORY_ROOF_BOUNDS);
  }

  private updateConcertRoof(): void {
    this.updateRoofGroup("concert", CONCERT_ROOF_BOUNDS);
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
        depth: (this.player as any).depth ?? playerDepth(this.player.y),
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
      ease: "Power2",
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
      ENTRY_CAMERA_START,
      Object.freeze({
        x: FACTORY_SMOKE_CONFIG.x,
        y: FACTORY_SMOKE_CONFIG.y,
      }),
      Object.freeze({ x: SPAWN_X, y: SPAWN_Y }),
    ];
    for (let segment = 1; segment < centers.length; segment += 1) {
      const from = centers[segment - 1]!;
      const to = centers[segment]!;
      for (let index = 0; index <= ENTRY_CORRIDOR_SAMPLES; index += 1) {
        const progress = index / ENTRY_CORRIDOR_SAMPLES;
        const centerX = from.x + (to.x - from.x) * progress;
        const centerY = from.y + (to.y - from.y) * progress;
        targets.push(
          targetChunks(
            SPAWN_X,
            SPAWN_Y,
            {
              scrollX: centerX - LOGICAL_VIEWPORT_WIDTH / 2,
              scrollY: centerY - LOGICAL_VIEWPORT_HEIGHT / 2,
              width: LOGICAL_VIEWPORT_WIDTH,
              height: LOGICAL_VIEWPORT_HEIGHT,
              zoom: CAMERA_ZOOM,
            },
            geometry,
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
    );
    await coordinator.updateTargets(
      this.entryChunkTargetLock === undefined
        ? currentTargets
        : mergeChunkTargets(currentTargets, this.entryChunkTargetLock),
    );
    await this.mutationScheduler.waitForIdle();
  }
}

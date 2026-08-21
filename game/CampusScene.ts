import Phaser from "./phaser.js";

import {
  ChunkCoordinator,
  ChunkDataStore,
  targetChunks,
  tilesetFirstGid,
  type CameraViewport,
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
  CAMERA_BOUNDS,
  CAMERA_ZOOM,
  FOLLOW_LERP,
} from "../src/camera/index.js";
import {
  BRIDGE_PLAYER_DEPTH,
  BRIDGES,
  LAYER_STRATEGIES,
  isBridge1EntryZone,
  isBridge1ExitZone,
  isBridge2Zone,
  playerDepth,
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
const CHUNK_UPDATE_INTERVAL_MS = 500;
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
  private joystick!: PhaserVirtualJoystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private lastDirection: Direction = DEFAULT_FACING;
  private coordinator: ChunkCoordinator | undefined;
  private renderer: PhaserWorldRenderer | undefined;
  private dataStore: ChunkDataStore | undefined;
  private dynamicWorldShutdown: Promise<void> | undefined;
  private worldSpec: WorldSpec | undefined;
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
  private debugHook: (() => unknown) | undefined;
  private collisionTestHook:
    | { setPlayerPosition(x: number, y: number): void }
    | undefined;
  private lifecycleTestHook:
    | { shutdown(): Promise<void> }
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

  constructor() {
    super("campus");
  }

  preload(): void {
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
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.events.once("shutdown", () => {
      this.sceneDestroyed = true;
      this.playerRuntime?.shutdown();
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
      void this.dynamicWorldShutdown.catch((error: unknown) => {
        console.error("动态世界销毁失败", error);
      });
    });
    void this.initializeDynamicWorld().catch((error: unknown) => {
      if (!this.sceneDestroyed) {
        console.error("动态世界初始化失败", error);
      }
    });
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
    this.bridgeCheckFrames += 1;
    if (this.bridgeCheckFrames >= 3) {
      this.bridgeCheckFrames = 0;
      this.updateBridgeZones();
    }

    const delta = this.game?.loop?.delta ?? 16.67;
    this.chunkUpdateElapsed += delta;
    if (this.chunkUpdateElapsed >= CHUNK_UPDATE_INTERVAL_MS) {
      this.chunkUpdateElapsed = 0;
      this.updateDynamicTargets();
    }
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
    this.playerRuntime.enableControls(this.time.now);
  }

  private createCamera(bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }): void {
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);
    this.player.setCollideWorldBounds(COLLIDE_WORLD_BOUNDS);
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, FOLLOW_LERP, FOLLOW_LERP);
    this.cameras.main.roundPixels = true;
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
      },
    );
    this.renderer = renderer;
    this.configureInitialCollisionLayers();
    const worldResult = createWorld(spec, { hooks: renderer.hooks() });
    if (worldResult.kind !== "ready") {
      throw new Error(`World 创建失败：${worldResult.reason}`);
    }

    this.coordinator = new ChunkCoordinator(store, worldResult.world, {
      scheduleMutation: this.mutationScheduler.schedule,
    });
    if (this.testHooksEnabled) {
      const debugHook = (): unknown => ({
        state: this.coordinator?.state,
        rendererLayers: renderer.layers.size,
        markerRecords: renderer.markerRecords.length,
        particles3Diagnostics: renderer.particles3Diagnostics.length,
        rawParticleLayers: [...renderer.layers.keys()].filter(
          (id) => id.startsWith("particles@") || id.startsWith("particles2@"),
        ).length,
        particleTextureLoaded: this.textures.exists("tileset-particles"),
        roofStates: {
          concert: renderer.getRoofState("concert"),
          factory: renderer.getRoofState("factory"),
        },
        collisionLayers: this.collisionColliders.size,
        physicsColliders:
          (this.physics.world.colliders as any).getActive?.().length ?? null,
        player: {
          x: this.player.x,
          y: this.player.y,
          depth: (this.player as any).depth,
        },
        playerRuntime: {
          position: this.playerRuntime?.position ?? null,
          control: this.playerRuntime?.control ?? null,
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
          shutdown: async (): Promise<void> => {
            this.scene.stop();
            while (!this.sceneDestroyed) {
              await new Promise<void>((resolve) => setTimeout(resolve, 0));
            }
            await this.dynamicWorldShutdown;
          },
        };
        this.lifecycleTestHook = lifecycleHook;
        (window as any).__campusLifecycleTest = lifecycleHook;
      }
    }
    this.updateDynamicTargets();
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
      await this.renderer?.destroyAsync();
    } catch (error) {
      rememberError(error);
    }

    this.coordinator = undefined;
    this.renderer = undefined;
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
    if (this.sceneDestroyed) {
      return Promise.resolve();
    }
    const colliders = this.physics.world.colliders as any;
    const isActive = (): boolean =>
      colliders.getActive?.().includes(collider) ?? false;
    if (!isActive()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const check = (): void => {
        if (!isActive()) {
          resolve();
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
    this.debugHook = undefined;
    this.collisionTestHook = undefined;
    this.lifecycleTestHook = undefined;
  }

  private configureInitialCollisionLayers(): void {
    const renderer = this.renderer;
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
    this.renderer?.setCollisionLayerEnabled(BRIDGES.bridge1.down, value);
    this.renderer?.setCollisionLayerEnabled(BRIDGES.bridge1.up, !value);
    this.updatePlayerDepth();
  }

  private setBridge2DownVisible(value: boolean): void {
    this.bridge2DownVisible = value;
    this.renderer?.setCollisionLayerEnabled(BRIDGES.bridge2.down, value);
    this.renderer?.setCollisionLayerEnabled(BRIDGES.bridge2.up, !value);
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

  private updateDynamicTargets(): void {
    const coordinator = this.coordinator;
    const geometry = coordinator?.store.geometry;
    const spec = this.worldSpec;
    if (
      coordinator === undefined ||
      geometry === undefined ||
      spec === undefined
    ) {
      return;
    }
    if (this.sceneDestroyed) return;

    const camera = this.cameras.main;
    const viewport: CameraViewport = {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      width: camera.width,
      height: camera.height,
      zoom: camera.zoom,
    };
    const playerPosition = this.playerRuntime?.position ?? {
      x: this.player.x,
      y: this.player.y,
    };
    void coordinator
      .updateTargets(
        targetChunks(playerPosition.x, playerPosition.y, viewport, geometry),
      )
      .catch((error: unknown) => {
        console.error("动态分块更新失败", error);
      });
  }
}

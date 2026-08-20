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
  type Direction,
  type KeyState,
} from "../src/input/index.js";
import { velocityForDirection } from "../src/move/index.js";
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
  CAMERA_BOUNDS,
  CAMERA_ZOOM,
  FOLLOW_LERP,
} from "../src/camera/index.js";
import { LAYER_STRATEGIES, playerDepth } from "../src/layer/index.js";
import { createWorld, worldSpecFromMaster, type WorldSpec } from "../src/world/index.js";
import { PhaserWorldMutationScheduler } from "./PhaserWorldMutationScheduler.js";
import { PhaserWorldRenderer } from "./PhaserWorldRenderer.js";

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

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`请求 ${url} 失败：HTTP ${response.status}`);
  }
  return response.json();
}

export class CampusScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private lastDirection: Direction = DEFAULT_FACING;
  private coordinator: ChunkCoordinator | undefined;
  private worldSpec: WorldSpec | undefined;
  private chunkUpdateElapsed = CHUNK_UPDATE_INTERVAL_MS;
  private sceneDestroyed = false;
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
    this.heldMovementKeys.clear();
    this.input.keyboard?.resetKeys?.();
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
    this.load.spritesheet("player", "/sprites/player.webp", {
      frameWidth: 48,
      frameHeight: 48,
    });
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
      this.stopPlayerMovement();
      this.coordinator?.destroy();
      this.mutationScheduler.destroy();
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
      window.removeEventListener("blur", this.handleWindowBlur);
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
    });
    void this.initializeDynamicWorld();
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

    const direction = keyboardDirection(keys);
    if (direction) {
      this.lastDirection = direction;
      const { vx, vy } = velocityForDirection(direction);
      this.player.setVelocity(vx, vy);
      this.player.anims.play(`walk-${direction}`, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setFrame(walkFrameStart(this.lastDirection));
    }

    this.player.setDepth(playerDepth(this.player.y));

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
  }

  private createCamera(bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }): void {
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);
    this.player.setCollideWorldBounds(true);
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
    if (!exterior || !collisions) {
      throw new Error("运行时 tileset 加载失败");
    }
    const tilesets = [exterior, collisions];
    const renderer = new PhaserWorldRenderer(
      map,
      tilesets,
      spec,
      LAYER_STRATEGIES,
    );
    const worldResult = createWorld(spec, { hooks: renderer.hooks() });
    if (worldResult.kind !== "ready") {
      throw new Error(`World 创建失败：${worldResult.reason}`);
    }

    this.coordinator = new ChunkCoordinator(store, worldResult.world, {
      scheduleMutation: this.mutationScheduler.schedule,
    });
    (window as any).__campusDebug = (): unknown => ({
      state: this.coordinator?.state,
      rendererLayers: renderer.layers.size,
    });
    this.updateDynamicTargets();
  }

  private stopPlayerMovement(): void {
    this.player?.setVelocity(0, 0);
    this.player?.anims.stop();
    this.player?.setFrame(walkFrameStart(this.lastDirection));
  }

  private updateDynamicTargets(): void {
    const coordinator = this.coordinator;
    const geometry = coordinator?.store.geometry;
    const spec = this.worldSpec;
    if (coordinator === undefined || geometry === undefined || spec === undefined) {
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
    void coordinator
      .updateTargets(
        targetChunks(this.player.x, this.player.y, viewport, geometry),
      )
      .catch((error: unknown) => {
        console.error("动态分块更新失败", error);
      });
  }
}

import Phaser from "./phaser.js";

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

export class CampusScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private lastDirection: Direction = DEFAULT_FACING;

  constructor() {
    super("campus");
  }

  preload(): void {
    this.load.tilemapTiledJSON("map", "/maps/final_map.json");
    this.load.image("exterior", "/maps/exterior-final.webp");
    this.load.image("collisions-objects", "/maps/collisions-objects.png");
    this.load.spritesheet("player", "/sprites/player.webp", {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create(): void {
    const map = this.make.tilemap({ key: "map" });
    const exterior = map.addTilesetImage("exterior", "exterior");
    const collisions = map.addTilesetImage(
      "collisions-objects",
      "collisions-objects",
    );
    if (!exterior) {
      throw new Error("tileset「exterior」加载失败");
    }
    const tilesets = collisions ? [exterior, collisions] : [exterior];

    // 视觉层：layer1–5 在玩家之下，layer6–10 在玩家之上（SYS-LAYER 深度策略）。
    for (const strategy of LAYER_STRATEGIES) {
      if (strategy.role !== "visual") continue;
      const layer = map.createLayer(strategy.name, tilesets, 0, 0);
      if (!layer) continue;
      layer.setDepth(strategy.depth ?? 0);
    }

    // 玩家出生（SYS-PLAYER：出生点、贴图、显示尺寸）。
    this.player = this.physics.add.sprite(SPAWN_X, SPAWN_Y, "player");
    this.player.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);

    // 物理世界边界 = 地图像素尺寸。否则 setCollideWorldBounds 默认按窗口大小，
    // 玩家会被困在初始视野里，出现“看不见的墙”。
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.player.setCollideWorldBounds(true);

    // 走路动画（SYS-PLAYER 帧映射：每方向 8 帧）。
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
    // 输入：方向键 + WASD 合并（SYS-INPUT）。
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

    // 相机（SYS-CAMERA：边界/缩放/硬跟随/像素取整）。
    this.cameras.main.setBounds(
      CAMERA_BOUNDS.x,
      CAMERA_BOUNDS.y,
      CAMERA_BOUNDS.width,
      CAMERA_BOUNDS.height,
    );
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, FOLLOW_LERP, FOLLOW_LERP);
    this.cameras.main.roundPixels = true;
  }

  update(): void {
    const keys: KeyState = {
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
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
      // 静止帧 = 最后朝向的首帧（SYS-PLAYER：保持朝向，而非写死朝南）。
      this.player.setFrame(walkFrameStart(this.lastDirection));
    }

    // 动态深度（SYS-LAYER：越往下越靠前）。
    this.player.setDepth(playerDepth(this.player.y));
  }
}

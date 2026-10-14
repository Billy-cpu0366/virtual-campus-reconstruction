import type { Direction } from "../src/input/index.js";
import {
  PlayerRuntimeStateMachine,
  type ClothingChange,
  type IdleAnimation,
  type PlayerControlEffects,
  type PlayerControlSnapshot,
  type PlayerPositionSnapshot,
  type PlayerRuntimeAvailability,
  type PlayerRuntimeOptions,
  type PlayerStatus,
  type PlayerUpdateResult,
  walkFrameStart,
} from "../src/player/index.js";
import type { PlayerConfigs } from "../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";

export interface PhaserPlayerTextureManagerLike {
  exists(key: string): boolean;
}

export interface PhaserPlayerLoaderLike {
  spritesheet(
    key: string,
    url: string,
    config: {
      readonly frameWidth: number;
      readonly frameHeight: number;
      readonly startFrame: number;
      readonly endFrame: number;
    },
  ): unknown;
}

export interface PhaserPlayerAnimationConfig {
  readonly key: string;
  readonly frames: readonly unknown[];
  readonly frameRate: number;
  readonly repeat: number;
}

export interface PhaserPlayerAnimationManagerLike {
  generateFrameNumbers(
    key: string,
    range: { readonly start: number; readonly end: number },
  ): readonly unknown[];
  create(config: PhaserPlayerAnimationConfig): unknown;
  exists?(key: string): boolean;
}

export interface PhaserPlayerAnimationControllerLike {
  play(key: string, ignoreIfPlaying?: boolean): unknown;
  stop?(): unknown;
}

export interface PhaserPlayerVisualLike {
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly displayOriginX?: number;
  readonly displayOriginY?: number;
  readonly body?: {
    readonly width: number;
    readonly height: number;
    readonly offset: { readonly x: number; readonly y: number };
    setSize(width: number, height: number, center?: boolean): unknown;
    setOffset(x: number, y: number): unknown;
  };
  readonly x: number;
  readonly y: number;
  readonly anims: PhaserPlayerAnimationControllerLike;
  setTexture(key: string, frame?: string | number): this;
  setDisplaySize(width: number, height: number): this;
  setFrame(frame: number): this;
  on?(
    event: string,
    listener: (...args: unknown[]) => void,
    context?: unknown,
  ): this;
  off?(
    event: string,
    listener: (...args: unknown[]) => void,
    context?: unknown,
  ): this;
}

export interface PhaserPlayerSceneLike {
  readonly load: PhaserPlayerLoaderLike;
  readonly anims: PhaserPlayerAnimationManagerLike;
  readonly textures?: PhaserPlayerTextureManagerLike;
}

export interface PhaserPlayerRuntimeOptions
  extends Omit<PlayerRuntimeOptions, "effects"> {
  readonly effects?: PlayerControlEffects;
}

export function preloadPhaserPlayerRuntimeAssets(
  loader: PhaserPlayerLoaderLike,
  playerConfigs: PlayerConfigs,
): void {
  for (const texture of playerConfigs.idle.textures) {
    loader.spritesheet(texture.key, texture.url, {
      frameWidth: playerConfigs.idle.assetFrames.frameWidth,
      frameHeight: playerConfigs.idle.assetFrames.frameHeight,
      startFrame: playerConfigs.idle.assetFrames.startFrame,
      endFrame: playerConfigs.idle.assetFrames.endFrame,
    });
  }
}

function animationKeyFromEvent(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    typeof value.key === "string"
  ) {
    return value.key;
  }
  return undefined;
}

export class PhaserPlayerRuntime {
  private readonly bodyShape: { width: number; height: number; left: number; top: number } | undefined;
  private readonly state: PlayerRuntimeStateMachine;
  private readonly createdAnimations = new Set<string>();
  private animationListenerInstalled = false;
  private renderedStatus: PlayerStatus | undefined;
  private renderedIdleAnimation: IdleAnimation | undefined;
  private renderedClothingChange: ClothingChange | undefined;
  private pendingMovementDirection: Direction | undefined;
  private shutdownState = false;

  private readonly handleAnimationComplete = (...args: unknown[]): void => {
    const key = animationKeyFromEvent(args[0]);
    const animationKeys = this.playerConfigs.idle.animationKeys;
    if (key === animationKeys.sittingDown) {
      if (this.state.completeSittingDown()) {
        this.renderedStatus = "sitting";
        this.sprite.setFrame(this.playerConfigs.idle.assetFrames.endFrame);
      }
      return;
    }
    if (key === animationKeys.standingUp) {
      const pending = this.state.completeStandingUp();
      if (pending !== null) {
        this.pendingMovementDirection = pending;
        this.renderedStatus = undefined;
        this.restoreNormalPlayer();
      }
      return;
    }
    if (key === this.playerConfigs.clothing.undressAnimationKey ||
        key === this.playerConfigs.clothing.dressAnimationKey) {
      if (this.state.completeClothingChange()) {
        this.renderedStatus = undefined;
        this.renderedIdleAnimation = undefined;
        this.restoreNormalPlayer();
      }
      return;
    }
    if (
      key === animationKeys.eating ||
      key === animationKeys.scratching ||
      key === animationKeys["tying-shoe"]
    ) {
      if (this.state.completeIdleAnimation()) {
        this.renderedStatus = undefined;
        this.renderedIdleAnimation = undefined;
        this.restoreNormalPlayer();
      }
    }
  };

  constructor(
    private readonly scene: PhaserPlayerSceneLike,
    private readonly sprite: PhaserPlayerVisualLike,
    private readonly playerConfigs: PlayerConfigs,
    options: PhaserPlayerRuntimeOptions = {},
  ) {
    const { effects, ...stateOptions } = options;
    const runtimeOptions: PlayerRuntimeOptions =
      effects === undefined ? stateOptions : { ...stateOptions, effects };
    this.state = new PlayerRuntimeStateMachine(playerConfigs, runtimeOptions);
    const body = sprite.body;
    this.bodyShape = body === undefined ? undefined : {
      width: body.width,
      height: body.height,
      left: (sprite.scaleX ?? 1) * (body.offset.x - (sprite.displayOriginX ?? 0)),
      top: (sprite.scaleY ?? 1) * (body.offset.y - (sprite.displayOriginY ?? 0)),
    };
  }

  preload(): void {
    if (this.shutdownState) return;
    preloadPhaserPlayerRuntimeAssets(this.scene.load, this.playerConfigs);
  }

  createAnimations(): void {
    if (this.shutdownState) return;
    this.installAnimationListener();
    const frames = this.playerConfigs.idle.assetFrames;
    for (const idleAnimation of this.playerConfigs.idle.animations) {
      const texture = this.idleTexture(idleAnimation);
      const key = this.playerConfigs.idle.animationKeys[idleAnimation];
      this.createAnimationIfAvailable(
        texture,
        key,
        frames.startFrame,
        frames.endFrame,
        5,
      );
    }
    const sittingTexture = this.idleTexture("sitting");
    this.createAnimationIfAvailable(
      sittingTexture,
      this.playerConfigs.idle.animationKeys.sittingDown,
      frames.startFrame,
      frames.endFrame,
      16,
    );
    this.createAnimationIfAvailable(
      sittingTexture,
      this.playerConfigs.idle.animationKeys.standingUp,
      frames.endFrame,
      frames.startFrame,
      16,
    );
    // 沙滩换装：同一张 16 帧贴图，脱衣正向播、穿衣倒放。
    this.createAnimationIfAvailable(
      this.playerConfigs.clothing.offTexture,
      this.playerConfigs.clothing.undressAnimationKey,
      this.playerConfigs.clothing.frameRange.start,
      this.playerConfigs.clothing.frameRange.end,
      this.playerConfigs.clothing.frameRate,
    );
    this.createAnimationIfAvailable(
      this.playerConfigs.clothing.offTexture,
      this.playerConfigs.clothing.dressAnimationKey,
      this.playerConfigs.clothing.frameRange.end,
      this.playerConfigs.clothing.frameRange.start,
      this.playerConfigs.clothing.frameRate,
    );
  }

  enableControls(nowMs?: number): boolean {
    if (this.shutdownState) return false;
    this.installAnimationListener();
    const enabled =
      nowMs === undefined
        ? this.state.enableControls()
        : this.state.enableControls(nowMs);
    this.pendingMovementDirection = undefined;
    this.renderedStatus = undefined;
    this.renderedIdleAnimation = undefined;
    this.restoreNormalPlayer();
    return enabled;
  }

  disableControls(nowMs?: number): boolean {
    if (this.shutdownState) return false;
    const disabled =
      nowMs === undefined
        ? this.state.disableControls()
        : this.state.disableControls(nowMs);
    this.pendingMovementDirection = undefined;
    this.clearAnimationListener();
    this.renderedStatus = undefined;
    this.renderedIdleAnimation = undefined;
    this.restoreNormalPlayer();
    return disabled;
  }

  reset(nowMs?: number): boolean {
    if (this.shutdownState) return false;
    const reset =
      nowMs === undefined ? this.state.reset() : this.state.reset(nowMs);
    this.pendingMovementDirection = undefined;
    this.renderedStatus = undefined;
    this.renderedIdleAnimation = undefined;
    this.restoreNormalPlayer();
    if (this.state.control.enabled) this.installAnimationListener();
    return reset;
  }

  blur(nowMs?: number): boolean {
    return this.reset(nowMs);
  }

  shutdown(): boolean {
    if (this.shutdownState) return false;
    this.shutdownState = true;
    this.pendingMovementDirection = undefined;
    const shutdown = this.state.shutdown();
    this.clearAnimationListener();
    this.renderedStatus = undefined;
    this.renderedIdleAnimation = undefined;
    return shutdown;
  }

  update(direction: Direction | null, nowMs?: number): PlayerUpdateResult {
    let movementInput = direction;
    if (movementInput === null && this.pendingMovementDirection !== undefined) {
      movementInput = this.pendingMovementDirection;
      this.pendingMovementDirection = undefined;
    } else if (movementInput !== null) {
      this.pendingMovementDirection = undefined;
    }

    const availability = this.availableAnimations();
    const result =
      nowMs === undefined
        ? this.state.update(movementInput, undefined, availability)
        : this.state.update(movementInput, nowMs, availability);
    this.state.setPosition(this.sprite.x, this.sprite.y);

    if (result.status === "walking") {
      if (this.renderedStatus !== "walking") this.restoreNormalPlayer();
      this.renderedStatus = "walking";
      return result;
    }
    if (result.status === "normal-idle" || result.status === "disabled") {
      if (this.renderedStatus !== result.status) this.restoreNormalPlayer();
      this.renderedStatus = result.status;
      return result;
    }
    if (result.status === "idle-action") {
      if (result.idleAnimation !== null && this.renderIdleAction(result.idleAnimation)) {
        return result;
      }
      return this.recoverFromMissingAnimation(nowMs);
    }
    if (result.status === "sitting-down") {
      if (this.renderSitting(false)) return result;
      return this.recoverFromMissingAnimation(nowMs);
    }
    if (result.status === "sitting") {
      if (this.hasTexture("player-sitting")) {
        this.renderedStatus = "sitting";
        this.sprite.setFrame(15);
        return result;
      }
      return this.recoverFromMissingAnimation(nowMs);
    }
    if (result.status === "standing-up") {
      if (this.renderSitting(true)) return result;
      const pending =
        nowMs === undefined
          ? this.state.completeStandingUp()
          : this.state.completeStandingUp(nowMs);
      if (pending !== null) this.pendingMovementDirection = pending;
      this.renderedStatus = undefined;
      this.restoreNormalPlayer();
      return this.snapshotResult(null);
    }
    if (result.status === "changing-clothes") {
      if (this.renderClothingChange(result.clothingChange)) return result;
      // 贴图或动画缺失：跳过动画直接落到目标着装，别把玩家卡在换装中（照原站兜底）。
      const change = result.clothingChange ?? "undressing";
      if (nowMs === undefined) this.state.skipClothingChange(change);
      else this.state.skipClothingChange(change, nowMs);
      this.renderedStatus = undefined;
      this.renderedIdleAnimation = undefined;
      this.restoreNormalPlayer();
      return this.snapshotResult(null);
    }
    return result;
  }

  get position(): PlayerPositionSnapshot {
    return Object.freeze({ x: this.sprite.x, y: this.sprite.y });
  }

  get control(): PlayerControlSnapshot {
    return this.state.control;
  }

  get status(): PlayerStatus {
    return this.state.status;
  }

  /** 身上是不是沙滩装。 */
  get onBeach(): boolean {
    return this.state.onBeach;
  }

  /** 正在播的换装方向；没在换装时为 null。 */
  get clothingChange(): ClothingChange | null {
    return this.state.clothingChange;
  }

  /** 请求换装。冷却未过、已在换装中、或控制被关掉时返回 false。 */
  beginClothingChange(change: ClothingChange, nowMs?: number): boolean {
    if (this.shutdownState) return false;
    return nowMs === undefined
      ? this.state.beginClothingChange(change)
      : this.state.beginClothingChange(change, nowMs);
  }

  private availableAnimations(): PlayerRuntimeAvailability {
    const idleAnimations = this.playerConfigs.idle.animations.filter(
      (animation) =>
        this.hasTexture(this.idleTexture(animation)) &&
        this.animationExists(this.playerConfigs.idle.animationKeys[animation]),
    );
    const animationKeys = this.playerConfigs.idle.animationKeys;
    return Object.freeze({
      idleAnimations: Object.freeze(idleAnimations),
      sitting:
        this.hasTexture(this.idleTexture("sitting")) &&
        this.animationExists(animationKeys.sittingDown) &&
        this.animationExists(animationKeys.standingUp),
    });
  }

  private idleTexture(action: IdleAnimation | "sitting"): string {
    const texture = this.playerConfigs.idle.textures.find((item) => item.action === action);
    if (texture === undefined) throw new Error(`玩家 idle 贴图缺少配置：${action}`);
    return texture.key;
  }

  private createAnimationIfAvailable(
    texture: string,
    key: string,
    start: number,
    end: number,
    frameRate: number,
  ): void {
    if (this.animationExists(key) || !this.hasTexture(texture)) return;
    try {
      const frames = this.scene.anims.generateFrameNumbers(texture, {
        start,
        end,
      });
      const created = this.scene.anims.create({
        key,
        frames,
        frameRate,
        repeat: 0,
      });
      if (created !== false) this.createdAnimations.add(key);
    } catch {
      this.createdAnimations.delete(key);
    }
  }

  private hasTexture(key: string): boolean {
    return this.scene.textures?.exists(key) ?? true;
  }

  private animationExists(key: string): boolean {
    return this.createdAnimations.has(key) || (this.scene.anims.exists?.(key) ?? false);
  }

  private renderIdleAction(animation: IdleAnimation): boolean {
    const texture = this.idleTexture(animation);
    const key = this.playerConfigs.idle.animationKeys[animation];
    if (!this.hasTexture(texture) || !this.animationExists(key)) return false;
    if (
      this.renderedStatus === "idle-action" &&
      this.renderedIdleAnimation === animation
    ) {
      return true;
    }
    try {
      this.sprite
        .setTexture(texture)
        .setFrame(0)
        .setDisplaySize(this.playerConfigs.specialDisplaySize, this.playerConfigs.specialDisplaySize);
      if (!this.playAnimation(key)) return false;
      this.preserveBodyShape();
      this.renderedStatus = "idle-action";
      this.renderedIdleAnimation = animation;
      return true;
    } catch {
      return false;
    }
  }

  private renderSitting(reverse: boolean): boolean {
    const animationKeys = this.playerConfigs.idle.animationKeys;
    const texture = this.idleTexture("sitting");
    const frames = this.playerConfigs.idle.assetFrames;
    const key = reverse
      ? animationKeys.standingUp
      : animationKeys.sittingDown;
    const status: PlayerStatus = reverse ? "standing-up" : "sitting-down";
    if (!this.hasTexture(texture) || !this.animationExists(key)) {
      return false;
    }
    if (this.renderedStatus === status) return true;
    try {
      this.sprite
        .setTexture(texture)
        .setFrame(reverse ? frames.endFrame : frames.startFrame)
        .setDisplaySize(this.playerConfigs.specialDisplaySize, this.playerConfigs.specialDisplaySize);
      if (!this.playAnimation(key)) return false;
      this.preserveBodyShape();
      this.renderedStatus = status;
      this.renderedIdleAnimation = undefined;
      return true;
    } catch {
      return false;
    }
  }

  private playAnimation(key: string): boolean {
    try {
      return this.sprite.anims.play(key, false) !== false;
    } catch {
      return false;
    }
  }

  private recoverFromMissingAnimation(nowMs?: number): PlayerUpdateResult {
    if (nowMs === undefined) this.state.recoverToNormalIdle();
    else this.state.recoverToNormalIdle(nowMs);
    this.renderedStatus = undefined;
    this.renderedIdleAnimation = undefined;
    this.restoreNormalPlayer();
    return this.snapshotResult(null);
  }

  /** 换装动画。贴图或动画缺失时返回 false，交给调用方走兜底。 */
  private renderClothingChange(change: ClothingChange | null): boolean {
    if (change === null) return false;
    const clothing = this.playerConfigs.clothing;
    if (!this.hasTexture(clothing.offTexture)) return false;
    const key = change === "undressing"
      ? clothing.undressAnimationKey
      : clothing.dressAnimationKey;
    if (!this.animationExists(key)) return false;
    // 每帧都会被调到，已经在播同一个方向就别重播——否则动画会被按回第 0 帧，永远播不完。
    if (
      this.renderedStatus === "changing-clothes" &&
      this.renderedClothingChange === change
    ) {
      return true;
    }
    try {
      this.sprite
        .setTexture(clothing.offTexture)
        .setDisplaySize(clothing.offDisplaySize, clothing.offDisplaySize);
      this.preserveBodyShape();
      this.renderedStatus = "changing-clothes";
      this.renderedIdleAnimation = undefined;
      this.renderedClothingChange = change;
      return this.playAnimation(key);
    } catch {
      return false;
    }
  }

  private restoreNormalPlayer(): void {
    this.sprite.anims.stop?.();
    const onBeach = this.state.onBeach;
    const playerTexture = this.playerConfigs;
    this.sprite
      .setTexture(onBeach ? playerTexture.beach.texture : playerTexture.texture)
      .setDisplaySize(playerTexture.displaySize, playerTexture.displaySize)
      .setFrame(onBeach
        ? playerTexture.beach.idleFrame
        : walkFrameStart(this.state.facing, playerTexture.animation.walkFrameStart));
    this.preserveBodyShape();
  }

  private preserveBodyShape(): void {
    const shape = this.bodyShape;
    const body = this.sprite.body;
    if (shape === undefined || body === undefined) return;
    const sx = this.sprite.scaleX ?? 1;
    const sy = this.sprite.scaleY ?? 1;
    if (sx === 0 || sy === 0) return;
    body.setSize(shape.width / Math.abs(sx), shape.height / Math.abs(sy), false);
    body.setOffset(
      (this.sprite.displayOriginX ?? 0) + shape.left / sx,
      (this.sprite.displayOriginY ?? 0) + shape.top / sy,
    );
  }

  private snapshotResult(
    movementDirection: Direction | null,
  ): PlayerUpdateResult {
    const control = this.state.control;
    return Object.freeze({
      movementDirection,
      visualLocked: control.visualLocked,
      status: this.state.status,
      facing: this.state.facing,
      idleAnimation: this.state.activeIdleAnimation,
      pendingDirection: this.state.pendingDirection,
      onBeach: this.state.onBeach,
      clothingChange: this.state.clothingChange,
    });
  }

  private installAnimationListener(): void {
    if (this.animationListenerInstalled || this.sprite.on === undefined) return;
    this.sprite.on("animationcomplete", this.handleAnimationComplete, this);
    this.animationListenerInstalled = true;
  }

  private clearAnimationListener(): void {
    if (!this.animationListenerInstalled) return;
    this.sprite.off?.("animationcomplete", this.handleAnimationComplete, this);
    this.animationListenerInstalled = false;
  }
}

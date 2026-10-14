/**
 * 直升机与警车的数值/贴图。原先它们是这个模块里的一排常量
 * （`VEHICLE_RUNTIME_ASSETS`、`HELICOPTER_*`、`POLICE_*`），
 * 现在搬去了 `config/<集名>/05-旁支/SYS-ROUTE/数据/`，由外面递进来。
 *
 * 少数几个**算出来的**数没有搬，仍然在这里现算——一个值只有一个家：
 *   · 尾桨层级 = 机身层级 + 1
 *   · 高清层宽度基准 = 机身图每帧宽 × 缩放
 *   · 桨叶片数 = 桨叶角度数组的长度
 *   · 警车数量 = 位置数组的长度
 * 另外几个字段只有唯一取值（`isHelicopter` 恒真、`idleDirection` 恒 "east"、
 * `highResolutionEnabled` 恒真、警车的轮子/刹车/灯恒假），它们同时是**类型**——
 * 快照接口里写的就是字面量类型，搬进 JSON 得把类型放宽成普通字符串，不划算。
 */
import type {
  RouteConfigs,
  VehicleConfig,
  VehiclePresentation,
} from "../config/骨架/05-旁支/SYS-ROUTE/逻辑/index.js";

export const VEHICLE_FAILURE_REASONS = Object.freeze({
  PRELOAD_FAILED: "preload-failed",
  MISSING_TEXTURE: "missing-texture",
  CREATE_FAILED: "create-failed",
  LISTENER_FAILED: "listener-attach-failed",
  CLEANUP_FAILED: "cleanup-failed",
  DIAGNOSTIC_FAILED: "diagnostic-observer-failed",
  UPDATE_FAILED: "update-failed",
} as const);

export type VehicleFailureReason =
  (typeof VEHICLE_FAILURE_REASONS)[keyof typeof VEHICLE_FAILURE_REASONS];
export type VehicleRuntimeState = "idle" | "running" | "shutdown";

type VehicleListener = (...args: unknown[]) => void;

export interface PhaserVehicleLoaderLike {
  image(key: string, url: string): unknown;
  spritesheet(
    key: string,
    url: string,
    config: { readonly frameWidth: number; readonly frameHeight: number },
  ): unknown;
}

export interface PhaserVehicleTextureManagerLike {
  exists(key: string): boolean;
}

export interface PhaserVehiclePhysicsBodyLike {
  setSize?(width: number, height: number, center?: boolean): unknown;
  immovable?: boolean;
  moves?: boolean;
}

export interface PhaserVehicleDisplayObjectLike {
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  displayWidth?: number;
  displayHeight?: number;
  visible?: boolean;
  body?: PhaserVehiclePhysicsBodyLike;
  setOrigin?(x: number, y: number): this;
  setDepth?(value: number): this;
  setScale?(x: number, y?: number): this;
  setDisplaySize?(width: number, height: number): this;
  setDisplayWidth?(width: number): this;
  setFrame?(frame: number): this;
  setRotation?(radians: number): this;
  setVisible?(value: boolean): this;
  destroy(): void;
}

export interface PhaserVehicleEventsLike {
  on(event: string, listener: VehicleListener, context?: unknown): unknown;
  off(event: string, listener: VehicleListener, context?: unknown): unknown;
}

export interface PhaserVehicleSceneLike {
  readonly load: PhaserVehicleLoaderLike;
  readonly textures: PhaserVehicleTextureManagerLike;
  readonly add: {
    image(x: number, y: number, texture: string): unknown;
    sprite(x: number, y: number, texture: string, frame?: number): unknown;
  };
  readonly physics?: {
    readonly add: {
      existing(object: unknown, isStatic?: boolean): unknown;
    };
  };
  readonly events: PhaserVehicleEventsLike;
}

export interface PhaserVehicleRuntimeOptions {
  /** 这一个校园的路线与车辆配置。**必填**——车停在哪儿、多大、用哪几张图全在里面。 */
  readonly route: RouteConfigs;
  readonly onError?: (reason: VehicleFailureReason) => void;
}

export interface VehicleBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface VehicleHelicopterSnapshot {
  readonly kind: "helicopter";
  readonly id: "helicopter-static";
  readonly isHelicopter: true;
  readonly idleDirection: "east";
  readonly x: number;
  readonly y: number;
  readonly frame: number;
  readonly depth: number;
  readonly bounds: VehicleBounds | "UNKNOWN";
  readonly componentKeys: readonly string[];
  readonly scale: number;
  readonly bodyCreated: boolean;
  readonly mainRotorSize: number;
  readonly mainRotorOffset: { readonly x: number; readonly y: number };
  readonly rotationSpeed: number;
  readonly mainRotorScaleY: number;
  readonly tailRotorSize: number;
  readonly tailRotorOffset: { readonly x: number; readonly y: number };
  readonly tailRotorScaleX: number;
  readonly mainRotorCreated: boolean;
  readonly tailRotorCreated: boolean;
  readonly bladeCount: number;
  readonly highResolutionEnabled: true;
  readonly highResolutionKey: string;
  readonly highResolutionOffset: { readonly x: number; readonly y: number };
  readonly highResolutionCreated: boolean;
  readonly highResolutionBaseline: number;
  readonly highResolutionAspect: "UNKNOWN";
  readonly highResolutionBounds: "UNKNOWN";
}

export interface VehiclePoliceSnapshot {
  readonly kind: "police";
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly frame: number;
  readonly depth: number;
  readonly bounds: VehicleBounds | "UNKNOWN";
  readonly componentKeys: readonly string[];
  readonly scale: number;
  readonly collisionBodyCreated: boolean;
}

export interface VehicleRuntimeSnapshot {
  readonly state: VehicleRuntimeState;
  readonly listenerAttached: boolean;
  readonly helicopter: VehicleHelicopterSnapshot | null;
  readonly police: readonly VehiclePoliceSnapshot[];
  readonly policeAccessories: {
    readonly wheels: false;
    readonly brakes: false;
    readonly lights: false;
    readonly policeLights: "UNKNOWN";
  };
  readonly bladeAnglesDegrees: readonly number[];
  readonly rotorAngleRadians: number;
  readonly lastDeltaMs: number;
  readonly diagnostics: readonly VehicleFailureReason[];
  readonly errors: readonly VehicleFailureReason[];
}

export type VehicleStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "shutdown"
        | "already-running"
        | "missing-texture"
        | "create-failed"
        | "listener-attach-failed";
    };

function isDisplayObject(value: unknown): value is PhaserVehicleDisplayObjectLike {
  return typeof value === "object" && value !== null &&
    typeof (value as { destroy?: unknown }).destroy === "function";
}

function validTimestamp(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * 直升机挂在身上的四张图，按画的顺序排（机身 → 主旋翼 → 尾桨 → 高清层）。
 * 顺序有讲究：快照里报的就是这个顺序，改顺序等于改断言。
 */
const helicopterComponentKeys = (
  presentation: VehiclePresentation,
): readonly string[] =>
  Object.freeze([
    presentation.helicopterBody.key,
    presentation.helicopterRotorMain.key,
    presentation.helicopterRotorBack.key,
    presentation.helicopterHighResolution.key,
  ]);

const policeComponentKeys = (
  presentation: VehiclePresentation,
): readonly string[] => Object.freeze([presentation.policeBody.key]);

/**
 * 高清层的宽度基准 = 机身图每帧宽 × 缩放。**现算，不另存一个数**——
 * 换了图或改了缩放，这一层自然跟着变。
 */
const helicopterHighResolutionBaseline = (
  config: VehicleConfig,
  presentation: VehiclePresentation,
): number =>
  presentation.helicopterBody.frameWidth * config.helicopter.scale;

/** Owns the bounded, static vehicle presentation used by the game scene. */
export class PhaserVehicleRuntime {
  private readonly config: VehicleConfig;
  private readonly presentation: VehiclePresentation;
  private readonly helicopterComponentKeys: readonly string[];
  private readonly policeComponentKeys: readonly string[];
  private readonly highResolutionBaseline: number;
  private state: VehicleRuntimeState = "idle";
  private preloaded = false;
  private readonly preloadedKeys = new Set<string>();
  private listenerUpdateAttached = false;
  private listenerShutdownAttached = false;
  private lastNowMs: number | undefined;
  private rotorAngleRadians = 0;
  private bladeAngleDegrees = 0;
  private rotorUpdateCounter = 0;
  private lastDeltaMs = 0;
  private readonly objects = new Set<PhaserVehicleDisplayObjectLike>();
  private body: PhaserVehicleDisplayObjectLike | undefined;
  private tailRotor: PhaserVehicleDisplayObjectLike | undefined;
  private highResolution: PhaserVehicleDisplayObjectLike | undefined;
  private readonly blades: PhaserVehicleDisplayObjectLike[] = [];
  private readonly police: VehiclePoliceSnapshot[] = [];
  private readonly policeObjects: PhaserVehicleDisplayObjectLike[] = [];
  private readonly diagnostics: VehicleFailureReason[] = [];

  private readonly handleUpdate: VehicleListener = (...args): void => {
    const value = args[0];
    this.update(typeof value === "number" ? value : undefined);
  };

  private readonly handleShutdown: VehicleListener = (): void => {
    this.shutdown();
  };

  private readonly onError: ((reason: VehicleFailureReason) => void) | undefined;

  public constructor(
    private readonly scene: PhaserVehicleSceneLike,
    options: PhaserVehicleRuntimeOptions,
  ) {
    this.config = options.route.vehicle;
    this.presentation = options.route.presentation.vehicle;
    this.helicopterComponentKeys = helicopterComponentKeys(this.presentation);
    this.policeComponentKeys = policeComponentKeys(this.presentation);
    this.highResolutionBaseline = helicopterHighResolutionBaseline(
      this.config,
      this.presentation,
    );
    this.onError = options.onError;
  }

  public preload(): void {
    if (this.state === "shutdown" || this.preloaded) return;
    const loadOnce = (key: string, operation: () => unknown): void => {
      if (this.preloadedKeys.has(key)) return;
      operation();
      this.preloadedKeys.add(key);
    };
    const { helicopterBody, policeBody } = this.presentation;
    try {
      loadOnce(helicopterBody.key, () =>
        this.scene.load.spritesheet(helicopterBody.key, helicopterBody.url, {
          frameWidth: helicopterBody.frameWidth,
          frameHeight: helicopterBody.frameHeight,
        }),
      );
      loadOnce(this.presentation.helicopterRotorBack.key, () =>
        this.scene.load.image(
          this.presentation.helicopterRotorBack.key,
          this.presentation.helicopterRotorBack.url,
        ),
      );
      loadOnce(this.presentation.helicopterRotorMain.key, () =>
        this.scene.load.image(
          this.presentation.helicopterRotorMain.key,
          this.presentation.helicopterRotorMain.url,
        ),
      );
      loadOnce(this.presentation.helicopterHighResolution.key, () =>
        this.scene.load.image(
          this.presentation.helicopterHighResolution.key,
          this.presentation.helicopterHighResolution.url,
        ),
      );
      loadOnce(policeBody.key, () =>
        this.scene.load.spritesheet(policeBody.key, policeBody.url, {
          frameWidth: policeBody.frameWidth,
          frameHeight: policeBody.frameHeight,
        }),
      );
      this.preloaded =
        this.preloadedKeys.size === Object.keys(this.presentation).length;
    } catch {
      this.report(VEHICLE_FAILURE_REASONS.PRELOAD_FAILED);
    }
  }

  public get policeCollisionTargets(): readonly PhaserVehicleDisplayObjectLike[] {
    return Object.freeze([...this.policeObjects]);
  }

  public start(nowMs?: number): VehicleStartResult {
    if (this.state === "shutdown") return { ok: false, reason: "shutdown" };
    if (this.state === "running") return { ok: false, reason: "already-running" };

    try {
      const missing = Object.values(this.presentation).some(
        (asset) => !this.scene.textures.exists(asset.key),
      );
      if (missing) {
        this.report(VEHICLE_FAILURE_REASONS.MISSING_TEXTURE);
        return { ok: false, reason: "missing-texture" };
      }
    } catch {
      this.report(VEHICLE_FAILURE_REASONS.MISSING_TEXTURE);
      return { ok: false, reason: "missing-texture" };
    }

    this.resetAnimationClock(nowMs);
    try {
      this.createHelicopter();
      this.createPolice();
      this.attachListeners();
    } catch (error) {
      this.detachListeners();
      this.cleanupObjects();
      this.resetRuntimeObjects();
      const reason = error === VEHICLE_FAILURE_REASONS.LISTENER_FAILED
        ? "listener-attach-failed"
        : "create-failed";
      this.report(reason);
      return { ok: false, reason };
    }

    this.state = "running";
    try {
      this.applyRotorState(0, false);
    } catch {
      this.state = "idle";
      this.detachListeners();
      this.cleanupObjects();
      this.resetRuntimeObjects();
      this.report(VEHICLE_FAILURE_REASONS.CREATE_FAILED);
      return { ok: false, reason: "create-failed" };
    }
    return { ok: true };
  }

  public update(nowMs?: number): void {
    if (this.state !== "running") return;
    this.lastDeltaMs = this.safeDelta(nowMs);
    try {
      this.applyRotorState(this.lastDeltaMs, true);
    } catch {
      this.state = "idle";
      this.detachListeners();
      this.cleanupObjects();
      this.resetRuntimeObjects();
      this.report(VEHICLE_FAILURE_REASONS.UPDATE_FAILED);
    }
  }

  public shutdown(): void {
    if (this.state === "shutdown") return;
    this.state = "shutdown";
    this.detachListeners();
    this.cleanupObjects();
    this.resetRuntimeObjects();
  }

  public get snapshot(): VehicleRuntimeSnapshot {
    const heli = this.config.helicopter;
    const helicopter = this.body === undefined ? null : Object.freeze({
      kind: "helicopter" as const,
      id: "helicopter-static" as const,
      isHelicopter: true as const,
      idleDirection: "east" as const,
      x: heli.position.x,
      y: heli.position.y,
      frame: heli.frameEast,
      depth: heli.depth,
      bounds: this.objectBounds(this.highResolution, 0.5, 0.5),
      componentKeys: this.helicopterComponentKeys,
      scale: heli.scale,
      bodyCreated: true,
      mainRotorSize: heli.mainRotorSize,
      mainRotorOffset: heli.mainRotorOffset,
      rotationSpeed: heli.rotationSpeed,
      mainRotorScaleY: heli.mainRotorScaleEast.y,
      tailRotorSize: heli.tailRotorSize,
      tailRotorOffset: heli.tailRotorOffsetEast,
      tailRotorScaleX: heli.tailRotorScaleEast.x,
      mainRotorCreated: this.blades.length === heli.bladeAnglesDegrees.length,
      tailRotorCreated: this.tailRotor !== undefined,
      bladeCount: this.blades.length,
      highResolutionEnabled: true as const,
      highResolutionKey: this.presentation.helicopterHighResolution.key,
      highResolutionOffset: heli.highResolutionOffset,
      highResolutionCreated: this.highResolution !== undefined,
      highResolutionBaseline: this.highResolutionBaseline,
      highResolutionAspect: "UNKNOWN" as const,
      highResolutionBounds: "UNKNOWN" as const,
    });
    const police = Object.freeze(this.police.map((item, index) => Object.freeze({
      ...item,
      bounds: this.objectBounds(this.policeObjects[index], 0.5, 0.5),
      componentKeys: this.policeComponentKeys,
      collisionBodyCreated: this.policeObjects[index]?.body !== undefined,
    })));
    const diagnostics = Object.freeze([...this.diagnostics]);
    return Object.freeze({
      state: this.state,
      listenerAttached: this.listenerUpdateAttached || this.listenerShutdownAttached,
      helicopter,
      police,
      policeAccessories: Object.freeze({
        wheels: false as const,
        brakes: false as const,
        lights: false as const,
        policeLights: "UNKNOWN" as const,
      }),
      bladeAnglesDegrees: heli.bladeAnglesDegrees,
      rotorAngleRadians: this.rotorAngleRadians,
      lastDeltaMs: this.lastDeltaMs,
      diagnostics,
      errors: diagnostics,
    });
  }

  private createHelicopter(): void {
    const heli = this.config.helicopter;
    this.body = this.createSprite(
      heli.position.x,
      heli.position.y,
      this.presentation.helicopterBody.key,
      heli.frameEast,
    );
    this.body.setFrame?.(heli.frameEast);
    this.setOrigin(this.body, 0.5, 0.5);
    this.setDepth(this.body, heli.depth);
    this.setVisible(this.body, false);
    this.setScale(this.body, heli.scale);

    const mainX = heli.position.x + heli.mainRotorOffset.x * heli.scale;
    const mainY = heli.position.y + heli.mainRotorOffset.y * heli.scale;

    this.tailRotor = this.createImage(
      heli.position.x + heli.tailRotorOffsetEast.x * heli.scale,
      heli.position.y + heli.tailRotorOffsetEast.y * heli.scale,
      this.presentation.helicopterRotorBack.key,
    );
    this.setOrigin(this.tailRotor, 0.5, 0.5);
    // 尾桨的层级是机身层级 + 1，不另存一个数。
    this.setDepth(this.tailRotor, heli.depth + 1);
    this.setVisible(this.tailRotor, true);
    this.setDisplaySize(
      this.tailRotor,
      heli.tailRotorSize,
      heli.tailRotorSize,
    );
    this.setScale(
      this.tailRotor,
      heli.tailRotorScaleEast.x,
      heli.tailRotorScaleEast.y,
    );

    for (const angle of heli.bladeAnglesDegrees) {
      const blade = this.createImage(
        mainX,
        mainY,
        this.presentation.helicopterRotorMain.key,
      );
      this.setOrigin(blade, 0.5, 1);
      this.setDepth(blade, heli.bladeDepth);
      this.setVisible(blade, true);
      this.setDisplaySize(
        blade,
        heli.bladeDisplaySize.width,
        heli.bladeDisplaySize.height,
      );
      this.blades.push(blade);
    }

    this.highResolution = this.createImage(
      heli.position.x + heli.highResolutionOffset.x,
      heli.position.y + heli.highResolutionOffset.y,
      this.presentation.helicopterHighResolution.key,
    );
    this.setOrigin(this.highResolution, 0.5, 0.5);
    this.setDepth(this.highResolution, heli.depth);
    this.setVisible(this.highResolution, true);
    this.setDisplayWidth(this.highResolution, this.highResolutionBaseline);
  }

  private createPolice(): void {
    const police = this.config.police;
    for (const position of police.positions) {
      const sprite = this.createSprite(
        position.x,
        position.y,
        this.presentation.policeBody.key,
        position.frame,
      );
      this.setDepth(sprite, police.depth);
      this.setOrigin(sprite, police.origin.x, police.origin.y);
      this.setVisible(sprite, true);
      sprite.setFrame?.(position.frame);
      this.setScale(sprite, police.scale);
      this.attachPoliceCollisionBody(sprite);
      this.policeObjects.push(sprite);
      this.police.push(Object.freeze({
        kind: "police" as const,
        id: `police-static-${this.police.length + 1}`,
        x: position.x,
        y: position.y,
        frame: position.frame,
        depth: police.depth,
        bounds: "UNKNOWN" as const,
        componentKeys: this.policeComponentKeys,
        scale: police.scale,
        collisionBodyCreated: sprite.body !== undefined,
      }));
    }
  }

  private attachPoliceCollisionBody(
    sprite: PhaserVehicleDisplayObjectLike,
  ): void {
    const physics = this.scene.physics;
    if (physics === undefined) return;
    const created = physics.add.existing(sprite, true) as
      PhaserVehiclePhysicsBodyLike | undefined;
    const body = sprite.body ?? created;
    if (body === undefined) return;
    const size = this.config.police.collisionSize;
    body.setSize?.(size.width, size.height, true);
    body.immovable = true;
    body.moves = false;
  }

  private createImage(x: number, y: number, key: string): PhaserVehicleDisplayObjectLike {
    return this.registerObject(this.scene.add.image(x, y, key));
  }

  private createSprite(
    x: number,
    y: number,
    key: string,
    frame: number,
  ): PhaserVehicleDisplayObjectLike {
    return this.registerObject(this.scene.add.sprite(x, y, key, frame));
  }

  private registerObject(value: unknown): PhaserVehicleDisplayObjectLike {
    if (!isDisplayObject(value)) throw VEHICLE_FAILURE_REASONS.CREATE_FAILED;
    this.objects.add(value);
    return value;
  }

  private setOrigin(object: PhaserVehicleDisplayObjectLike, x: number, y: number): void {
    object.setOrigin?.(x, y);
  }

  private setDepth(object: PhaserVehicleDisplayObjectLike, depth: number): void {
    object.setDepth?.(depth);
  }

  private setScale(object: PhaserVehicleDisplayObjectLike, x: number, y = x): void {
    object.setScale?.(x, y);
    object.scaleX = x;
    object.scaleY = y;
  }

  private setDisplaySize(object: PhaserVehicleDisplayObjectLike, width: number, height: number): void {
    object.setDisplaySize?.(width, height);
    object.displayWidth = width;
    object.displayHeight = height;
  }

  private setDisplayWidth(object: PhaserVehicleDisplayObjectLike, width: number): void {
    object.setDisplayWidth?.(width);
    object.displayWidth = width;
  }

  private setVisible(object: PhaserVehicleDisplayObjectLike, value: boolean): void {
    object.setVisible?.(value);
    object.visible = value;
  }

  private objectBounds(
    object: PhaserVehicleDisplayObjectLike | undefined,
    originX: number,
    originY: number,
  ): VehicleBounds | "UNKNOWN" {
    if (object === undefined) return "UNKNOWN";
    const width = object.displayWidth;
    const height = object.displayHeight;
    if (
      width === undefined || height === undefined ||
      !Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0
    ) {
      return "UNKNOWN";
    }
    return Object.freeze({
      left: object.x - width * originX,
      right: object.x + width * (1 - originX),
      top: object.y - height * originY,
      bottom: object.y + height * (1 - originY),
      width,
      height,
    });
  }

  private setRotation(object: PhaserVehicleDisplayObjectLike, radians: number): void {
    object.setRotation?.(radians);
    object.rotation = radians;
  }

  private applyRotorState(deltaMs: number, advance: boolean): void {
    const heli = this.config.helicopter;
    if (this.tailRotor !== undefined) {
      this.tailRotor.x = heli.position.x + heli.tailRotorOffsetEast.x * heli.scale;
      this.tailRotor.y = heli.position.y + heli.tailRotorOffsetEast.y * heli.scale;
    }
    if (!advance) return;

    // The public multi-blade path advances only every fourth update and uses
    // delta * .004 for its blade-angle and tail-rotor calculations.
    this.rotorUpdateCounter += 1;
    if (this.rotorUpdateCounter < 4) return;
    this.rotorUpdateCounter = 0;
    const rotorTick = deltaMs * 0.004;
    const tailStep = heli.rotationSpeed * rotorTick;
    const bladeStep = tailStep * 180 / Math.PI;
    if (!Number.isFinite(tailStep) || !Number.isFinite(bladeStep)) return;
    this.rotorAngleRadians += tailStep;
    this.bladeAngleDegrees =
      (this.bladeAngleDegrees + bladeStep) % 360;

    for (let index = 0; index < this.blades.length; index += 1) {
      const baseAngle = heli.bladeAnglesDegrees[index];
      const blade = this.blades[index];
      if (baseAngle === undefined || blade === undefined) continue;
      this.setBladeState(blade, baseAngle);
    }
    if (this.tailRotor !== undefined) {
      this.setRotation(this.tailRotor, this.rotorAngleRadians);
    }
  }

  private setBladeState(
    blade: PhaserVehicleDisplayObjectLike,
    baseAngleDegrees: number,
  ): void {
    const angle = degreesToRadians(
      this.bladeAngleDegrees + baseAngleDegrees + 90,
    );
    this.setRotation(blade, angle);
    const heli = this.config.helicopter;
    const perspective = 1 - (1 - heli.mainRotorScaleEast.y) *
      0.85 * (1 - Math.abs(Math.sin(angle)));
    this.setDisplaySize(
      blade,
      heli.bladeDisplaySize.width,
      heli.bladeDisplaySize.height * perspective,
    );
  }

  private attachListeners(): void {
    try {
      this.listenerUpdateAttached = true;
      this.scene.events.on("update", this.handleUpdate, this);
      this.listenerShutdownAttached = true;
      this.scene.events.on("shutdown", this.handleShutdown, this);
    } catch {
      throw VEHICLE_FAILURE_REASONS.LISTENER_FAILED;
    }
  }

  private detachListeners(): void {
    if (this.listenerUpdateAttached) {
      this.listenerUpdateAttached = false;
      try {
        this.scene.events.off("update", this.handleUpdate, this);
      } catch {
        this.report(VEHICLE_FAILURE_REASONS.CLEANUP_FAILED);
      }
    }
    if (this.listenerShutdownAttached) {
      this.listenerShutdownAttached = false;
      try {
        this.scene.events.off("shutdown", this.handleShutdown, this);
      } catch {
        this.report(VEHICLE_FAILURE_REASONS.CLEANUP_FAILED);
      }
    }
  }

  private cleanupObjects(): void {
    const objects = [...this.objects];
    this.objects.clear();
    this.blades.length = 0;
    for (const object of objects.reverse()) {
      try {
        object.destroy();
      } catch {
        this.report(VEHICLE_FAILURE_REASONS.CLEANUP_FAILED);
      }
    }
  }

  private resetRuntimeObjects(): void {
    this.body = undefined;
    this.tailRotor = undefined;
    this.highResolution = undefined;
    this.police.length = 0;
    this.policeObjects.length = 0;
  }

  private resetAnimationClock(nowMs: number | undefined): void {
    this.lastNowMs = validTimestamp(nowMs) ? nowMs : undefined;
    this.rotorAngleRadians = 0;
    this.bladeAngleDegrees = 0;
    this.rotorUpdateCounter = 0;
    this.lastDeltaMs = 0;
  }

  private safeDelta(nowMs: number | undefined): number {
    if (!validTimestamp(nowMs)) return 0;
    if (this.lastNowMs === undefined) {
      this.lastNowMs = nowMs;
      return 0;
    }
    if (nowMs < this.lastNowMs) {
      this.lastNowMs = nowMs;
      return 0;
    }
    const delta = nowMs - this.lastNowMs;
    this.lastNowMs = nowMs;
    return Number.isFinite(delta) && delta >= 0 ? delta : 0;
  }

  private report(reason: VehicleFailureReason): void {
    if (!this.diagnostics.includes(reason)) this.diagnostics.push(reason);
    try {
      this.onError?.(reason);
    } catch {
      if (!this.diagnostics.includes(VEHICLE_FAILURE_REASONS.DIAGNOSTIC_FAILED)) {
        this.diagnostics.push(VEHICLE_FAILURE_REASONS.DIAGNOSTIC_FAILED);
      }
    }
  }
}

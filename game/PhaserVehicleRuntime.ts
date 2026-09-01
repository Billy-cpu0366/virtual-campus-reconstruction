export const VEHICLE_RUNTIME_ASSETS = Object.freeze({
  helicopterBody: Object.freeze({
    key: "npc-helicopter",
    url: "/sprites/npc-helicopter.webp",
    frameWidth: 84,
    frameHeight: 84,
  }),
  helicopterRotorBack: Object.freeze({
    key: "npc-helicopter-rotor-back",
    url: "/sprites/npc-helicopter-rotor-back.webp",
  }),
  helicopterRotorMain: Object.freeze({
    key: "npc-helicopter-rotor-main",
    url: "/sprites/npc-helicopter-rotor-main.webp",
  }),
  helicopterHighResolution: Object.freeze({
    key: "npc-helicopter-high-resolution",
    url: "/sprites/npc-helicopter-high-resolution.webp",
  }),
  policeBody: Object.freeze({
    key: "car-police",
    url: "/sprites/cars/car-police.webp",
    frameWidth: 84,
    frameHeight: 84,
  }),
});

export const VEHICLE_RUNTIME_ASSET_LIST = Object.freeze(
  Object.values(VEHICLE_RUNTIME_ASSETS),
);
export const HELICOPTER_BODY_ASSET = VEHICLE_RUNTIME_ASSETS.helicopterBody;
export const POLICE_BODY_ASSET = VEHICLE_RUNTIME_ASSETS.policeBody;
export const HELICOPTER_COMPONENT_KEYS = Object.freeze([
  HELICOPTER_BODY_ASSET.key,
  VEHICLE_RUNTIME_ASSETS.helicopterRotorMain.key,
  VEHICLE_RUNTIME_ASSETS.helicopterRotorBack.key,
  VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.key,
]);
export const POLICE_COMPONENT_KEYS = Object.freeze([
  POLICE_BODY_ASSET.key,
]);

export const VEHICLE_TILE_SIZE = 16;
export const VEHICLE_DEPTH = 560;
export const HELICOPTER_DEPTH = 600;
export const HELICOPTER_TAIL_ROTOR_DEPTH = HELICOPTER_DEPTH + 1;
export const HELICOPTER_BLADE_DEPTH = 2000;
export const HELICOPTER_SCALE = 2;
export const HELICOPTER_FRAME_EAST = 2;
export const HELICOPTER_MAIN_ROTOR_SIZE = 90;
export const HELICOPTER_TAIL_ROTOR_SIZE = 36;
export const HELICOPTER_ROTATION_SPEED = 8;
export const HELICOPTER_POSITION = Object.freeze({
  x: 31 * VEHICLE_TILE_SIZE + 8,
  y: 80 * VEHICLE_TILE_SIZE + 8,
});
export const HELICOPTER_MAIN_ROTOR_OFFSET = Object.freeze({ x: 8, y: -20 });
export const HELICOPTER_TAIL_ROTOR_OFFSET_EAST = Object.freeze({
  x: -36,
  y: -11,
});
export const HELICOPTER_BLADE_ANGLES_DEGREES = Object.freeze([
  0, 72, 144, 216, 288,
]);
export const HELICOPTER_BLADE_DISPLAY_SIZE = Object.freeze({
  width: 18,
  height: 117,
});
export const HELICOPTER_MAIN_SCALE_EAST = Object.freeze({ x: 1, y: 0.25 });
export const HELICOPTER_TAIL_SCALE_EAST = Object.freeze({ x: 1, y: 1 });
export const HELICOPTER_HIGH_RESOLUTION_OFFSET = Object.freeze({ x: 0, y: 0 });
export const HELICOPTER_HIGH_RESOLUTION_BASELINE =
  VEHICLE_RUNTIME_ASSETS.helicopterBody.frameWidth * HELICOPTER_SCALE;
export const HELICOPTER_RUNTIME_CONTRACT = Object.freeze({
  idleDirection: "east",
  isHelicopter: true,
  bodyFrame: HELICOPTER_FRAME_EAST,
  scale: HELICOPTER_SCALE,
  position: HELICOPTER_POSITION,
  mainRotorSize: HELICOPTER_MAIN_ROTOR_SIZE,
  mainRotorOffset: HELICOPTER_MAIN_ROTOR_OFFSET,
  rotationSpeed: HELICOPTER_ROTATION_SPEED,
  mainRotorScaleY: HELICOPTER_MAIN_SCALE_EAST.y,
  tailRotorSize: HELICOPTER_TAIL_ROTOR_SIZE,
  tailRotorOffset: HELICOPTER_TAIL_ROTOR_OFFSET_EAST,
  tailRotorScaleX: HELICOPTER_TAIL_SCALE_EAST.x,
  bladeCount: HELICOPTER_BLADE_ANGLES_DEGREES.length,
  bladeDepth: HELICOPTER_BLADE_DEPTH,
  bladeAnglesDegrees: HELICOPTER_BLADE_ANGLES_DEGREES,
  bladeDisplaySize: HELICOPTER_BLADE_DISPLAY_SIZE,
  highResolutionEnabled: true,
  highResolutionKey: VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.key,
  highResolutionOffset: HELICOPTER_HIGH_RESOLUTION_OFFSET,
  highResolutionBaseline: HELICOPTER_HIGH_RESOLUTION_BASELINE,
  highResolutionAspect: "UNKNOWN",
  highResolutionBounds: "UNKNOWN",
});

export const POLICE_POSITIONS = Object.freeze([
  Object.freeze({ x: 106 * VEHICLE_TILE_SIZE + 8, y: 83 * VEHICLE_TILE_SIZE + 8 - 5, frame: 3 }),
  Object.freeze({ x: 112 * VEHICLE_TILE_SIZE + 8, y: 82 * VEHICLE_TILE_SIZE + 8 - 5, frame: 6 }),
  Object.freeze({ x: 109 * VEHICLE_TILE_SIZE + 8, y: 84 * VEHICLE_TILE_SIZE + 8 - 5, frame: 4 }),
]);
export const POLICE_COLLISION_SIZE = Object.freeze({ width: 64, height: 48 });
export const POLICE_RUNTIME_CONTRACT = Object.freeze({
  count: 3,
  depth: VEHICLE_DEPTH,
  origin: Object.freeze({ x: 0.5, y: 0.5 }),
  scale: 1,
  positions: POLICE_POSITIONS,
  wheels: false,
  brakes: false,
  lights: false,
  policeLights: "UNKNOWN",
});

export const VEHICLE_RUNTIME_CONTRACT = Object.freeze({
  assets: VEHICLE_RUNTIME_ASSET_LIST,
  helicopter: HELICOPTER_RUNTIME_CONTRACT,
  police: POLICE_RUNTIME_CONTRACT,
});

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

/** Owns the bounded, static vehicle presentation used by the game scene. */
export class PhaserVehicleRuntime {
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
    options: PhaserVehicleRuntimeOptions = {},
  ) {
    this.onError = options.onError;
  }

  public preload(): void {
    if (this.state === "shutdown" || this.preloaded) return;
    const loadOnce = (key: string, operation: () => unknown): void => {
      if (this.preloadedKeys.has(key)) return;
      operation();
      this.preloadedKeys.add(key);
    };
    try {
      loadOnce(VEHICLE_RUNTIME_ASSETS.helicopterBody.key, () =>
        this.scene.load.spritesheet(
          VEHICLE_RUNTIME_ASSETS.helicopterBody.key,
          VEHICLE_RUNTIME_ASSETS.helicopterBody.url,
          {
            frameWidth: VEHICLE_RUNTIME_ASSETS.helicopterBody.frameWidth,
            frameHeight: VEHICLE_RUNTIME_ASSETS.helicopterBody.frameHeight,
          },
        ),
      );
      loadOnce(VEHICLE_RUNTIME_ASSETS.helicopterRotorBack.key, () =>
        this.scene.load.image(
          VEHICLE_RUNTIME_ASSETS.helicopterRotorBack.key,
          VEHICLE_RUNTIME_ASSETS.helicopterRotorBack.url,
        ),
      );
      loadOnce(VEHICLE_RUNTIME_ASSETS.helicopterRotorMain.key, () =>
        this.scene.load.image(
          VEHICLE_RUNTIME_ASSETS.helicopterRotorMain.key,
          VEHICLE_RUNTIME_ASSETS.helicopterRotorMain.url,
        ),
      );
      loadOnce(VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.key, () =>
        this.scene.load.image(
          VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.key,
          VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.url,
        ),
      );
      loadOnce(VEHICLE_RUNTIME_ASSETS.policeBody.key, () =>
        this.scene.load.spritesheet(
          VEHICLE_RUNTIME_ASSETS.policeBody.key,
          VEHICLE_RUNTIME_ASSETS.policeBody.url,
          {
            frameWidth: VEHICLE_RUNTIME_ASSETS.policeBody.frameWidth,
            frameHeight: VEHICLE_RUNTIME_ASSETS.policeBody.frameHeight,
          },
        ),
      );
      this.preloaded = this.preloadedKeys.size === VEHICLE_RUNTIME_ASSET_LIST.length;
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
      const missing = VEHICLE_RUNTIME_ASSET_LIST.some(
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
    const helicopter = this.body === undefined ? null : Object.freeze({
      kind: "helicopter" as const,
      id: "helicopter-static" as const,
      isHelicopter: true as const,
      idleDirection: "east" as const,
      x: HELICOPTER_POSITION.x,
      y: HELICOPTER_POSITION.y,
      frame: HELICOPTER_FRAME_EAST,
      depth: HELICOPTER_DEPTH,
      bounds: this.objectBounds(this.highResolution, 0.5, 0.5),
      componentKeys: HELICOPTER_COMPONENT_KEYS,
      scale: HELICOPTER_SCALE,
      bodyCreated: true,
      mainRotorSize: HELICOPTER_MAIN_ROTOR_SIZE,
      mainRotorOffset: HELICOPTER_MAIN_ROTOR_OFFSET,
      rotationSpeed: HELICOPTER_ROTATION_SPEED,
      mainRotorScaleY: HELICOPTER_MAIN_SCALE_EAST.y,
      tailRotorSize: HELICOPTER_TAIL_ROTOR_SIZE,
      tailRotorOffset: HELICOPTER_TAIL_ROTOR_OFFSET_EAST,
      tailRotorScaleX: HELICOPTER_TAIL_SCALE_EAST.x,
      mainRotorCreated: this.blades.length === HELICOPTER_BLADE_ANGLES_DEGREES.length,
      tailRotorCreated: this.tailRotor !== undefined,
      bladeCount: this.blades.length,
      highResolutionEnabled: true as const,
      highResolutionKey: VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.key,
      highResolutionOffset: HELICOPTER_HIGH_RESOLUTION_OFFSET,
      highResolutionCreated: this.highResolution !== undefined,
      highResolutionBaseline: HELICOPTER_HIGH_RESOLUTION_BASELINE,
      highResolutionAspect: "UNKNOWN" as const,
      highResolutionBounds: "UNKNOWN" as const,
    });
    const police = Object.freeze(this.police.map((item, index) => Object.freeze({
      ...item,
      bounds: this.objectBounds(this.policeObjects[index], 0.5, 0.5),
      componentKeys: POLICE_COMPONENT_KEYS,
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
      bladeAnglesDegrees: HELICOPTER_BLADE_ANGLES_DEGREES,
      rotorAngleRadians: this.rotorAngleRadians,
      lastDeltaMs: this.lastDeltaMs,
      diagnostics,
      errors: diagnostics,
    });
  }

  private createHelicopter(): void {
    this.body = this.createSprite(
      HELICOPTER_POSITION.x,
      HELICOPTER_POSITION.y,
      VEHICLE_RUNTIME_ASSETS.helicopterBody.key,
      HELICOPTER_FRAME_EAST,
    );
    this.body.setFrame?.(HELICOPTER_FRAME_EAST);
    this.setOrigin(this.body, 0.5, 0.5);
    this.setDepth(this.body, HELICOPTER_DEPTH);
    this.setVisible(this.body, false);
    this.setScale(this.body, HELICOPTER_SCALE);

    const mainX = HELICOPTER_POSITION.x +
      HELICOPTER_MAIN_ROTOR_OFFSET.x * HELICOPTER_SCALE;
    const mainY = HELICOPTER_POSITION.y +
      HELICOPTER_MAIN_ROTOR_OFFSET.y * HELICOPTER_SCALE;

    this.tailRotor = this.createImage(
      HELICOPTER_POSITION.x +
        HELICOPTER_TAIL_ROTOR_OFFSET_EAST.x * HELICOPTER_SCALE,
      HELICOPTER_POSITION.y +
        HELICOPTER_TAIL_ROTOR_OFFSET_EAST.y * HELICOPTER_SCALE,
      VEHICLE_RUNTIME_ASSETS.helicopterRotorBack.key,
    );
    this.setOrigin(this.tailRotor, 0.5, 0.5);
    this.setDepth(this.tailRotor, HELICOPTER_TAIL_ROTOR_DEPTH);
    this.setVisible(this.tailRotor, true);
    this.setDisplaySize(this.tailRotor, HELICOPTER_TAIL_ROTOR_SIZE, HELICOPTER_TAIL_ROTOR_SIZE);
    this.setScale(
      this.tailRotor,
      HELICOPTER_TAIL_SCALE_EAST.x,
      HELICOPTER_TAIL_SCALE_EAST.y,
    );

    for (const angle of HELICOPTER_BLADE_ANGLES_DEGREES) {
      const blade = this.createImage(
        mainX,
        mainY,
        VEHICLE_RUNTIME_ASSETS.helicopterRotorMain.key,
      );
      this.setOrigin(blade, 0.5, 1);
      this.setDepth(blade, HELICOPTER_BLADE_DEPTH);
      this.setVisible(blade, true);
      this.setDisplaySize(
        blade,
        HELICOPTER_BLADE_DISPLAY_SIZE.width,
        HELICOPTER_BLADE_DISPLAY_SIZE.height,
      );
      this.blades.push(blade);
    }

    this.highResolution = this.createImage(
      HELICOPTER_POSITION.x + HELICOPTER_HIGH_RESOLUTION_OFFSET.x,
      HELICOPTER_POSITION.y + HELICOPTER_HIGH_RESOLUTION_OFFSET.y,
      VEHICLE_RUNTIME_ASSETS.helicopterHighResolution.key,
    );
    this.setOrigin(this.highResolution, 0.5, 0.5);
    this.setDepth(this.highResolution, HELICOPTER_DEPTH);
    this.setVisible(this.highResolution, true);
    this.setDisplayWidth(
      this.highResolution,
      HELICOPTER_HIGH_RESOLUTION_BASELINE,
    );
  }

  private createPolice(): void {
    for (const position of POLICE_POSITIONS) {
      const sprite = this.createSprite(
        position.x,
        position.y,
        VEHICLE_RUNTIME_ASSETS.policeBody.key,
        position.frame,
      );
      this.setDepth(sprite, VEHICLE_DEPTH);
      this.setOrigin(sprite, 0.5, 0.5);
      this.setVisible(sprite, true);
      sprite.setFrame?.(position.frame);
      this.setScale(sprite, 1);
      this.attachPoliceCollisionBody(sprite);
      this.policeObjects.push(sprite);
      this.police.push(Object.freeze({
        kind: "police" as const,
        id: `police-static-${this.police.length + 1}`,
        x: position.x,
        y: position.y,
        frame: position.frame,
        depth: VEHICLE_DEPTH,
        bounds: "UNKNOWN" as const,
        componentKeys: POLICE_COMPONENT_KEYS,
        scale: 1,
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
    body.setSize?.(
      POLICE_COLLISION_SIZE.width,
      POLICE_COLLISION_SIZE.height,
      true,
    );
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
    if (this.tailRotor !== undefined) {
      this.tailRotor.x = HELICOPTER_POSITION.x +
        HELICOPTER_TAIL_ROTOR_OFFSET_EAST.x * HELICOPTER_SCALE;
      this.tailRotor.y = HELICOPTER_POSITION.y +
        HELICOPTER_TAIL_ROTOR_OFFSET_EAST.y * HELICOPTER_SCALE;
    }
    if (!advance) return;

    // The public multi-blade path advances only every fourth update and uses
    // delta * .004 for its blade-angle and tail-rotor calculations.
    this.rotorUpdateCounter += 1;
    if (this.rotorUpdateCounter < 4) return;
    this.rotorUpdateCounter = 0;
    const rotorTick = deltaMs * 0.004;
    const tailStep = HELICOPTER_ROTATION_SPEED * rotorTick;
    const bladeStep = tailStep * 180 / Math.PI;
    if (!Number.isFinite(tailStep) || !Number.isFinite(bladeStep)) return;
    this.rotorAngleRadians += tailStep;
    this.bladeAngleDegrees =
      (this.bladeAngleDegrees + bladeStep) % 360;

    for (let index = 0; index < this.blades.length; index += 1) {
      const baseAngle = HELICOPTER_BLADE_ANGLES_DEGREES[index];
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
    const perspective = 1 - (1 - HELICOPTER_MAIN_SCALE_EAST.y) *
      0.85 * (1 - Math.abs(Math.sin(angle)));
    this.setDisplaySize(
      blade,
      HELICOPTER_BLADE_DISPLAY_SIZE.width,
      HELICOPTER_BLADE_DISPLAY_SIZE.height * perspective,
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

import {
  blurStrength,
  CAMERA_RUNTIME_SETTINGS,
  CameraRuntime,
  chunkRenderBlockSize,
  scaleFactor,
  type CameraPosition,
  type CameraRunResult,
  type CameraRuntimeCameraSettings,
  type CameraRuntimeDriver,
  type CameraRuntimeStartOptions,
  type CameraRuntimeTweenOptions,
  type CameraViewport,
} from "../src/camera/index.js";

export interface PhaserCameraLike {
  scrollX: number;
  scrollY: number;
  readonly width: number;
  readonly height: number;
  zoom: number;
  roundPixels: boolean;
  stopFollow(): unknown;
  setZoom(value: number): unknown;
  setFollowOffset(x: number, y: number): unknown;
  setDeadzone(x: number, y: number): unknown;
}

export interface PhaserCameraTimerLike {
  remove?(destroy?: boolean): unknown;
  destroy?(): unknown;
}

export interface PhaserCameraTweenLike {
  stop?(resetToStart?: boolean): unknown;
  remove?(): unknown;
  destroy?(): unknown;
}

export interface PhaserCameraTweenTarget {
  x: number;
  y: number;
}

export interface PhaserCameraTweenConfig {
  readonly targets: PhaserCameraTweenTarget;
  readonly x: number;
  readonly y: number;
  readonly duration: number;
  readonly ease: string;
  readonly onUpdate: () => void;
  readonly onComplete: () => void;
}

export interface PhaserCameraSceneLike {
  readonly cameras: { readonly main: PhaserCameraLike };
  readonly time: {
    delayedCall(delay: number, callback: () => void): PhaserCameraTimerLike;
  };
  readonly tweens: {
    add(config: PhaserCameraTweenConfig): PhaserCameraTweenLike;
  };
}

export interface PhaserCameraControlGate {
  disableControls(): void;
  enableControls(): void;
}

export type PhaserCameraEffectName = "HeatHaze" | "Fire" | "Morph";
export type PhaserCameraEffectStatus = "installed" | "unavailable";

export type PhaserCameraEffectInstallers = Partial<
  Readonly<
    Record<
      PhaserCameraEffectName,
      (settings: PhaserCameraNativeScaleSettings) => unknown
    >
  >
>;

export type PhaserCameraEffectAvailability = Readonly<
  Record<PhaserCameraEffectName, PhaserCameraEffectStatus>
>;

export interface PhaserCameraNativeScaleSettings {
  readonly nativeScale: number;
  readonly blurStrength: number;
  readonly scaleFactor: number;
  readonly chunkRenderBlockSize: number;
}

export interface PhaserCameraRuntimeOptions {
  readonly controlGate: PhaserCameraControlGate;
  readonly getPlayerPosition: () => CameraPosition;
  readonly startHardFollow: (
    settings: CameraRuntimeCameraSettings,
  ) => void;
  readonly nativeScaleProvider: () => number;
  readonly onViewport?: (viewport: CameraViewport) => void;
  readonly onNativeScaleSettings?: (
    settings: PhaserCameraNativeScaleSettings,
  ) => void;
  readonly effectInstallers?: PhaserCameraEffectInstallers;
  readonly warn?: (message: string) => void;
  readonly driver?: CameraRuntimeDriver;
}

const EFFECT_NAMES: readonly PhaserCameraEffectName[] = [
  "HeatHaze",
  "Fire",
  "Morph",
];

function unavailableEffects(): PhaserCameraEffectAvailability {
  return Object.freeze({
    HeatHaze: "unavailable",
    Fire: "unavailable",
    Morph: "unavailable",
  });
}

export class PhaserCameraRuntime {
  private readonly camera: PhaserCameraLike;
  private readonly options: PhaserCameraRuntimeOptions;
  private readonly runtime: CameraRuntime;
  private nativeScaleSettingsState: PhaserCameraNativeScaleSettings | undefined;
  private effectAvailabilityState: PhaserCameraEffectAvailability =
    unavailableEffects();
  private startPromise: Promise<CameraRunResult> | undefined;
  private shutdownState = false;

  constructor(
    private readonly scene: PhaserCameraSceneLike,
    options: PhaserCameraRuntimeOptions,
  ) {
    this.camera = scene.cameras.main;
    this.options = options;
    this.runtime = new CameraRuntime(
      {
        disableControls: () => options.controlGate.disableControls(),
        enableControls: () => options.controlGate.enableControls(),
        stopFollow: () => this.camera.stopFollow(),
        startHardFollow: (settings) => options.startHardFollow(settings),
        installEffects: () => this.installEffectsAfterSuccess(),
        getViewport: () => this.viewport(),
        outputViewport: (viewport) => this.outputViewport(viewport),
        getPlayerPosition: () => options.getPlayerPosition(),
        restoreCameraSettings: (settings) => this.restoreCameraSettings(settings),
      },
      options.driver ?? this.createPhaserDriver(),
    );
  }

  get status() {
    return this.runtime.status;
  }

  get nativeScaleSettings(): PhaserCameraNativeScaleSettings | undefined {
    return this.nativeScaleSettingsState;
  }

  get effectAvailability(): PhaserCameraEffectAvailability {
    return this.effectAvailabilityState;
  }

  start(options: CameraRuntimeStartOptions = {}): Promise<CameraRunResult> {
    if (this.shutdownState) return this.runtime.start(options);
    if (this.startPromise !== undefined) return this.startPromise;

    try {
      this.configure();
      this.startPromise = this.rememberRun(this.runtime.start(options));
    } catch (error: unknown) {
      this.recoverBeforeStart();
      this.startPromise = this.rememberRun(
        Promise.resolve({
          status: "failed" as const,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
    }
    return this.startPromise;
  }

  configure(): void {
    this.restoreCameraSettings(CAMERA_RUNTIME_SETTINGS);
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.runtime.shutdown();
  }

  private rememberRun(
    promise: Promise<CameraRunResult>,
  ): Promise<CameraRunResult> {
    return promise.then((result) => {
      if (result.status === "failed") this.startPromise = undefined;
      return result;
    });
  }

  private recoverBeforeStart(): void {
    try {
      this.restoreCameraSettings(CAMERA_RUNTIME_SETTINGS);
    } catch {
      // Preserve the startup failure while still attempting follow recovery.
    }
    try {
      this.options.startHardFollow(CAMERA_RUNTIME_SETTINGS);
    } catch {
      // Preserve the startup failure.
    }
    try {
      this.options.controlGate.enableControls();
    } catch {
      // Preserve the startup failure.
    }
  }

  private viewport(): CameraViewport {
    return Object.freeze({
      scrollX: this.camera.scrollX,
      scrollY: this.camera.scrollY,
      width: this.camera.width,
      height: this.camera.height,
      zoom: this.camera.zoom,
    });
  }

  private outputViewport(viewport: CameraViewport): void {
    this.camera.scrollX = viewport.scrollX;
    this.camera.scrollY = viewport.scrollY;
    this.options.onViewport?.(viewport);
  }

  private restoreCameraSettings(settings: CameraRuntimeCameraSettings): void {
    this.camera.setZoom(settings.zoom);
    this.camera.setFollowOffset(
      settings.followOffsetX,
      settings.followOffsetY,
    );
    this.camera.setDeadzone(settings.deadzoneX, settings.deadzoneY);
    this.camera.roundPixels = settings.roundPixels;
  }

  private prepareNativeScale(): PhaserCameraNativeScaleSettings {
    const nativeScale = this.options.nativeScaleProvider();
    if (!Number.isFinite(nativeScale) || nativeScale <= 0) {
      throw new RangeError("nativeScale must be a finite positive number");
    }
    const settings: PhaserCameraNativeScaleSettings = Object.freeze({
      nativeScale,
      blurStrength: blurStrength(nativeScale),
      scaleFactor: scaleFactor(nativeScale),
      chunkRenderBlockSize: chunkRenderBlockSize(nativeScale),
    });
    this.nativeScaleSettingsState = settings;
    this.options.onNativeScaleSettings?.(settings);
    return settings;
  }

  private installEffectsAfterSuccess(): void {
    let settings: PhaserCameraNativeScaleSettings;
    try {
      settings = this.prepareNativeScale();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      for (const name of EFFECT_NAMES) {
        this.warnEffect(name, `nativeScale unavailable: ${reason}`);
      }
      this.effectAvailabilityState = unavailableEffects();
      return;
    }
    this.installEffects(settings);
  }

  private installEffects(settings: PhaserCameraNativeScaleSettings): void {
    const installers = this.options.effectInstallers ?? {};
    const availability: Record<
      PhaserCameraEffectName,
      PhaserCameraEffectStatus
    > = {
      HeatHaze: "unavailable",
      Fire: "unavailable",
      Morph: "unavailable",
    };
    for (const name of EFFECT_NAMES) {
      const installer = installers[name];
      if (installer === undefined) {
        this.warnEffect(name, "installer unavailable");
        continue;
      }
      try {
        const installed = installer(settings);
        if (installed === false) {
          this.warnEffect(name, "installer returned unavailable");
          continue;
        }
        availability[name] = "installed";
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        this.warnEffect(name, `installation failed: ${reason}`);
      }
    }
    this.effectAvailabilityState = Object.freeze(availability);
  }

  private warnEffect(name: PhaserCameraEffectName, reason: string): void {
    const message = `camera effect ${name} unavailable: ${reason}`;
    try {
      (this.options.warn ?? ((warning) => console.warn(warning)))(message);
    } catch {
      // Diagnostics must never turn an unavailable optional effect into failure.
    }
  }

  private createPhaserDriver(): CameraRuntimeDriver {
    return {
      delay: (duration, callback) => {
        const timer = this.scene.time.delayedCall(duration, callback);
        let cancelled = false;
        return {
          cancel: () => {
            if (cancelled) return;
            cancelled = true;
            if (timer.remove !== undefined) timer.remove(false);
            else timer.destroy?.();
          },
        };
      },
      tween: (from, to, duration, onUpdate, onComplete, tweenOptions) => {
        const target: PhaserCameraTweenTarget = { x: from.x, y: from.y };
        let tween: PhaserCameraTweenLike | undefined;
        const config: PhaserCameraTweenConfig = {
          targets: target,
          x: to.x,
          y: to.y,
          duration,
          ease: tweenOptions?.ease ?? "Linear",
          onUpdate: () => onUpdate({ x: target.x, y: target.y }),
          onComplete,
        };
        tween = this.scene.tweens.add(config);
        let cancelled = false;
        return {
          cancel: () => {
            if (cancelled) return;
            cancelled = true;
            if (tween?.stop !== undefined) tween.stop(false);
            if (tween?.remove !== undefined) tween.remove();
            else tween?.destroy?.();
          },
        };
      },
    };
  }
}

export type { CameraRuntimeStartOptions, CameraRunResult };
export type { CameraRuntimeTweenOptions };

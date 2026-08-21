import {
  CAMERA_END_TWEEN_DURATION_MS,
  CAMERA_END_TWEEN_EASE,
  CAMERA_SEQUENCE,
} from "./sequence.js";
import type {
  CameraPoint,
  CameraRuntimeCameraSettings,
  CameraRuntimeCallbacks,
  CameraRuntimeDriver,
  CameraRuntimeStartOptions,
  CameraRuntimeTweenOptions,
  CameraRunResult,
  CameraViewport,
  CameraPosition,
} from "./contract.js";
import {
  CAMERA_ZOOM,
  DEADZONE_X,
  DEADZONE_Y,
  FOLLOW_LERP,
  FOLLOW_OFFSET_X,
  FOLLOW_OFFSET_Y,
  ROUND_PIXELS,
} from "./params.js";

export const CAMERA_RUNTIME_SETTINGS: CameraRuntimeCameraSettings =
  Object.freeze({
    zoom: CAMERA_ZOOM,
    lerpX: FOLLOW_LERP,
    lerpY: FOLLOW_LERP,
    followOffsetX: FOLLOW_OFFSET_X,
    followOffsetY: FOLLOW_OFFSET_Y,
    deadzoneX: DEADZONE_X,
    deadzoneY: DEADZONE_Y,
    roundPixels: ROUND_PIXELS,
  });

const DEFAULT_START_OPTIONS: Required<
  Pick<CameraRuntimeStartOptions, "sequence" | "returnDuration">
> = {
  sequence: CAMERA_SEQUENCE,
  returnDuration: CAMERA_END_TWEEN_DURATION_MS,
};

class CameraRuntimeShutdownError extends Error {
  constructor() {
    super("camera runtime has been shut down");
    this.name = "CameraRuntimeShutdownError";
  }
}

function assertDuration(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}

function assertSequence(sequence: readonly CameraPoint[]): void {
  if (sequence.length === 0) {
    throw new RangeError("camera sequence must contain at least one point");
  }
  for (const [index, point] of sequence.entries()) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.duration) ||
      !Number.isFinite(point.stayDuration)
    ) {
      throw new TypeError(`camera sequence point ${index} is not finite`);
    }
    assertDuration(point.duration, `camera sequence point ${index} duration`);
    assertDuration(
      point.stayDuration,
      `camera sequence point ${index} stayDuration`,
    );
  }
}

function pointPosition(point: CameraPoint): CameraPosition {
  return { x: point.x, y: point.y };
}

function scrollPositionForCenter(
  center: CameraPosition,
  viewport: CameraViewport,
): CameraPosition {
  return {
    x: center.x - viewport.width / (2 * viewport.zoom),
    y: center.y - viewport.height / (2 * viewport.zoom),
  };
}

function failedResult(error: unknown): CameraRunResult {
  return error instanceof Error
    ? Object.freeze({ status: "failed" as const, error })
    : Object.freeze({
        status: "failed" as const,
        error: new Error(String(error)),
      });
}

export function createTimeoutCameraRuntimeDriver(): CameraRuntimeDriver {
  return {
    delay(duration, callback) {
      let cancelled = false;
      const handle = setTimeout(() => {
        if (!cancelled) callback();
      }, duration);
      return {
        cancel: () => {
          cancelled = true;
          clearTimeout(handle);
        },
      };
    },
    tween(from, to, duration, onUpdate, onComplete) {
      let cancelled = false;
      const handle = setTimeout(() => {
        if (cancelled) return;
        onUpdate(to);
        onComplete();
      }, duration);
      if (duration === 0) {
        clearTimeout(handle);
        queueMicrotask(() => {
          if (cancelled) return;
          onUpdate(to);
          onComplete();
        });
      }
      void from;
      return {
        cancel: () => {
          cancelled = true;
          clearTimeout(handle);
        },
      };
    },
  };
}

type RuntimePhase = "idle" | "running" | "completed" | "failed" | "shutdown";

export class CameraRuntime {
  private readonly driver: CameraRuntimeDriver;
  private readonly callbacks: CameraRuntimeCallbacks;
  private phase: RuntimePhase = "idle";
  private runPromise: Promise<CameraRunResult> | undefined;
  private resolveRun: ((result: CameraRunResult) => void) | undefined;
  private activeTimer: { cancel(): void } | undefined;
  private activeTween: { cancel(): void } | undefined;
  private cleanupDone = false;
  private recoveryRequired = false;
  private currentPosition: CameraPosition | undefined;

  constructor(
    callbacks: CameraRuntimeCallbacks,
    driver: CameraRuntimeDriver = createTimeoutCameraRuntimeDriver(),
  ) {
    this.callbacks = callbacks;
    this.driver = driver;
  }

  get status(): RuntimePhase {
    return this.phase;
  }

  start(options: CameraRuntimeStartOptions = {}): Promise<CameraRunResult> {
    if (this.phase === "shutdown") {
      return Promise.reject(new CameraRuntimeShutdownError());
    }
    if (this.phase === "completed" && this.runPromise !== undefined) {
      return this.runPromise;
    }
    if (this.phase === "running" && this.runPromise !== undefined) {
      return this.runPromise;
    }
    if (this.phase === "failed") {
      this.phase = "idle";
      this.runPromise = undefined;
      this.cleanupDone = false;
      this.recoveryRequired = false;
      this.currentPosition = undefined;
    }

    const sequence = options.sequence ?? DEFAULT_START_OPTIONS.sequence;
    const returnDuration =
      options.returnDuration ?? DEFAULT_START_OPTIONS.returnDuration;
    this.runPromise = new Promise<CameraRunResult>((resolve) => {
      this.resolveRun = resolve;
      try {
        assertSequence(sequence);
        assertDuration(returnDuration, "camera returnDuration");
        this.phase = "running";
        this.recoveryRequired = true;
        this.callbacks.disableControls();
        this.callbacks.stopFollow();
        this.advanceToPoint(sequence, 0, returnDuration);
      } catch (error: unknown) {
        this.fail(error);
      }
    });
    return this.runPromise;
  }

  shutdown(): void {
    if (this.phase === "shutdown") return;
    this.cancelActiveWork();
    if (this.recoveryRequired && !this.cleanupDone) {
      try {
        this.restoreAfterRun(false);
      } catch {
        // Shutdown still rejects future starts after best-effort recovery.
      }
    }
    this.phase = "shutdown";
    if (this.runPromise !== undefined) {
      this.resolve(Object.freeze({ status: "cancelled" as const }));
    }
  }

  private advanceToPoint(
    sequence: readonly CameraPoint[],
    index: number,
    returnDuration: number,
  ): void {
    if (this.phase !== "running") return;
    const point = sequence[index];
    if (point === undefined) {
      this.returnToPlayer(returnDuration);
      return;
    }

    const target = scrollPositionForCenter(
      pointPosition(point),
      this.callbacks.getViewport(),
    );
    const from = this.currentPosition ?? this.readCurrentPosition();
    if (point.duration === 0) {
      this.emitPosition(target);
      this.waitAtPoint(sequence, index, returnDuration);
      return;
    }

    let callbackInvoked = false;
    const tween = this.driver.tween(
      from,
      target,
      point.duration,
      (position) => {
        if (this.phase !== "running") return;
        try {
          this.emitPosition(position);
        } catch (error: unknown) {
          this.fail(error);
        }
      },
      () => {
        callbackInvoked = true;
        this.activeTween = undefined;
        if (this.phase !== "running") return;
        try {
          this.emitPosition(target);
          this.waitAtPoint(sequence, index, returnDuration);
        } catch (error: unknown) {
          this.fail(error);
        }
      },
      { ease: "Linear" },
    );
    if (this.phase === "running" && !callbackInvoked) {
      this.activeTween = tween;
    } else if (!callbackInvoked) {
      tween.cancel();
    }
  }

  private waitAtPoint(
    sequence: readonly CameraPoint[],
    index: number,
    returnDuration: number,
  ): void {
    const point = sequence[index];
    if (point === undefined) {
      this.returnToPlayer(returnDuration);
      return;
    }
    if (point.stayDuration === 0) {
      this.advanceToPoint(sequence, index + 1, returnDuration);
      return;
    }
    let callbackInvoked = false;
    const timer = this.driver.delay(point.stayDuration, () => {
      callbackInvoked = true;
      this.activeTimer = undefined;
      if (this.phase !== "running") return;
      try {
        this.advanceToPoint(sequence, index + 1, returnDuration);
      } catch (error: unknown) {
        this.fail(error);
      }
    });
    if (this.phase === "running" && !callbackInvoked) {
      this.activeTimer = timer;
    } else if (!callbackInvoked) {
      timer.cancel();
    }
  }

  private returnToPlayer(returnDuration: number): void {
    if (this.phase !== "running") return;
    const target = scrollPositionForCenter(
      this.callbacks.getPlayerPosition(),
      this.callbacks.getViewport(),
    );
    const from = this.currentPosition ?? this.readCurrentPosition();
    if (returnDuration === 0) {
      this.emitPosition(target);
      this.complete();
      return;
    }
    let callbackInvoked = false;
    const tween = this.driver.tween(
      from,
      target,
      returnDuration,
      (position) => {
        if (this.phase !== "running") return;
        try {
          this.emitPosition(position);
        } catch (error: unknown) {
          this.fail(error);
        }
      },
      () => {
        callbackInvoked = true;
        this.activeTween = undefined;
        if (this.phase !== "running") return;
        try {
          this.emitPosition(target);
          this.complete();
        } catch (error: unknown) {
          this.fail(error);
        }
      },
      { ease: CAMERA_END_TWEEN_EASE },
    );
    if (this.phase === "running" && !callbackInvoked) {
      this.activeTween = tween;
    } else if (!callbackInvoked) {
      tween.cancel();
    }
  }

  private readCurrentPosition(): CameraPosition {
    const viewport = this.callbacks.getViewport();
    return { x: viewport.scrollX, y: viewport.scrollY };
  }

  private emitPosition(position: CameraPosition): void {
    const current = this.callbacks.getViewport();
    const viewport: CameraViewport = Object.freeze({
      ...current,
      scrollX: position.x,
      scrollY: position.y,
    });
    this.currentPosition = position;
    this.callbacks.outputViewport(viewport);
  }

  private complete(): void {
    if (this.phase !== "running") return;
    try {
      this.restoreAfterRun(true);
      this.finish("completed");
    } catch (error: unknown) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (this.phase === "shutdown") {
      this.finish("cancelled");
      return;
    }
    if (this.phase !== "running" && this.phase !== "idle") return;
    this.phase = "failed";
    this.cancelActiveWork();
    try {
      this.restoreAfterRun(false);
    } catch {
      // Preserve the first failure while still attempting all cleanup steps.
    }
    this.resolve(failedResult(error));
  }

  private finish(status: "completed" | "cancelled"): void {
    this.phase = status === "completed" ? "completed" : "shutdown";
    this.cancelActiveWork();
    this.resolve(Object.freeze({ status }));
  }

  private restoreAfterRun(installEffects: boolean): void {
    if (this.cleanupDone || !this.recoveryRequired) return;
    this.cleanupDone = true;
    let firstError: unknown;
    try {
      this.callbacks.restoreCameraSettings(CAMERA_RUNTIME_SETTINGS);
    } catch (error: unknown) {
      firstError ??= error;
    }
    try {
      this.callbacks.startHardFollow(CAMERA_RUNTIME_SETTINGS);
    } catch (error: unknown) {
      firstError ??= error;
    }
    if (installEffects && firstError === undefined) {
      try {
        this.callbacks.installEffects?.();
      } catch (error: unknown) {
        firstError ??= error;
      }
    }
    try {
      this.callbacks.enableControls();
    } catch (error: unknown) {
      firstError ??= error;
    }
    if (firstError !== undefined) throw firstError;
  }

  private cancelActiveWork(): void {
    const timer = this.activeTimer;
    const tween = this.activeTween;
    this.activeTimer = undefined;
    this.activeTween = undefined;
    try {
      timer?.cancel();
    } catch {
      // Cleanup is best effort; the run result retains the original failure.
    }
    try {
      tween?.cancel();
    } catch {
      // Cleanup is best effort; the run result retains the original failure.
    }
  }

  private resolve(result: CameraRunResult): void {
    const resolveRun = this.resolveRun;
    this.resolveRun = undefined;
    resolveRun?.(result);
  }
}

export type {
  CameraPoint,
  CameraRuntimeCameraSettings,
  CameraRuntimeCallbacks,
  CameraRuntimeDriver,
  CameraRuntimeStartOptions,
  CameraRunResult,
  CameraViewport,
  CameraPosition,
};
export { CAMERA_END_TWEEN_EASE };
export type CameraRuntimePhase = RuntimePhase;
export { CameraRuntimeShutdownError };

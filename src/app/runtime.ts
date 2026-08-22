import type {
  AppError,
  AppErrorKind,
  AppLoadCallbacks,
  AppLoadHandle,
  AppRuntimeEffects,
  AppRuntimeOptions,
  AppSnapshot,
  AppStatus,
} from "./contract.js";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") return error;
  return "Unknown application error";
}

function makeError(kind: AppErrorKind, error: unknown): AppError {
  return Object.freeze({ kind, message: errorMessage(error) });
}

function validRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Pure App lifecycle coordinator. It owns no DOM, Phaser instance, or timer. */
export class AppRuntime {
  private readonly effects: AppRuntimeEffects;
  private readonly onChange: (snapshot: AppSnapshot) => void;
  private status: AppStatus = "BOOT";
  private generation = 0;
  private progress = 0;
  private error: AppError | undefined;
  private loadHandle: AppLoadHandle | undefined;
  private generationCleaned = true;

  constructor(options: AppRuntimeOptions) {
    this.effects = options.effects;
    this.onChange = options.onChange ?? (() => undefined);
  }

  get snapshot(): AppSnapshot {
    const snapshot: AppSnapshot = {
      status: this.status,
      generation: this.generation,
      progress: this.progress,
      ...(this.error === undefined ? {} : { error: this.error }),
    };
    return Object.freeze(snapshot);
  }

  start(): boolean {
    if (this.status !== "BOOT") return false;
    return this.beginLoading();
  }

  retry(): boolean {
    if (this.status !== "ERROR") return false;

    const previousGeneration = this.generation;
    this.status = "RETRYING";
    this.error = undefined;
    this.emitChange();

    if (!this.cleanupGeneration(previousGeneration)) {
      this.status = "ERROR";
      this.error = makeError("cleanup", "Previous generation cleanup failed");
      this.emitChange();
      return false;
    }

    return this.beginLoading();
  }

  reportProgress(generation: number, ratio: number): boolean {
    if (
      this.status !== "LOADING" ||
      generation !== this.generation ||
      !validRatio(ratio) ||
      ratio < this.progress
    ) {
      return false;
    }
    this.progress = ratio;
    this.emitChange();
    return true;
  }

  markReady(generation: number): boolean {
    if (this.status !== "LOADING" || generation !== this.generation) {
      return false;
    }
    this.status = "READY";
    this.emitChange();
    return true;
  }

  play(): boolean {
    if (this.status !== "READY") return false;

    const generation = this.generation;
    this.status = "ENTERING_GAME";
    this.emitChange();
    try {
      this.effects.enterGame(
        generation,
        () => this.markEntered(generation),
        (error) => this.fail(generation, "entry", error),
      );
      return true;
    } catch (error) {
      if (this.status === "ENTERING_GAME") {
        this.fail(generation, "entry", error);
      }
      return false;
    }
  }

  markEntered(generation: number): boolean {
    if (
      this.status !== "ENTERING_GAME" ||
      generation !== this.generation
    ) {
      return false;
    }
    this.status = "PLAYING";
    this.emitChange();
    return true;
  }

  openModal(): boolean {
    if (this.status !== "PLAYING") return false;
    this.status = "MODAL_OPEN";
    this.emitChange();
    return true;
  }

  closeModal(): boolean {
    if (this.status !== "MODAL_OPEN") return false;
    this.status = "PLAYING";
    this.emitChange();
    return true;
  }

  fail(
    generation: number,
    kind: Exclude<AppErrorKind, "cleanup" | "protocol">,
    error: unknown,
  ): boolean {
    if (
      generation !== this.generation ||
      this.status === "SHUTDOWN" ||
      this.status === "ERROR" ||
      this.status === "RETRYING"
    ) {
      return false;
    }

    this.status = "ERROR";
    this.error = makeError(kind, error);
    this.emitChange();

    if (!this.cleanupGeneration(generation)) {
      this.error = makeError("cleanup", "Failed to clean failed generation");
      this.emitChange();
    }
    return true;
  }

  shutdown(): boolean {
    if (this.status === "SHUTDOWN") return false;

    const generation = this.generation;
    this.status = "SHUTDOWN";
    this.emitChange();
    if (generation > 0) this.cleanupGeneration(generation);
    return true;
  }

  private beginLoading(): boolean {
    this.generation += 1;
    const generation = this.generation;
    this.status = "LOADING";
    this.progress = 0;
    this.error = undefined;
    this.loadHandle = undefined;
    this.generationCleaned = false;
    this.emitChange();

    const callbacks: AppLoadCallbacks = {
      onProgress: (ratio) => {
        this.reportProgress(generation, ratio);
      },
      onReady: () => {
        this.markReady(generation);
      },
      onError: (error) => {
        this.fail(generation, "required-asset", error);
      },
    };

    try {
      const handle = this.effects.startLoading(generation, callbacks);
      const normalizedHandle = handle === undefined ? undefined : handle;
      if (this.generation === generation && this.status === "LOADING") {
        this.loadHandle = normalizedHandle;
      } else {
        this.cancelHandle(normalizedHandle);
      }
      return this.status === "LOADING" || this.status === "READY";
    } catch (error) {
      if (this.status === "LOADING") this.fail(generation, "boot", error);
      return false;
    }
  }

  private cleanupGeneration(generation: number): boolean {
    if (generation !== this.generation || this.generationCleaned) {
      return true;
    }

    const handle = this.loadHandle;
    this.loadHandle = undefined;
    let succeeded = true;
    try {
      this.cancelHandle(handle);
    } catch {
      succeeded = false;
    }
    try {
      this.effects.cleanup(generation);
    } catch {
      succeeded = false;
    }
    this.generationCleaned = succeeded;
    return succeeded;
  }

  private cancelHandle(handle: AppLoadHandle | undefined): void {
    handle?.cancel();
  }

  private emitChange(): void {
    try {
      this.onChange(this.snapshot);
    } catch {
      // Observers cannot change lifecycle outcomes or break loader callbacks.
    }
  }
}

export function createAppRuntime(options: AppRuntimeOptions): AppRuntime {
  return new AppRuntime(options);
}

export type { AppLoadCallbacks, AppLoadHandle, AppRuntimeEffects } from "./contract.js";

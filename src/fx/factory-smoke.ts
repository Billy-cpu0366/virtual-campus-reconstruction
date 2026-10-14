export const FACTORY_SMOKE_ASSET_KEY = "particle_smoke_white";

export interface SmokeViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type FactorySmokeState = "idle" | "emitting" | "paused" | "error" | "shutdown";

export type FactorySmokeStartFailure = "shutdown" | "missing-texture";

export type FactorySmokeStartResult =
  | { readonly ok: true; readonly generation: number }
  | { readonly ok: false; readonly reason: FactorySmokeStartFailure };

export interface FactorySmokeSnapshot {
  readonly state: FactorySmokeState;
  readonly generation: number;
  readonly visible: boolean;
  readonly emitting: boolean;
  readonly teardownRequested: boolean;
}

function inPaddedViewport(
  viewport: SmokeViewport,
  config: Readonly<{ x: number; y: number; viewportPadding: number }>,
): boolean {
  const left = viewport.left - config.viewportPadding;
  const right = viewport.left + viewport.width + config.viewportPadding;
  const top = viewport.top - config.viewportPadding;
  const bottom = viewport.top + viewport.height + config.viewportPadding;
  return (
    config.x >= left &&
    config.x <= right &&
    config.y >= top &&
    config.y <= bottom
  );
}

function clampProgress(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/** Dedicated owner for one factory smoke generator and its visibility state. */
export class FactorySmokeRuntime {
  private stateState: FactorySmokeState = "idle";
  private generationState = 0;
  private visibleState = false;
  private emittingState = false;
  private teardownRequestedState = false;

  constructor(
    private readonly config: Readonly<{
      x: number;
      y: number;
      width: number;
      widthEnd: number;
      pathHeight: number;
      viewportPadding: number;
    }>,
  ) {}

  get state(): FactorySmokeState {
    return this.stateState;
  }

  get snapshot(): FactorySmokeSnapshot {
    return Object.freeze({
      state: this.stateState,
      generation: this.generationState,
      visible: this.visibleState,
      emitting: this.emittingState,
      teardownRequested: this.teardownRequestedState,
    });
  }

  start(textureAvailable = true): FactorySmokeStartResult {
    if (this.stateState === "shutdown") return { ok: false, reason: "shutdown" };
    if (!textureAvailable) {
      this.stateState = "error";
      this.visibleState = false;
      this.emittingState = false;
      return { ok: false, reason: "missing-texture" };
    }
    if (
      this.stateState === "emitting" ||
      this.stateState === "paused"
    ) {
      return { ok: true, generation: this.generationState };
    }
    this.generationState += 1;
    this.stateState = "paused";
    this.visibleState = false;
    this.emittingState = false;
    this.teardownRequestedState = false;
    return { ok: true, generation: this.generationState };
  }

  updateViewport(viewport: SmokeViewport): FactorySmokeSnapshot {
    if (
      this.stateState === "shutdown" ||
      this.stateState === "idle" ||
      this.stateState === "error"
    ) {
      return this.snapshot;
    }
    const visible = inPaddedViewport(viewport, this.config);
    this.visibleState = visible;
    this.emittingState = visible;
    this.stateState = visible ? "emitting" : "paused";
    return this.snapshot;
  }

  /** Quadratic upward path used by the adapter for alive particles. */
  particlePosition(lifeT: number): { readonly x: number; readonly y: number } {
    const progress = clampProgress(lifeT);
    const halfWidth = lerp(
      this.config.width / 2,
      this.config.widthEnd / 2,
      progress,
    );
    const bend = Math.sin(progress * Math.PI) * halfWidth;
    return Object.freeze({
      x: bend,
      y: progress === 0 ? 0 : -this.config.pathHeight * progress,
    });
  }

  shutdown(): FactorySmokeSnapshot {
    if (this.stateState === "shutdown") return this.snapshot;
    this.stateState = "shutdown";
    this.visibleState = false;
    this.emittingState = false;
    this.teardownRequestedState = true;
    return this.snapshot;
  }
}

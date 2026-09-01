export const FACTORY_SMOKE_TILE_SIZE = 16;
export const FACTORY_SMOKE_VIEWPORT_PADDING = 100;

export const FACTORY_SMOKE_CONFIG = Object.freeze({
  x: 50.5 * FACTORY_SMOKE_TILE_SIZE,
  y: 33.7 * FACTORY_SMOKE_TILE_SIZE,
  width: 7,
  widthEnd: 32,
  pathHeight: 35,
  quantity: 2,
  frequency: 80,
  color: "white",
  scaleStart: 1.6,
  alphaStart: 0.1,
  maxAlpha: 0.25,
  alphaEnd: 0,
  scaleEnd: 4,
  lifespan: 2_000,
  depth: 500,
  reactCars: false,
  reactPlayer: false,
} as const);

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

function inPaddedViewport(viewport: SmokeViewport): boolean {
  const left = viewport.left - FACTORY_SMOKE_VIEWPORT_PADDING;
  const right = viewport.left + viewport.width + FACTORY_SMOKE_VIEWPORT_PADDING;
  const top = viewport.top - FACTORY_SMOKE_VIEWPORT_PADDING;
  const bottom = viewport.top + viewport.height + FACTORY_SMOKE_VIEWPORT_PADDING;
  return (
    FACTORY_SMOKE_CONFIG.x >= left &&
    FACTORY_SMOKE_CONFIG.x <= right &&
    FACTORY_SMOKE_CONFIG.y >= top &&
    FACTORY_SMOKE_CONFIG.y <= bottom
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
    const visible = inPaddedViewport(viewport);
    this.visibleState = visible;
    this.emittingState = visible;
    this.stateState = visible ? "emitting" : "paused";
    return this.snapshot;
  }

  /** Quadratic upward path used by the adapter for alive particles. */
  particlePosition(lifeT: number): { readonly x: number; readonly y: number } {
    const progress = clampProgress(lifeT);
    const halfWidth = lerp(
      FACTORY_SMOKE_CONFIG.width / 2,
      FACTORY_SMOKE_CONFIG.widthEnd / 2,
      progress,
    );
    const bend = Math.sin(progress * Math.PI) * halfWidth;
    return Object.freeze({
      x: bend,
      y: progress === 0 ? 0 : -FACTORY_SMOKE_CONFIG.pathHeight * progress,
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

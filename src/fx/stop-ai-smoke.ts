export const STOP_AI_SMOKE_ASSET_KEY = "particle_smoke_white";
// The public emitter check expands its radius-3 source by 50px.
export const STOP_AI_SMOKE_EMITTER_VIEWPORT_PADDING = 53;
export const STOP_AI_SMOKE_GRAPHIC_VIEWPORT_PADDING = 100;
export const STOP_AI_SMOKE_VISIBILITY_CHECK_MS = 500;
export const STOP_AI_SMOKE_WIND_START_DELAY_MS = 6_000;
export const STOP_AI_SMOKE_WIND_MIN_DELAY_MS = 3_000;
export const STOP_AI_SMOKE_WIND_MAX_DELAY_MS = 6_000;
export const STOP_AI_SMOKE_WIND_MIN_DURATION_MS = 1_500;
export const STOP_AI_SMOKE_WIND_MAX_DURATION_MS = 4_000;

export const STOP_AI_SMOKE_SITES = Object.freeze([
  Object.freeze({
    site: "canister-1",
    x: 1_800,
    y: 1_352,
    graphicColor: 5_596_757,
    graphicAngle: -25,
    angle: Object.freeze({ min: -30, max: 30 }),
  }),
  Object.freeze({
    site: "canister-2",
    x: 1_480,
    y: 1_272,
    graphicColor: 13_369_344,
    graphicAngle: -15,
    angle: Object.freeze({ min: -40, max: 20 }),
  }),
  Object.freeze({
    site: "canister-3",
    x: 1_672,
    y: 1_304,
    graphicColor: 13_369_344,
    graphicAngle: 15,
    angle: Object.freeze({ min: 160, max: 220 }),
  }),
] as const);

export const STOP_AI_SMOKE_LAYERS = Object.freeze([
  "back",
  "main",
  "front",
] as const);

export type StopAiSmokeLayer = (typeof STOP_AI_SMOKE_LAYERS)[number];
export type StopAiSmokeSite = (typeof STOP_AI_SMOKE_SITES)[number]["site"];

const LAYER_SETTINGS: Readonly<Record<StopAiSmokeLayer, {
  readonly alphaStart: number;
  readonly alphaEnd: number;
  readonly depth: number;
}>> = Object.freeze({
  back: Object.freeze({ alphaStart: 0.6, alphaEnd: 0.15, depth: 350 }),
  main: Object.freeze({ alphaStart: 1, alphaEnd: 0.3, depth: 1_160 }),
  front: Object.freeze({ alphaStart: 0.6, alphaEnd: 0.15, depth: 1_550 }),
});

export const STOP_AI_SMOKE_CONFIG = Object.freeze({
  assetKey: STOP_AI_SMOKE_ASSET_KEY,
  speed: Object.freeze({ min: 15, max: 35 }),
  scale: Object.freeze({ start: 0.1, end: 3 }),
  lifespan: 1_800,
  quantity: 2,
  frequency: 20,
  gravityY: -20,
  emitZone: Object.freeze({ type: "circle", radius: 3 }),
  tint: Object.freeze([16_724_787, 16_716_049, 13_369_344]),
  blendMode: "NORMAL",
} as const);

export interface StopAiSmokePlayerPosition {
  readonly x: number;
  readonly y: number;
  readonly bodyBottom?: number;
  readonly depth?: number;
}

export interface StopAiSmokeEmitterConfig {
  readonly site: StopAiSmokeSite;
  readonly layer: StopAiSmokeLayer;
  readonly x: number;
  readonly y: number;
  readonly alpha: Readonly<{ start: number; end: number }>;
  readonly angle: Readonly<{ min: number; max: number }>;
  readonly depth: number;
}

export function stopAiSmokeEmitterConfig(
  site: StopAiSmokeSite,
  layer: StopAiSmokeLayer,
): StopAiSmokeEmitterConfig {
  const location = STOP_AI_SMOKE_SITES.find((item) => item.site === site);
  if (location === undefined) throw new Error(`unknown Stop AI site: ${site}`);
  const settings = LAYER_SETTINGS[layer];
  return Object.freeze({
    site,
    layer,
    x: location.x,
    y: location.y,
    alpha: Object.freeze({
      start: settings.alphaStart,
      end: settings.alphaEnd,
    }),
    angle: location.angle,
    depth: settings.depth,
  });
}

export interface StopAiSmokeViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface StopAiSmokeEmitterSnapshot {
  readonly site: StopAiSmokeSite;
  readonly layer: StopAiSmokeLayer;
  readonly x: number;
  readonly y: number;
  readonly generation: number;
  readonly active: boolean;
  readonly destroyed: boolean;
  readonly windActive: boolean;
  readonly depth: number;
}

export interface StopAiSmokeSnapshot {
  readonly state: "idle" | "active" | "shutdown";
  readonly canisters: readonly StopAiSmokeEmitterSnapshot[];
  readonly graphicsActive: number;
  readonly viewport: StopAiSmokeViewport | null;
}

export function stopAiSmokeSiteInViewport(
  site: StopAiSmokeSite,
  viewport: StopAiSmokeViewport,
  padding = STOP_AI_SMOKE_GRAPHIC_VIEWPORT_PADDING,
): boolean {
  const location = STOP_AI_SMOKE_SITES.find((item) => item.site === site);
  return location === undefined
    ? false
    : inPaddedViewport(location.x, location.y, viewport, padding);
}

export type StopAiSmokeStartResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "shutdown" };

type EmitterState = {
  readonly site: StopAiSmokeSite;
  readonly layer: StopAiSmokeLayer;
  readonly x: number;
  readonly y: number;
  readonly baseDepth: number;
  generation: number;
  active: boolean;
  destroyed: boolean;
  windActive: boolean;
  depth: number;
};

function inPaddedViewport(
  x: number,
  y: number,
  viewport: StopAiSmokeViewport,
  padding: number,
): boolean {
  return (
    x >= viewport.left - padding &&
    x <= viewport.left + viewport.width + padding &&
    y >= viewport.top - padding &&
    y <= viewport.top + viewport.height + padding
  );
}

function emitterKey(site: StopAiSmokeSite, layer: StopAiSmokeLayer): string {
  return `${site}:${layer}`;
}

/** Deterministic core owner for the three Stop AI smoke canisters. */
export class StopAiSmokeRuntime {
  private readonly emitters = new Map<string, EmitterState>();
  private stateState: StopAiSmokeSnapshot["state"] = "idle";
  private viewportState: StopAiSmokeViewport | null = null;
  private graphicsActiveState = 0;
  private playerPositionState: StopAiSmokePlayerPosition | undefined;

  constructor() {
    for (const location of STOP_AI_SMOKE_SITES) {
      for (const layer of STOP_AI_SMOKE_LAYERS) {
        const config = stopAiSmokeEmitterConfig(location.site, layer);
        this.emitters.set(emitterKey(location.site, layer), {
          site: location.site,
          layer,
          x: location.x,
          y: location.y,
          baseDepth: config.depth,
          generation: 0,
          active: false,
          destroyed: false,
          windActive: false,
          depth: config.depth,
        });
      }
    }
  }

  get snapshot(): StopAiSmokeSnapshot {
    return Object.freeze({
      state: this.stateState,
      canisters: Object.freeze(
        [...this.emitters.values()].map((item) =>
          Object.freeze({
            site: item.site,
            layer: item.layer,
            x: item.x,
            y: item.y,
            generation: item.generation,
            active: item.active,
            destroyed: item.destroyed,
            windActive: item.windActive,
            depth: item.depth,
          }),
        ),
      ),
      graphicsActive: this.graphicsActiveState,
      viewport: this.viewportState,
    });
  }

  start(viewport?: StopAiSmokeViewport): StopAiSmokeStartResult {
    if (this.stateState === "shutdown") return { ok: false, reason: "shutdown" };
    if (this.stateState === "idle") {
      this.stateState = "active";
      this.graphicsActiveState = STOP_AI_SMOKE_SITES.length;
    }
    if (viewport !== undefined) this.updateViewport(viewport);
    return { ok: true };
  }

  setPlayerPosition(
    position: StopAiSmokePlayerPosition | undefined,
  ): StopAiSmokeSnapshot {
    this.playerPositionState = position;
    for (const item of this.emitters.values()) {
      if (item.layer !== "main" || position === undefined) continue;
      const playerDepth = position.depth ?? item.baseDepth;
      const playerBottom = position.bodyBottom ?? position.y;
      item.depth = playerBottom > item.y ? playerDepth - 1 : playerDepth + 1;
    }
    return this.snapshot;
  }

  updateViewport(
    viewport: StopAiSmokeViewport,
    checkEmitters = true,
  ): StopAiSmokeSnapshot {
    if (this.stateState !== "active") return this.snapshot;
    this.viewportState = Object.freeze({ ...viewport });
    if (checkEmitters) {
      for (const item of this.emitters.values()) {
        const shouldBeActive = inPaddedViewport(
          item.x,
          item.y,
          viewport,
          STOP_AI_SMOKE_EMITTER_VIEWPORT_PADDING,
        );
        if (shouldBeActive && !item.active) {
          item.generation += 1;
          item.active = true;
          item.destroyed = false;
          item.windActive = false;
        } else if (!shouldBeActive && item.active) {
          item.active = false;
          item.destroyed = true;
          item.windActive = false;
        }
      }
    }
    this.graphicsActiveState = STOP_AI_SMOKE_SITES.filter((site) =>
      inPaddedViewport(
        site.x,
        site.y,
        viewport,
        STOP_AI_SMOKE_GRAPHIC_VIEWPORT_PADDING,
      ),
    ).length;
    return this.snapshot;
  }

  setWindActive(
    site: StopAiSmokeSite,
    layer: StopAiSmokeLayer,
    value: boolean,
  ): StopAiSmokeSnapshot {
    const item = this.emitters.get(emitterKey(site, layer));
    if (item !== undefined) item.windActive = value && item.active;
    return this.snapshot;
  }

  shutdown(): StopAiSmokeSnapshot {
    if (this.stateState === "shutdown") return this.snapshot;
    this.stateState = "shutdown";
    this.graphicsActiveState = 0;
    for (const item of this.emitters.values()) {
      item.active = false;
      item.destroyed = true;
      item.windActive = false;
    }
    return this.snapshot;
  }
}

export function stopAiSmokeEmitterConfigs(): readonly StopAiSmokeEmitterConfig[] {
  return Object.freeze(
    STOP_AI_SMOKE_SITES.flatMap((site) =>
      STOP_AI_SMOKE_LAYERS.map((layer) =>
        stopAiSmokeEmitterConfig(site.site, layer),
      ),
    ),
  );
}
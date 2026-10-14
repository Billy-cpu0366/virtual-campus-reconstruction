export const STOP_AI_SMOKE_ASSET_KEY = "particle_smoke_white";

export const STOP_AI_SMOKE_SITES = Object.freeze([
  Object.freeze({ site: "canister-1" }),
  Object.freeze({ site: "canister-2" }),
  Object.freeze({ site: "canister-3" }),
] as const);

export const STOP_AI_SMOKE_LAYERS = Object.freeze([
  "back",
  "main",
  "front",
] as const);

export type StopAiSmokeLayer = (typeof STOP_AI_SMOKE_LAYERS)[number];
export type StopAiSmokeSite = (typeof STOP_AI_SMOKE_SITES)[number]["site"];

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
  config: Readonly<{
    sites: readonly Readonly<{
      site: StopAiSmokeSite;
      x: number;
      y: number;
      angle: Readonly<{ min: number; max: number }>;
    }>[];
    layerSettings: Readonly<Record<StopAiSmokeLayer, Readonly<{
      alphaStart: number;
      alphaEnd: number;
      depth: number;
    }>>>;
  }>,
): StopAiSmokeEmitterConfig {
  const location = config.sites.find((item) => item.site === site);
  if (location === undefined) throw new Error(`unknown Stop AI site: ${site}`);
  const settings = config.layerSettings[layer];
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
  config: Readonly<{
    sites: readonly Readonly<{ site: StopAiSmokeSite; x: number; y: number }>[];
    graphicViewportPadding: number;
  }>,
  padding = config.graphicViewportPadding,
): boolean {
  const location = config.sites.find((item) => item.site === site);
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

  constructor(
    private readonly config: Readonly<{
      sites: readonly Readonly<{
        site: StopAiSmokeSite;
        x: number;
        y: number;
        angle: Readonly<{ min: number; max: number }>;
      }>[];
      layers: readonly StopAiSmokeLayer[];
      layerSettings: Readonly<Record<StopAiSmokeLayer, Readonly<{
        alphaStart: number;
        alphaEnd: number;
        depth: number;
      }>>>;
      emitterViewportPadding: number;
      graphicViewportPadding: number;
    }>,
  ) {
    for (const location of config.sites) {
      for (const layer of config.layers) {
        const emitterConfig = stopAiSmokeEmitterConfig(location.site, layer, config);
        this.emitters.set(emitterKey(location.site, layer), {
          site: location.site,
          layer,
          x: location.x,
          y: location.y,
          baseDepth: emitterConfig.depth,
          generation: 0,
          active: false,
          destroyed: false,
          windActive: false,
          depth: emitterConfig.depth,
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
      this.graphicsActiveState = this.config.sites.length;
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
          this.config.emitterViewportPadding,
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
    this.graphicsActiveState = this.config.sites.filter((site) =>
      inPaddedViewport(
        site.x,
        site.y,
        viewport,
        this.config.graphicViewportPadding,
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

export function stopAiSmokeEmitterConfigs(
  config: Parameters<typeof stopAiSmokeEmitterConfig>[2] & Readonly<{
    layers: readonly StopAiSmokeLayer[];
  }>,
): readonly StopAiSmokeEmitterConfig[] {
  return Object.freeze(
    config.sites.flatMap((site) =>
      config.layers.map((layer) =>
        stopAiSmokeEmitterConfig(site.site, layer, config),
      ),
    ),
  );
}

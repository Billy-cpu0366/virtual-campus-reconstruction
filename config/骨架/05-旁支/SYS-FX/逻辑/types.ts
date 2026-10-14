import type { StopAiSmokeLayer, StopAiSmokeSite } from "../../../../../src/fx/index.js";

export interface FxPoint {
  readonly x: number;
  readonly y: number;
}

export interface FootstepFxConfig {
  readonly textureKey: string;
  readonly poolSize: number;
  readonly alpha: number;
  readonly spacing: number;
  readonly visibleMs: number;
  readonly fadeMs: number;
  readonly speedThreshold: number;
  readonly maxPlayerDepth: number;
}

export interface FactorySmokeFxConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly widthEnd: number;
  readonly pathHeight: number;
  readonly quantity: number;
  readonly frequency: number;
  readonly scaleStart: number;
  readonly alphaStart: number;
  readonly maxAlpha: number;
  readonly alphaEnd: number;
  readonly scaleEnd: number;
  readonly lifespan: number;
  readonly depth: number;
  readonly reactCars: boolean;
  readonly reactPlayer: boolean;
  readonly viewportPadding: number;
  readonly presentationDepth: number;
}

export interface FogFxConfig {
  readonly polygon: readonly FxPoint[];
  readonly cellSize: number;
  readonly viewportPadding: number;
  readonly clearAhead: number;
  readonly clearWidth: number;
  readonly clearHeight: number;
  readonly carClearRadius: number;
  readonly respawnMs: number;
  readonly depth: number;
  readonly blendMode: string;
  readonly scale: number;
  readonly alpha: number;
  readonly speed: number;
  readonly quantity: number;
  readonly frequency: number;
  readonly lifespan: Readonly<{ min: number; max: number }>;
  readonly tint: readonly number[];
  readonly presentationQuantity: number;
}

export interface StopAiSmokeSiteConfig {
  readonly site: StopAiSmokeSite;
  readonly x: number;
  readonly y: number;
  readonly graphicColor: number;
  readonly graphicAngle: number;
  readonly angle: Readonly<{ min: number; max: number }>;
}

export interface StopAiSmokeLayerSetting {
  readonly alphaStart: number;
  readonly alphaEnd: number;
  readonly depth: number;
}

export interface StopAiSmokeFxConfig {
  readonly sites: readonly StopAiSmokeSiteConfig[];
  readonly layers: readonly StopAiSmokeLayer[];
  readonly layerSettings: Readonly<Record<StopAiSmokeLayer, StopAiSmokeLayerSetting>>;
  readonly speed: Readonly<{ min: number; max: number }>;
  readonly scale: Readonly<{ start: number; end: number }>;
  readonly lifespan: number;
  readonly quantity: number;
  readonly frequency: number;
  readonly gravityY: number;
  readonly emitZoneRadius: number;
  readonly tint: readonly number[];
  readonly blendMode: string;
  readonly emitterViewportPadding: number;
  readonly graphicViewportPadding: number;
  readonly visibilityCheckMs: number;
  readonly windStartDelayMs: number;
  readonly windMinDelayMs: number;
  readonly windMaxDelayMs: number;
  readonly windMinDurationMs: number;
  readonly windMaxDurationMs: number;
}

export interface ConcertLightingAnchor extends FxPoint {
  readonly phase: number;
}

export interface ConcertSpotlightAnchor extends ConcertLightingAnchor {
  readonly radius: number;
}

export interface ConcertColorLightAnchor extends ConcertLightingAnchor {
  readonly color: number;
}

export interface ConcertLaserAnchor {
  readonly tileX: number;
  readonly tileY: number;
  readonly phase: number;
}

export interface ConcertLightingFxConfig {
  readonly bounds: Readonly<{ left: number; top: number; right: number; bottom: number }>;
  readonly darkZoneDepth: number;
  readonly spotlights: readonly ConcertSpotlightAnchor[];
  readonly colorLights: readonly ConcertColorLightAnchor[];
  readonly lasers: readonly ConcertLaserAnchor[];
  readonly laserDepth: number;
}

export interface PlayerVisualFxConfig {
  readonly stepMs: number;
  readonly snapDistance: number;
}

export interface FxConfigs {
  readonly footstep: FootstepFxConfig;
  readonly factorySmoke: FactorySmokeFxConfig;
  readonly fog: FogFxConfig;
  readonly stopAiSmoke: StopAiSmokeFxConfig;
  readonly concertLighting: ConcertLightingFxConfig;
  readonly playerVisual: PlayerVisualFxConfig;
}

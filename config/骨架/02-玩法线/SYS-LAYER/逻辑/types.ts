import type {
  LayerStrategy,
  RoofGroup,
} from "../../../../../src/layer/contract.js";

export interface LayerTileRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface LayerPixelRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface LayerConfigs {
  readonly strategies: readonly LayerStrategy[];
  readonly strategiesByName: Readonly<Record<string, LayerStrategy>>;
  readonly bridges: Readonly<{
    bridge1: Readonly<{ up: string; down: string }>;
    bridge2: Readonly<{ up: string; down: string }>;
  }>;
  readonly roofGroups: Readonly<Record<RoofGroup, readonly string[]>>;
  /** 由 roofGroups 按原顺序展开，属于派生值，不在 JSON 另存。 */
  readonly roofLayers: readonly string[];
  readonly playerDepth: Readonly<{
    base: number;
    yOffset: number;
    ratio: number;
  }>;
  readonly bridgePlayerDepth: number;
  readonly roofFadeMs: number;
  readonly roofTweenEase: string;
  readonly footstepDepth: number;
  readonly collisionGidForced: number;
  readonly nonCollisionGidForced: number;
  readonly bridgeZones: Readonly<{
    bridge1: Readonly<{
      entry: readonly LayerTileRect[];
      exit: readonly LayerTileRect[];
    }>;
    bridge2: Readonly<{ zones: readonly LayerTileRect[] }>;
  }>;
  readonly roofZones: Readonly<{
    factory: LayerPixelRect;
    concert: LayerPixelRect;
  }>;
}

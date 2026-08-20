export type {
  BridgeState,
  LayerRole,
  LayerStrategy,
  RoofState,
} from "./contract.js";
export {
  activeBridgeWallLayer,
  BRIDGES,
  layerNames,
  layerRole,
  layerStrategy,
  LAYER_STRATEGIES,
  ROOF_LAYERS,
} from "./strategy.js";
export {
  isBridge1EntryZone,
  isBridge1ExitZone,
  isBridge2Zone,
} from "./bridge-zones.js";
export {
  BRIDGE_PLAYER_DEPTH,
  COLLISION_GID_FORCED,
  FOOTSTEP_DEPTH,
  isForcedCollision,
  isForcedNonCollision,
  NON_COLLISION_GID_FORCED,
  playerDepth,
  roofAlpha,
  ROOF_FADE_MS,
  WALLS_DEPTH,
} from "./depth.js";

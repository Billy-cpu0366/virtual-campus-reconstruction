import type {
  BridgeState,
  LayerRole,
  LayerStrategy,
  RoofGroup,
} from "./contract.js";

export function layerNames(strategies: readonly LayerStrategy[]): readonly string[] {
  return strategies.map((strategy) => strategy.name);
}

export function layerStrategy(
  name: string,
  strategiesByName: Readonly<Record<string, LayerStrategy>>,
): LayerStrategy {
  const strategy = strategiesByName[name];
  if (strategy === undefined) {
    throw new Error(`未知图层：${name}`);
  }
  return strategy;
}

export function layerRole(
  name: string,
  strategiesByName: Readonly<Record<string, LayerStrategy>>,
): LayerRole {
  return layerStrategy(name, strategiesByName).role;
}

export function rawVisualGids(
  name: string,
  strategiesByName: Readonly<Record<string, LayerStrategy>>,
): readonly number[] {
  return layerStrategy(name, strategiesByName).rawGids ?? [];
}

export function isKnownRawVisualGid(
  name: string,
  gid: number,
  strategiesByName: Readonly<Record<string, LayerStrategy>>,
): boolean {
  return layerRole(name, strategiesByName) === "visual" &&
    rawVisualGids(name, strategiesByName).includes(gid);
}

export function activeBridgeWallLayer(
  bridge: { readonly up: string; readonly down: string },
  state: BridgeState,
): string {
  return state === "up" ? bridge.up : bridge.down;
}

export function roofGroupForLayer(
  name: string,
  groups: Readonly<Record<RoofGroup, readonly string[]>>,
): RoofGroup | undefined {
  for (const [group, layers] of Object.entries(groups)) {
    if (layers.includes(name)) {
      return group as RoofGroup;
    }
  }
  return undefined;
}

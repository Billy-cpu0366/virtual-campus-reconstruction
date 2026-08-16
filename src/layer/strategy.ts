import type { BridgeState, LayerRole, LayerStrategy } from "./contract.js";

// 24 层策略表 = 唯一图层合同（SYS-LAYER 卡 §2）。
// 顺序与 chunk JSON 的层顺序一致（FACT：24 个 chunk 层名/顺序完全一致）。
// role 与 depth 为设计默认；roof 逐层 depth 未逐一定位，按 FACT 范围 3000–3300 顺序取值。
export const LAYER_STRATEGIES: readonly LayerStrategy[] = [
  { name: "layer1", role: "visual", depth: 100 },
  { name: "layer2", role: "visual", depth: 200 },
  { name: "layer3", role: "visual", depth: 300 },
  { name: "layer4", role: "visual", depth: 400 },
  { name: "layer5", role: "visual", depth: 500 },
  { name: "layer6", role: "visual", depth: 1500 },
  { name: "layer7", role: "visual", depth: 1600 },
  { name: "layer8", role: "visual", depth: 1700 },
  { name: "layer9", role: "visual", depth: 1800 },
  { name: "layer10", role: "visual", depth: 1900 },
  { name: "cars", role: "marker", depth: 550 },
  { name: "roof_concert", role: "dynamic-visual", depth: 3000 },
  { name: "roof_concert2", role: "dynamic-visual", depth: 3100 },
  { name: "roof_factory", role: "dynamic-visual", depth: 3200 },
  { name: "roof_factory2", role: "dynamic-visual", depth: 3300 },
  { name: "bridge1_up_wall", role: "dynamic-collision", depth: 3500 },
  { name: "bridge1_down_wall", role: "dynamic-collision", depth: 3500 },
  { name: "bridge2_up_wall", role: "dynamic-collision", depth: 3500 },
  { name: "bridge2_down_wall", role: "dynamic-collision", depth: 3500 },
  { name: "walls", role: "collision", depth: 550 },
  { name: "particles", role: "marker", depth: undefined },
  { name: "particles2", role: "marker", depth: undefined },
  { name: "particles3", role: "marker", depth: undefined },
  { name: "footsteps", role: "marker", depth: undefined },
];

const BY_NAME = new Map<string, LayerStrategy>(
  LAYER_STRATEGIES.map((s) => [s.name, s]),
);

export function layerNames(): readonly string[] {
  return LAYER_STRATEGIES.map((s) => s.name);
}

export function layerStrategy(name: string): LayerStrategy {
  const strategy = BY_NAME.get(name);
  if (strategy === undefined) {
    throw new Error(`未知图层：${name}`);
  }
  return strategy;
}

export function layerRole(name: string): LayerRole {
  return layerStrategy(name).role;
}

// 桥：上下墙层名（FACT，chunk 数据层名）。
export const BRIDGES = {
  bridge1: { up: "bridge1_up_wall", down: "bridge1_down_wall" },
  bridge2: { up: "bridge2_up_wall", down: "bridge2_down_wall" },
} as const;

export function activeBridgeWallLayer(
  bridge: { readonly up: string; readonly down: string },
  state: BridgeState,
): string {
  return state === "up" ? bridge.up : bridge.down;
}

// 屋顶：4 个 roof 层名（FACT）。
export const ROOF_LAYERS: readonly string[] = [
  "roof_concert",
  "roof_concert2",
  "roof_factory",
  "roof_factory2",
];

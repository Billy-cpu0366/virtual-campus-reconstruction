// SYS-WORLD 确定性 CORE 的公共类型。
import type { ChunkCoordinate } from "../chunk/coordinates.js";
import type { LayerStrategy } from "../layer/contract.js";

export class WorldSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldSpecError";
  }
}

export class WorldChunkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldChunkError";
  }
}

// 世界规格（创建后只读）。世界尺寸 = chunk 尺寸 × 网格数；像素 = tile 尺寸 × tile 数。
export interface WorldSpec {
  readonly chunkWidthTiles: number;
  readonly chunkHeightTiles: number;
  readonly chunksHorizontal: number;
  readonly chunksVertical: number;
  readonly worldWidthTiles: number;
  readonly worldHeightTiles: number;
  readonly tileWidthPixels: number;
  readonly tileHeightPixels: number;
  readonly worldPixelWidth: number;
  readonly worldPixelHeight: number;
}

export interface ChunkLayer {
  readonly name: string;
  readonly data: readonly number[];
}

export interface ValidatedChunk {
  readonly coordinate: ChunkCoordinate;
  readonly layers: readonly ChunkLayer[];
}

// 完整生命周期（FACT，见 SYS-WORLD 卡 §3）。纯逻辑 CORE 只可观察 ready 与 destroyed；
// uninitialized/creating/failed/destroying 为异步或瞬态，正式 Phaser 实现前不进入。
export type WorldLifecycle =
  | "uninitialized"
  | "creating"
  | "ready"
  | "failed"
  | "destroying"
  | "destroyed";

// 模拟 Tilemap 层写入/清除的注入点（默认空操作）。抛错用于触发并测试回滚路径。
export interface WorldWriteHooks {
  writeLayer?(layer: ChunkLayer, coordinate: ChunkCoordinate): void;
  clearLayer?(layer: ChunkLayer, coordinate: ChunkCoordinate): void;
  writeLayerAsync?(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): Promise<void>;
  clearLayerAsync?(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): Promise<void>;
}

export interface CreateWorldOptions {
  // 图层计划（24 层策略）唯一来源是 SYS-LAYER；默认用 LAYER_STRATEGIES。世界只消费。
  readonly layerPlan?: readonly LayerStrategy[];
  readonly hooks?: WorldWriteHooks;
}

export interface World {
  readonly spec: WorldSpec;
  readonly state: WorldLifecycle;
  readonly renderedChunks: readonly ChunkCoordinate[];
  applyChunk(chunk: ValidatedChunk): ApplyResult;
  applyChunkAsync?(chunk: ValidatedChunk): Promise<ApplyResult>;
  removeChunk(coordinate: ChunkCoordinate): RemoveResult;
  removeChunkAsync?(coordinate: ChunkCoordinate): Promise<RemoveResult>;
  destroy(): void;
}

export type WorldCreateResult =
  | { readonly kind: "ready"; readonly world: World }
  | { readonly kind: "failure"; readonly reason: string };

export type ApplyResult =
  | { readonly kind: "applied" }
  | { readonly kind: "already-applied" }
  | { readonly kind: "failure"; readonly reason: string };

export type RemoveResult =
  | { readonly kind: "removed" }
  | { readonly kind: "already-absent" }
  | { readonly kind: "failure"; readonly reason: string };

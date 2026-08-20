import type { ChunkCoordinate } from "../src/chunk/index.js";
import type {
  ChunkLayer,
  WorldSpec,
  WorldWriteHooks,
} from "../src/world/index.js";
import {
  COLLISION_GID_FORCED,
  NON_COLLISION_GID_FORCED,
  type LayerStrategy,
} from "../src/layer/index.js";

interface TileLike {
  readonly index: number;
  setCollision?(collides: boolean): void;
}

export interface TilemapLayerLike {
  forEachTile?(
    callback: (tile: TileLike) => void,
    context?: unknown,
    tileX?: number,
    tileY?: number,
    width?: number,
    height?: number,
  ): void;
  putTilesAt?(
    tiles: readonly (readonly number[])[],
    tileX: number,
    tileY: number,
    recalculateFaces?: boolean,
  ): void;
  putTileAt?(
    index: number,
    tileX: number,
    tileY: number,
    recalculateFaces?: boolean,
  ): void;
  setAlpha?(value: number): void;
  setCollision?(
    tiles: number | readonly number[],
    collides?: boolean,
    recalculateFaces?: boolean,
  ): void;
  setCollisionByProperty?(
    properties: Record<string, unknown>,
    collides?: boolean,
    recalculateFaces?: boolean,
  ): void;
  setCollisionByExclusion?(
    exclusion: readonly number[],
    collides?: boolean,
    recalculateFaces?: boolean,
  ): void;
  setDepth?(depth: number): void;
  setVisible?(value: boolean): void;
  destroy?(fromScene?: boolean): void;
}

export interface PhaserWorldRendererOptions {
  readonly onCollisionLayerCreated?: (
    name: string,
    layer: TilemapLayerLike,
  ) => void;
  readonly onCollisionLayerDestroyed?: (
    name: string,
    layer: TilemapLayerLike,
  ) => void | Promise<void>;
}

function coordinateKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}_${coordinate.y}`;
}

function isCollisionRole(role: LayerStrategy["role"]): boolean {
  return role === "collision" || role === "dynamic-collision";
}

function isMarkerRole(role: LayerStrategy["role"]): boolean {
  return role === "marker";
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Phaser-only adapter. Each rendered chunk owns a small 28x28 Tilemap layer;
 * World still owns transaction order and rendered-chunk bookkeeping.
 */
export class PhaserWorldRenderer {
  readonly map: any;
  readonly tilesets: readonly unknown[];
  readonly spec: WorldSpec;
  readonly layers = new Map<string, TilemapLayerLike>();
  readonly strategies: readonly LayerStrategy[];
  readonly #options: PhaserWorldRendererOptions;
  readonly #collisionEnabled = new Map<string, boolean>();

  constructor(
    map: any,
    tilesets: readonly unknown[],
    spec: WorldSpec,
    strategies: readonly LayerStrategy[],
    options: PhaserWorldRendererOptions = {},
  ) {
    this.map = map;
    this.tilesets = tilesets;
    this.spec = spec;
    this.strategies = strategies;
    this.#options = options;
    this.#collisionEnabled.set("walls", true);
  }

  hooks(): WorldWriteHooks {
    return {
      writeLayer: (layer, coordinate) => {
        this.writeLayer(layer, coordinate);
      },
      clearLayer: (layer, coordinate) => {
        this.clearLayer(layer, coordinate);
      },
      writeLayerAsync: (layer, coordinate) =>
        this.writeLayerAsync(layer, coordinate),
      clearLayerAsync: (layer, coordinate) =>
        this.clearLayerAsync(layer, coordinate),
    };
  }

  private isMarkerLayer(name: string): boolean {
    const strategy = this.strategies.find((item) => item.name === name);
    return strategy === undefined || isMarkerRole(strategy.role);
  }

  private strategyFor(name: string): LayerStrategy {
    const strategy = this.strategies.find((item) => item.name === name);
    if (strategy === undefined) {
      throw new Error(`未知图层不可写：${name}`);
    }
    return strategy;
  }

  private isCollisionLayer(name: string): boolean {
    return isCollisionRole(this.strategyFor(name).role);
  }

  private collisionEnabled(name: string): boolean {
    return this.#collisionEnabled.get(name) ?? false;
  }

  private layersFor(name: string): readonly TilemapLayerLike[] {
    const prefix = `${name}@`;
    return [...this.layers.entries()]
      .filter(([id]) => id.startsWith(prefix))
      .map(([, layer]) => layer);
  }

  private configureCollisionLayer(
    name: string,
    layer: TilemapLayerLike,
  ): void {
    if (!this.isCollisionLayer(name)) {
      return;
    }
    const enabled = this.collisionEnabled(name);
    const strategy = this.strategyFor(name);
    if (strategy.role === "collision") {
      layer.setCollisionByProperty?.({ collides: true }, enabled, false);
      if (layer.forEachTile !== undefined) {
        layer.forEachTile((tile) => {
          if (tile.index === COLLISION_GID_FORCED) {
            tile.setCollision?.(enabled);
          } else if (tile.index === NON_COLLISION_GID_FORCED) {
            tile.setCollision?.(false);
          }
        });
      } else {
        layer.setCollision?.(COLLISION_GID_FORCED, enabled, false);
        layer.setCollision?.(NON_COLLISION_GID_FORCED, false, false);
      }
      layer.setVisible?.(false);
    } else {
      if (layer.forEachTile !== undefined) {
        layer.forEachTile((tile) => {
          if (tile.index !== -1) {
            tile.setCollision?.(enabled);
          }
        });
      } else {
        layer.setCollisionByExclusion?.([-1], enabled, false);
      }
      layer.setAlpha?.(0);
      layer.setVisible?.(enabled);
    }
  }

  setCollisionLayerEnabled(name: string, enabled: boolean): void {
    if (!this.isCollisionLayer(name)) {
      throw new Error(`非碰撞图层不可切换碰撞：${name}`);
    }
    this.#collisionEnabled.set(name, enabled);
    for (const layer of this.layersFor(name)) {
      this.configureCollisionLayer(name, layer);
    }
  }

  async destroyAsync(): Promise<void> {
    for (const [id, layer] of [...this.layers]) {
      const name = id.slice(0, id.indexOf("@"));
      if (isCollisionRole(this.strategyFor(name).role)) {
        await this.#options.onCollisionLayerDestroyed?.(name, layer);
      }
      layer.destroy?.();
    }
    this.layers.clear();
  }

  private layerId(
    layerName: string,
    coordinate: ChunkCoordinate,
  ): string {
    return `${layerName}@${coordinateKey(coordinate)}`;
  }

  private createLayer(
    strategy: LayerStrategy,
    coordinate: ChunkCoordinate,
  ): TilemapLayerLike {
    const id = this.layerId(strategy.name, coordinate);
    const existing = this.layers.get(id);
    if (existing !== undefined) {
      return existing;
    }

    const originX = coordinate.x * this.spec.chunkWidthTiles;
    const originY = coordinate.y * this.spec.chunkHeightTiles;
    const layer = this.map.createBlankLayer(
      id,
      this.tilesets,
      originX * this.spec.tileWidthPixels,
      originY * this.spec.tileHeightPixels,
      this.spec.chunkWidthTiles,
      this.spec.chunkHeightTiles,
      this.spec.tileWidthPixels,
      this.spec.tileHeightPixels,
    ) as TilemapLayerLike | null;
    if (layer === null || layer === undefined) {
      throw new Error(`无法创建 Tilemap 图层：${id}`);
    }
    if (strategy.depth !== undefined) {
      layer.setDepth?.(strategy.depth);
    }
    this.configureCollisionLayer(strategy.name, layer);
    if (this.layers.size < 3) {
      console.log(
        "renderer:create",
        id,
        originX,
        originY,
        (layer as any).x,
        (layer as any).y,
        (layer as any).layer?.width,
        (layer as any).layer?.height,
        (layer as any).visible,
        (layer as any).active,
        (layer as any).getBounds?.(),
      );
    }
    this.layers.set(id, layer);
    if (isCollisionRole(strategy.role)) {
      this.#options.onCollisionLayerCreated?.(strategy.name, layer);
    }
    return layer;
  }

  private targetFor(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): TilemapLayerLike {
    const strategy = this.strategyFor(layer.name);
    const target = this.createLayer(strategy, coordinate);
    if (target.putTilesAt === undefined && target.putTileAt === undefined) {
      throw new Error(`Tilemap 图层不可写：${layer.name}`);
    }
    return target;
  }

  private rowsForLayer(layer: ChunkLayer): number[][] {
    const rows: number[][] = [];
    for (let row = 0; row < this.spec.chunkHeightTiles; row += 1) {
      const start = row * this.spec.chunkWidthTiles;
      const values = layer.data.slice(
        start,
        start + this.spec.chunkWidthTiles,
      );
      if (values.length !== this.spec.chunkWidthTiles) {
        throw new Error(`chunk 层数据缺少索引：${layer.name}[${start}]`);
      }
      rows.push(values);
    }
    return rows;
  }

  private writeRows(
    target: TilemapLayerLike,
    rows: readonly (readonly number[])[],
    layerName: string,
  ): void {
    if (target.putTilesAt !== undefined) {
      if (this.layers.size <= 3) {
        console.log("renderer:write", layerName, rows.length, rows[0]?.length);
      }
      // Tiled 用 GID 0 表示空格；Phaser Tilemap 用 -1 表示空 tile。
      // 直接传 0 会让 Phaser 按 tiles[0] 查找并在多 tileset 下抛错。
      const phaserRows = rows.map((row) =>
        row.map((tile) => (tile === 0 ? -1 : tile)),
      );
      target.putTilesAt(phaserRows, 0, 0, false);
      if (this.layers.size <= 3) {
        console.log(
          "renderer:after",
          (target as any).layer?.data?.[0]?.[0]?.index,
          (target as any).layer?.data?.[0]?.[0]?.gid,
        );
      }
      return;
    }
    for (let row = 0; row < rows.length; row += 1) {
      const rowValues = rows[row];
      if (rowValues === undefined) {
        throw new Error(`chunk 层数据缺少行：${layerName}[${row}]`);
      }
      for (let column = 0; column < rowValues.length; column += 1) {
        const tile = rowValues[column];
        if (tile === undefined) {
          throw new Error(`chunk 层数据缺少索引：${layerName}[${column}]`);
        }
        if (tile !== 0) {
          target.putTileAt?.(tile, column, row, false);
        }
      }
    }
  }

  private writeLayer(layer: ChunkLayer, coordinate: ChunkCoordinate): void {
    if (this.isMarkerLayer(layer.name)) {
      return;
    }
    const target = this.targetFor(layer, coordinate);
    this.writeRows(target, this.rowsForLayer(layer), layer.name);
    this.configureCollisionLayer(layer.name, target);
  }

  private async writeLayerAsync(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): Promise<void> {
    if (this.isMarkerLayer(layer.name)) {
      return;
    }
    const target = this.targetFor(layer, coordinate);
    const rows = this.rowsForLayer(layer);
    const rowsPerFrame = this.spec.chunkHeightTiles;
    for (let start = 0; start < rows.length; start += rowsPerFrame) {
      this.writeRows(
        target,
        rows.slice(start, start + rowsPerFrame),
        layer.name,
      );
      if (start + rowsPerFrame < rows.length) {
        await nextAnimationFrame();
      }
    }
    this.configureCollisionLayer(layer.name, target);
    await nextAnimationFrame();
  }

  private destroyLayer(id: string, layer: TilemapLayerLike): void {
    // Remove the Tilemap layer record before destroying the display object.
    // Phaser updates subsequent layerIndex values in removeLayer; destroying
    // first can leave a collider pointing at a different dead layer.
    if (this.map.removeLayer !== undefined) {
      this.map.removeLayer(layer);
      layer.destroy?.();
    } else if (this.map.destroyLayer !== undefined) {
      this.map.destroyLayer(layer);
    } else {
      layer.destroy?.();
    }
    this.layers.delete(id);
  }

  private clearLayer(layer: ChunkLayer, coordinate: ChunkCoordinate): void {
    if (this.isMarkerLayer(layer.name)) {
      return;
    }
    const id = this.layerId(layer.name, coordinate);
    const target = this.layers.get(id);
    if (target === undefined) {
      return;
    }
    if (this.isCollisionLayer(layer.name)) {
      this.#options.onCollisionLayerDestroyed?.(layer.name, target);
    }
    this.destroyLayer(id, target);
  }

  private async clearLayerAsync(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): Promise<void> {
    if (this.isMarkerLayer(layer.name)) {
      return;
    }
    const id = this.layerId(layer.name, coordinate);
    const target = this.layers.get(id);
    if (target === undefined) {
      return;
    }
    if (this.isCollisionLayer(layer.name)) {
      await this.#options.onCollisionLayerDestroyed?.(layer.name, target);
    }
    // Arcade queues collider removal until its next physics update. Wait for
    // the current frame to finish before destroying the Tilemap layer it
    // references.
    target.setVisible?.(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (this.layers.get(id) === target) {
      this.destroyLayer(id, target);
    }
  }
}

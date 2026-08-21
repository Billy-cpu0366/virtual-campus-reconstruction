import type { ChunkCoordinate } from "../src/chunk/index.js";
import type {
  ChunkLayer,
  WorldSpec,
  WorldWriteHooks,
} from "../src/world/index.js";
import {
  COLLISION_GID_FORCED,
  diagnosticForMarker,
  extractMarkerRecords,
  isKnownRawVisualGid,
  NON_COLLISION_GID_FORCED,
  roofAlpha,
  roofGroupForLayer,
  ROOF_FADE_MS,
  ROOF_GROUPS,
  type LayerDiagnostic,
  type LayerMarkerRecord,
  type LayerStrategy,
  type RoofGroup,
  type RoofGroupState,
  type RoofState,
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
  destroy?(removeFromTilemap?: boolean): void;
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
  readonly onRoofStateApplied?: (
    state: RoofGroupState,
    layers: readonly TilemapLayerLike[],
  ) => void;
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
  readonly #markers = new Map<string, readonly LayerMarkerRecord[]>();
  readonly #diagnostics = new Map<string, readonly LayerDiagnostic[]>();
  readonly #roofStates = new Map<RoofGroup, RoofState>([
    ["concert", "visible"],
    ["factory", "visible"],
  ]);
  #destroyPromise: Promise<void> | undefined;

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

  get markers(): readonly LayerMarkerRecord[] {
    return [...this.#markers.values()].flatMap((records) => records);
  }

  get markerRecords(): readonly LayerMarkerRecord[] {
    return this.markers;
  }

  get diagnostics(): readonly LayerDiagnostic[] {
    return [...this.#diagnostics.values()].flatMap((items) => items);
  }

  get particles3Diagnostics(): readonly LayerDiagnostic[] {
    return this.diagnostics.filter((item) => item.layerName === "particles3");
  }

  markersForChunk(
    coordinate: ChunkCoordinate,
  ): readonly LayerMarkerRecord[] {
    return this.markers.filter(
      (marker) =>
        marker.chunk.x === coordinate.x && marker.chunk.y === coordinate.y,
    );
  }

  diagnosticsForChunk(
    coordinate: ChunkCoordinate,
  ): readonly LayerDiagnostic[] {
    return this.diagnostics.filter(
      (diagnostic) =>
        diagnostic.chunk.x === coordinate.x &&
        diagnostic.chunk.y === coordinate.y,
    );
  }

  getRoofState(group: RoofGroup): RoofGroupState {
    const state = this.#roofStates.get(group) ?? "visible";
    return {
      group,
      state,
      visible: true,
      alpha: roofAlpha(state),
      durationMs: ROOF_FADE_MS,
    };
  }

  setRoofState(group: RoofGroup, state: RoofState): RoofGroupState {
    const changed = this.#roofStates.get(group) !== state;
    this.#roofStates.set(group, state);
    const next = this.getRoofState(group);
    if (!changed) {
      return next;
    }
    const layers = ROOF_GROUPS[group].flatMap((layerName) =>
      this.layersFor(layerName),
    );
    if (this.#options.onRoofStateApplied !== undefined) {
      this.#options.onRoofStateApplied(next, layers);
    } else {
      for (const layerName of ROOF_GROUPS[group]) {
        for (const layer of this.layersFor(layerName)) {
          this.applyRoofState(layerName, layer);
        }
      }
    }
    return next;
  }

  private isMarkerLayer(name: string): boolean {
    return isMarkerRole(this.strategyFor(name).role);
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

  destroyAsync(): Promise<void> {
    if (this.#destroyPromise !== undefined) {
      return this.#destroyPromise;
    }
    this.#destroyPromise = this.destroyInternal();
    return this.#destroyPromise;
  }

  private async destroyInternal(): Promise<void> {
    let firstError: unknown;
    const rememberError = (error: unknown): void => {
      if (firstError === undefined) {
        firstError = error;
      }
    };

    try {
      for (const [id, layer] of [...this.layers]) {
        const name = id.slice(0, id.indexOf("@"));
        try {
          if (isCollisionRole(this.strategyFor(name).role)) {
            await this.#options.onCollisionLayerDestroyed?.(name, layer);
          }
        } catch (error) {
          rememberError(error);
        }
        try {
          this.destroyLayer(id, layer);
        } catch (error) {
          rememberError(error);
        }
      }

      try {
        this.map.destroy?.();
      } catch (error) {
        rememberError(error);
      }
    } finally {
      this.layers.clear();
      this.#markers.clear();
      this.#diagnostics.clear();
      this.#roofStates.clear();
      this.#collisionEnabled.clear();
    }

    if (firstError !== undefined) {
      throw firstError;
    }
  }

  private layerId(
    layerName: string,
    coordinate: ChunkCoordinate,
  ): string {
    return `${layerName}@${coordinateKey(coordinate)}`;
  }

  private applyRoofState(
    layerName: string,
    layer: TilemapLayerLike,
  ): void {
    const group = roofGroupForLayer(layerName);
    if (group === undefined) {
      throw new Error(`未知 roof 图层：${layerName}`);
    }
    const state = this.#roofStates.get(group) ?? "visible";
    layer.setVisible?.(true);
    layer.setAlpha?.(roofAlpha(state));
  }

  private writeMarkers(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): void {
    const records = extractMarkerRecords(
      layer.name,
      layer.data,
      coordinate,
      this.spec.chunkWidthTiles,
      this.spec.chunkHeightTiles,
      this.spec.tileWidthPixels,
      this.spec.tileHeightPixels,
    );
    const diagnostics = records
      .map((marker) => diagnosticForMarker(marker))
      .filter((diagnostic): diagnostic is LayerDiagnostic =>
        diagnostic !== undefined,
      );
    const id = this.layerId(layer.name, coordinate);
    this.#markers.set(id, records);
    this.#diagnostics.set(id, Object.freeze(diagnostics));
  }

  private clearMarkers(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): void {
    const id = this.layerId(layer.name, coordinate);
    this.#markers.delete(id);
    this.#diagnostics.delete(id);
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
    if (strategy.role === "dynamic-visual") {
      this.applyRoofState(strategy.name, layer);
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
    const strategy = this.strategyFor(layer.name);
    if (strategy.rawGids !== undefined) {
      for (let index = 0; index < layer.data.length; index += 1) {
        const gid = layer.data[index];
        if (
          gid === undefined ||
          gid === 0 ||
          isKnownRawVisualGid(layer.name, gid)
        ) {
          continue;
        }
        const localX = index % this.spec.chunkWidthTiles;
        const localY = Math.floor(index / this.spec.chunkWidthTiles);
        throw new Error(
          `未知 raw visual GID：layer=${layer.name}, ` +
            `local=(${localX},${localY}), gid=${gid}`,
        );
      }
    }

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
      this.writeMarkers(layer, coordinate);
      return;
    }
    const rows = this.rowsForLayer(layer);
    const target = this.targetFor(layer, coordinate);
    this.writeRows(target, rows, layer.name);
    this.configureCollisionLayer(layer.name, target);
  }

  private async writeLayerAsync(
    layer: ChunkLayer,
    coordinate: ChunkCoordinate,
  ): Promise<void> {
    if (this.isMarkerLayer(layer.name)) {
      this.writeMarkers(layer, coordinate);
      return;
    }
    const rows = this.rowsForLayer(layer);
    const target = this.targetFor(layer, coordinate);
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
      // Phaser TilemapLayer.destroy() defaults to removing itself from the
      // Tilemap. We already removed it above, so prevent a second removal
      // from corrupting the remaining LayerData indexes.
      layer.destroy?.(false);
    } else if (this.map.destroyLayer !== undefined) {
      this.map.destroyLayer(layer);
    } else {
      layer.destroy?.();
    }
    this.layers.delete(id);
  }

  private clearLayer(layer: ChunkLayer, coordinate: ChunkCoordinate): void {
    if (this.isMarkerLayer(layer.name)) {
      this.clearMarkers(layer, coordinate);
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
      this.clearMarkers(layer, coordinate);
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

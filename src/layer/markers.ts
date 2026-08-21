import type { ChunkCoordinate } from "../chunk/coordinates.js";
import {
  layerRole,
  layerStrategy,
  LAYER_STRATEGIES,
} from "./strategy.js";

export interface TileCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface PixelCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface LayerMarkerRecord {
  readonly layerName: string;
  readonly gid: number;
  readonly localTile: TileCoordinate;
  readonly worldTile: TileCoordinate;
  readonly worldPixel: PixelCoordinate;
  /** The chunk that supplied this marker. */
  readonly chunk: ChunkCoordinate;
}

export interface LayerDiagnostic {
  readonly kind: "unconsumed-marker";
  readonly layerName: "particles3";
  readonly gid: number;
  readonly localTile: TileCoordinate;
  readonly worldTile: TileCoordinate;
  readonly chunk: ChunkCoordinate;
  readonly message: string;
}

export function markerLayerNames(): readonly string[] {
  return LAYER_STRATEGIES.filter((strategy) => strategy.role === "marker").map(
    (strategy) => strategy.name,
  );
}

export function markerGids(layerName: string): readonly number[] {
  return layerStrategy(layerName).markerGids ?? [];
}

export function isKnownMarkerGid(layerName: string, gid: number): boolean {
  return layerRole(layerName) === "marker" && markerGids(layerName).includes(gid);
}

function freezeCoordinate(coordinate: TileCoordinate): TileCoordinate {
  return Object.freeze({ x: coordinate.x, y: coordinate.y });
}

function markerError(
  layerName: string,
  chunk: ChunkCoordinate,
  localTile: TileCoordinate,
  gid: number,
): Error {
  return new Error(
    `未知 marker GID：layer=${layerName}, ` +
      `chunk=(${chunk.x},${chunk.y}), ` +
      `local=(${localTile.x},${localTile.y}), gid=${gid}`,
  );
}

export function extractMarkerRecords(
  layerName: string,
  data: readonly number[],
  chunk: ChunkCoordinate,
  chunkWidthTiles: number,
  chunkHeightTiles: number,
  tileWidthPixels: number,
  tileHeightPixels: number,
): readonly LayerMarkerRecord[] {
  if (layerRole(layerName) !== "marker" || markerGids(layerName).length === 0) {
    throw new Error(`不是 marker 图层：${layerName}`);
  }
  if (
    !Number.isInteger(chunkWidthTiles) ||
    !Number.isInteger(chunkHeightTiles) ||
    chunkWidthTiles <= 0 ||
    chunkHeightTiles <= 0
  ) {
    throw new Error(`marker 图层尺寸无效：${layerName}`);
  }
  const expectedLength = chunkWidthTiles * chunkHeightTiles;
  if (data.length !== expectedLength) {
    throw new Error(
      `marker 图层数据长度无效：layer=${layerName}, ` +
        `expected=${expectedLength}, actual=${data.length}`,
    );
  }

  const records: LayerMarkerRecord[] = [];
  for (let index = 0; index < data.length; index += 1) {
    const gid = data[index];
    if (gid === undefined) {
      throw new Error(`marker 图层缺少索引：${layerName}[${index}]`);
    }
    if (gid === 0) {
      continue;
    }
    const localTile = {
      x: index % chunkWidthTiles,
      y: Math.floor(index / chunkWidthTiles),
    };
    if (!isKnownMarkerGid(layerName, gid)) {
      throw markerError(layerName, chunk, localTile, gid);
    }
    const worldTile = {
      x: chunk.x * chunkWidthTiles + localTile.x,
      y: chunk.y * chunkHeightTiles + localTile.y,
    };
    records.push(
      Object.freeze({
        layerName,
        gid,
        localTile: freezeCoordinate(localTile),
        worldTile: freezeCoordinate(worldTile),
        worldPixel: freezeCoordinate({
          x: worldTile.x * tileWidthPixels,
          y: worldTile.y * tileHeightPixels,
        }),
        chunk: Object.freeze({ x: chunk.x, y: chunk.y }),
      }),
    );
  }
  return Object.freeze(records);
}

export function diagnosticForMarker(
  marker: LayerMarkerRecord,
): LayerDiagnostic | undefined {
  if (marker.layerName !== "particles3") {
    return undefined;
  }
  return Object.freeze({
    kind: "unconsumed-marker",
    layerName: "particles3",
    gid: marker.gid,
    localTile: marker.localTile,
    worldTile: marker.worldTile,
    chunk: marker.chunk,
    message: "particles3 marker 尚未接入消费者",
  });
}

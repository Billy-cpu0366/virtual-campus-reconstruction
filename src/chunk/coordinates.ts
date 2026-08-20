import type { ChunkMaster } from "./contract.js";

export interface ChunkCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface ChunkGeometry {
  readonly chunkWidthTiles: number;
  readonly chunkHeightTiles: number;
  readonly chunksHorizontal: number;
  readonly chunksVertical: number;
  readonly tileWidthPixels: number;
  readonly tileHeightPixels: number;
}

export function geometryFromMaster(master: ChunkMaster): ChunkGeometry {
  return Object.freeze({
    chunkWidthTiles: master.chunkWidth,
    chunkHeightTiles: master.chunkHeight,
    chunksHorizontal: master.nbChunksHorizontal,
    chunksVertical: master.nbChunksVertical,
    tileWidthPixels: master.tileWidth,
    tileHeightPixels: master.tileHeight,
  });
}

function assertCoordinate(
  coordinate: ChunkCoordinate,
  geometry: ChunkGeometry,
): void {
  if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.y)) {
    throw new RangeError("chunk coordinates must be integers");
  }
  if (
    coordinate.x < 0 ||
    coordinate.y < 0 ||
    coordinate.x >= geometry.chunksHorizontal ||
    coordinate.y >= geometry.chunksVertical
  ) {
    throw new RangeError("chunk coordinate is outside the grid");
  }
}

function assertIndex(index: number, geometry: ChunkGeometry): void {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= geometry.chunksHorizontal * geometry.chunksVertical
  ) {
    throw new RangeError("chunk index is outside the grid");
  }
}

export function chunkCoordinateToIndex(
  coordinate: ChunkCoordinate,
  geometry: ChunkGeometry,
): number {
  assertCoordinate(coordinate, geometry);
  return coordinate.y * geometry.chunksHorizontal + coordinate.x;
}

export function chunkIndexToCoordinate(
  index: number,
  geometry: ChunkGeometry,
): ChunkCoordinate {
  assertIndex(index, geometry);
  return Object.freeze({
    x: index % geometry.chunksHorizontal,
    y: Math.floor(index / geometry.chunksHorizontal),
  });
}

export function chunkFileName(
  coordinate: ChunkCoordinate,
  geometry: ChunkGeometry,
): string {
  return `chunk${chunkCoordinateToIndex(coordinate, geometry)}.json`;
}

export function worldToChunkCoordinate(
  worldX: number,
  worldY: number,
  geometry: ChunkGeometry,
): ChunkCoordinate | null {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    throw new TypeError("world coordinates must be finite");
  }

  const chunkPixelWidth =
    geometry.chunkWidthTiles * geometry.tileWidthPixels;
  const chunkPixelHeight =
    geometry.chunkHeightTiles * geometry.tileHeightPixels;
  const x = Math.floor(worldX / chunkPixelWidth);
  const y = Math.floor(worldY / chunkPixelHeight);

  if (
    worldX < 0 ||
    worldY < 0 ||
    x < 0 ||
    y < 0 ||
    x >= geometry.chunksHorizontal ||
    y >= geometry.chunksVertical
  ) {
    return null;
  }
  return Object.freeze({ x, y });
}

import {
  worldToChunkCoordinate,
  type ChunkCoordinate,
  type ChunkGeometry,
} from "./coordinates.js";

export interface CameraViewport {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

function coordinatesInRange(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): ChunkCoordinate[] {
  if (startX > endX || startY > endY) {
    return [];
  }

  const result: ChunkCoordinate[] = [];
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      result.push(Object.freeze({ x, y }));
    }
  }
  return result;
}

export function playerNeighborhood(
  worldX: number,
  worldY: number,
  geometry: ChunkGeometry,
  radius = 1,
): readonly ChunkCoordinate[] {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError("player neighborhood radius must be non-negative");
  }

  const center = worldToChunkCoordinate(worldX, worldY, geometry);
  if (center === null) {
    return [];
  }

  return coordinatesInRange(
    Math.max(0, center.x - radius),
    Math.max(0, center.y - radius),
    Math.min(geometry.chunksHorizontal - 1, center.x + radius),
    Math.min(geometry.chunksVertical - 1, center.y + radius),
  );
}

function assertViewport(viewport: CameraViewport): void {
  if (
    !Number.isFinite(viewport.scrollX) ||
    !Number.isFinite(viewport.scrollY) ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    !Number.isFinite(viewport.zoom)
  ) {
    throw new TypeError("camera viewport values must be finite");
  }
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError("camera viewport dimensions must be positive");
  }
  if (viewport.zoom <= 0) {
    throw new RangeError("camera zoom must be positive");
  }
}

export function cameraVisibleChunks(
  viewport: CameraViewport,
  geometry: ChunkGeometry,
  padding = 1,
): readonly ChunkCoordinate[] {
  assertViewport(viewport);
  if (!Number.isInteger(padding) || padding < 0) {
    throw new RangeError("camera padding must be non-negative");
  }

  const endWorldX = viewport.scrollX + viewport.width / viewport.zoom;
  const endWorldY = viewport.scrollY + viewport.height / viewport.zoom;
  const startTileX = Math.floor(viewport.scrollX / geometry.tileWidthPixels);
  const startTileY = Math.floor(viewport.scrollY / geometry.tileHeightPixels);
  const endTileX = Math.ceil(endWorldX / geometry.tileWidthPixels);
  const endTileY = Math.ceil(endWorldY / geometry.tileHeightPixels);

  const startX = Math.max(
    0,
    Math.floor(startTileX / geometry.chunkWidthTiles) - padding,
  );
  const startY = Math.max(
    0,
    Math.floor(startTileY / geometry.chunkHeightTiles) - padding,
  );
  const endX = Math.min(
    geometry.chunksHorizontal - 1,
    Math.ceil(endTileX / geometry.chunkWidthTiles) + padding,
  );
  const endY = Math.min(
    geometry.chunksVertical - 1,
    Math.ceil(endTileY / geometry.chunkHeightTiles) + padding,
  );

  return coordinatesInRange(startX, startY, endX, endY);
}

function coordinateKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}_${coordinate.y}`;
}

function mergeChunkCoordinates(
  ...groups: readonly (readonly ChunkCoordinate[])[]
): readonly ChunkCoordinate[] {
  const unique = new Map<string, ChunkCoordinate>();
  for (const group of groups) {
    for (const coordinate of group) {
      unique.set(coordinateKey(coordinate), coordinate);
    }
  }
  return [...unique.values()].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  );
}

export function targetChunks(
  playerWorldX: number,
  playerWorldY: number,
  viewport: CameraViewport,
  geometry: ChunkGeometry,
): readonly ChunkCoordinate[] {
  return mergeChunkCoordinates(
    playerNeighborhood(playerWorldX, playerWorldY, geometry),
    cameraVisibleChunks(viewport, geometry),
  );
}

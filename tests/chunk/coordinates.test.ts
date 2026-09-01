import { describe, expect, it } from "vitest";

import {
  chunkCoordinateToIndex,
  chunkFileName,
  chunkIndexToCoordinate,
  worldToChunkCoordinate,
  type ChunkGeometry,
} from "../../src/chunk/index.js";

const geometry: ChunkGeometry = {
  chunkWidthTiles: 28,
  chunkHeightTiles: 28,
  chunksHorizontal: 5,
  chunksVertical: 5,
  tileWidthPixels: 16,
  tileHeightPixels: 16,
};

describe("row-major chunk conversion", () => {
  it.each([
    [{ x: 0, y: 0 }, 0, "chunk0.json"],
    [{ x: 4, y: 0 }, 4, "chunk4.json"],
    [{ x: 0, y: 1 }, 5, "chunk5.json"],
    [{ x: 4, y: 4 }, 24, "chunk24.json"],
  ] as const)("maps %o to index %i", (coordinate, index, fileName) => {
    expect(chunkCoordinateToIndex(coordinate, geometry)).toBe(index);
    expect(chunkIndexToCoordinate(index, geometry)).toEqual(coordinate);
    expect(chunkFileName(coordinate, geometry)).toBe(fileName);
  });

  it("rejects coordinates and indexes outside the grid", () => {
    expect(() => chunkCoordinateToIndex({ x: -1, y: 0 }, geometry)).toThrow(
      RangeError,
    );
    expect(() => chunkCoordinateToIndex({ x: 5, y: 0 }, geometry)).toThrow(
      RangeError,
    );
    expect(() => chunkIndexToCoordinate(25, geometry)).toThrow(RangeError);
    expect(() => chunkIndexToCoordinate(1.5, geometry)).toThrow(RangeError);
  });
});

describe("worldToChunkCoordinate", () => {
  it.each([
    [0, 0, { x: 0, y: 0 }],
    [447.999, 447.999, { x: 0, y: 0 }],
    [448, 448, { x: 1, y: 1 }],
    [2239.999, 2239.999, { x: 4, y: 4 }],
  ] as const)("maps world (%s, %s)", (worldX, worldY, expected) => {
    expect(worldToChunkCoordinate(worldX, worldY, geometry)).toEqual(
      expected,
    );
  });

  it("returns null outside the world", () => {
    expect(worldToChunkCoordinate(-0.001, 0, geometry)).toBeNull();
    expect(worldToChunkCoordinate(0, -0.001, geometry)).toBeNull();
    expect(worldToChunkCoordinate(2240, 0, geometry)).toBeNull();
    expect(worldToChunkCoordinate(0, 2240, geometry)).toBeNull();
  });

  it("rejects non-finite world coordinates", () => {
    expect(() => worldToChunkCoordinate(Number.NaN, 0, geometry)).toThrow(
      TypeError,
    );
    expect(() => worldToChunkCoordinate(0, Number.POSITIVE_INFINITY, geometry))
      .toThrow(TypeError);
  });
});

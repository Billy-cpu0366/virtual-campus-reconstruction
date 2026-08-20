import { describe, expect, it } from "vitest";

import {
  cameraVisibleChunks,
  playerNeighborhood,
  targetChunks,
  type ChunkCoordinate,
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

function keys(coordinates: readonly ChunkCoordinate[]): string[] {
  return coordinates.map(({ x, y }) => `${x}_${y}`);
}

describe("playerNeighborhood", () => {
  it("returns a row-major 3x3 neighborhood for an interior player", () => {
    expect(keys(playerNeighborhood(906, 906, geometry))).toEqual([
      "1_1", "2_1", "3_1",
      "1_2", "2_2", "3_2",
      "1_3", "2_3", "3_3",
    ]);
  });

  it("clips the neighborhood at world edges", () => {
    expect(keys(playerNeighborhood(10, 10, geometry))).toEqual([
      "0_0", "1_0", "0_1", "1_1",
    ]);
  });

  it("returns no player chunks for a position outside the world", () => {
    expect(playerNeighborhood(-1, 0, geometry)).toEqual([]);
  });

  it("rejects an invalid radius", () => {
    expect(() => playerNeighborhood(0, 0, geometry, -1)).toThrow(RangeError);
    expect(() => playerNeighborhood(0, 0, geometry, 1.5)).toThrow(
      RangeError,
    );
  });
});

describe("cameraVisibleChunks", () => {
  it("reproduces the camera tile rounding with one chunk of padding", () => {
    const result = cameraVisibleChunks(
      { scrollX: 448, scrollY: 448, width: 448, height: 448, zoom: 1 },
      geometry,
    );

    expect(keys(result)).toEqual([
      "0_0", "1_0", "2_0", "3_0",
      "0_1", "1_1", "2_1", "3_1",
      "0_2", "1_2", "2_2", "3_2",
      "0_3", "1_3", "2_3", "3_3",
    ]);
  });

  it("uses camera zoom when calculating the world-space viewport", () => {
    const zoomOne = cameraVisibleChunks(
      { scrollX: 448, scrollY: 448, width: 896, height: 896, zoom: 1 },
      geometry,
    );
    const zoomTwo = cameraVisibleChunks(
      { scrollX: 448, scrollY: 448, width: 896, height: 896, zoom: 2 },
      geometry,
    );

    expect(keys(zoomOne)).toHaveLength(25);
    expect(keys(zoomTwo)).toHaveLength(16);
  });

  it("clips a bottom-right viewport to the 5x5 grid", () => {
    const result = cameraVisibleChunks(
      { scrollX: 1792, scrollY: 1792, width: 448, height: 448, zoom: 1 },
      geometry,
    );

    expect(keys(result)).toEqual(["3_3", "4_3", "3_4", "4_4"]);
  });

  it("returns no chunks for a viewport fully outside the negative world", () => {
    const result = cameraVisibleChunks(
      { scrollX: -2000, scrollY: -2000, width: 100, height: 100, zoom: 1 },
      geometry,
    );

    expect(result).toEqual([]);
  });

  it("rejects invalid viewport dimensions, zoom and padding", () => {
    expect(() => cameraVisibleChunks(
      { scrollX: 0, scrollY: 0, width: 0, height: 100, zoom: 1 },
      geometry,
    )).toThrow(RangeError);
    expect(() => cameraVisibleChunks(
      { scrollX: 0, scrollY: 0, width: 100, height: 100, zoom: 0 },
      geometry,
    )).toThrow(RangeError);
    expect(() => cameraVisibleChunks(
      { scrollX: 0, scrollY: 0, width: 100, height: 100, zoom: 1 },
      geometry,
      -1,
    )).toThrow(RangeError);
  });
});

describe("target chunk union", () => {
  it("combines overlapping player and camera targets deterministically", () => {
    const result = targetChunks(
      10,
      10,
      { scrollX: 0, scrollY: 0, width: 448, height: 448, zoom: 1 },
      geometry,
    );

    expect(keys(result)).toEqual([
      "0_0", "1_0", "2_0",
      "0_1", "1_1", "2_1",
      "0_2", "1_2", "2_2",
    ]);
    expect(new Set(keys(result)).size).toBe(result.length);
    expect(result.every(({ x, y }) => x >= 0 && x < 5 && y >= 0 && y < 5))
      .toBe(true);
  });
});

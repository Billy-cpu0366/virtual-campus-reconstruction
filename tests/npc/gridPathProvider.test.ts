import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GridRouteCrowdPathProvider } from "../../src/npc/gridPathProvider.js";

describe("GridRouteCrowdPathProvider", () => {
  it("finds an eight-way walkable route and rejects blocked endpoints", () => {
    const provider = new GridRouteCrowdPathProvider([
      [0, 0, 0],
      [1, 1, 0],
      [0, 0, 0],
    ]);
    expect(provider.findPath({ start: { x: 8, y: 8 }, end: { x: 40, y: 40 } }))
      .toEqual([
        { x: 8, y: 8 },
        { x: 24, y: 8 },
        { x: 40, y: 8 },
        { x: 40, y: 24 },
        { x: 40, y: 40 },
      ]);
    expect(provider.findPath({ start: { x: 8, y: 8 }, end: { x: 8, y: 24 } }))
      .toBeNull();
  });

  it("snaps only configured blocked endpoints to the nearest walkable tile", () => {
    const provider = new GridRouteCrowdPathProvider([
      [0, 0, 0],
      [1, 1, 0],
      [0, 0, 0],
    ]);
    const path = provider.findPath({
      start: { x: 8, y: 24 },
      end: { x: 40, y: 40 },
      allowBlockedEndpoints: true,
    });
    expect(path?.[0]).toEqual({ x: 8, y: 8 });
    expect(path?.every((point) => point.y !== 24 || point.x === 40)).toBe(true);
  });

  it("connects the configured main-crowd endpoints on the public wall grid", () => {
    const wallData = JSON.parse(readFileSync(new URL(
      "../../sample/original-public-build/mirror/assets/maps/walls-layer.json",
      import.meta.url,
    ), "utf8")) as { grid: number[][] };
    const provider = new GridRouteCrowdPathProvider(wallData.grid);
    for (const x of [31, 32, 33]) {
      const request = {
        start: { x: x * 16, y: 81 * 16 },
        end: { x: 73 * 16, y: 133 * 16 },
        randomSeed: x,
        randomFactor: .8,
        allowBlockedEndpoints: true,
      };
      let path = provider.findPath(request);
      for (let step = 0; path === undefined && step < 100; step += 1) {
        path = provider.findPath(request);
      }
      expect(path?.length).toBeGreaterThan(1);
    }
  });

  it("uses a stable seed to select diverse equal-cost paths", () => {
    const provider = new GridRouteCrowdPathProvider([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const request = { start: { x: 8, y: 40 }, end: { x: 72, y: 40 }, randomFactor: .8 };
    const first = provider.findPath({ ...request, randomSeed: 1 });
    expect(provider.findPath({ ...request, randomSeed: 1 })).toEqual(first);
    expect(provider.findPath({ ...request, randomSeed: 2 })).not.toEqual(first);
  });

  it("does not cut diagonally through blocked corners", () => {
    const provider = new GridRouteCrowdPathProvider([
      [0, 1],
      [1, 0],
    ]);
    expect(provider.findPath({ start: { x: 8, y: 8 }, end: { x: 24, y: 24 } }))
      .toBeNull();
  });

  it("rejects a route whose endpoints have no walkable connection", () => {
    const provider = new GridRouteCrowdPathProvider([
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ]);
    expect(provider.findPath({ start: { x: 8, y: 8 }, end: { x: 40, y: 40 } }))
      .toBeNull();
  });
});

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

import { describe, expect, it } from "vitest";

import { LAYER_STRATEGIES } from "../../src/layer/index.js";
import {
  validateChunk,
  validateCoordinate,
  WorldChunkError,
} from "../../src/world/index.js";
import { makeChunk, makeChunkLayers, makeSpec } from "./fixtures.js";

describe("chunk 坐标校验", () => {
  it("合法坐标通过", () => {
    expect(() => validateCoordinate({ x: 4, y: 4 }, makeSpec())).not.toThrow();
  });

  it("非整数坐标抛错", () => {
    expect(() => validateCoordinate({ x: 0.5, y: 0 }, makeSpec())).toThrow(
      WorldChunkError,
    );
  });

  it("负坐标抛错", () => {
    expect(() => validateCoordinate({ x: -1, y: 0 }, makeSpec())).toThrow(
      WorldChunkError,
    );
  });

  it("越界坐标抛错", () => {
    expect(() => validateCoordinate({ x: 5, y: 0 }, makeSpec())).toThrow(
      WorldChunkError,
    );
    expect(() => validateCoordinate({ x: 0, y: 5 }, makeSpec())).toThrow(
      WorldChunkError,
    );
  });
});

describe("chunk 结构校验", () => {
  it("合法 chunk 通过", () => {
    const chunk = validateChunk(makeChunk(2, 3), makeSpec(), LAYER_STRATEGIES);
    expect(chunk.coordinate).toEqual({ x: 2, y: 3 });
    expect(chunk.layers).toHaveLength(24);
  });

  it("层名与图层计划顺序不一致抛错", () => {
    const layers = makeChunkLayers();
    const first = layers[0];
    if (first === undefined) throw new Error("unreachable");
    layers[0] = { name: "wrong", data: first.data };
    expect(() =>
      validateChunk(
        { coordinate: { x: 0, y: 0 }, layers },
        makeSpec(),
        LAYER_STRATEGIES,
      ),
    ).toThrow(WorldChunkError);
  });

  it("层 data 长度不符抛错", () => {
    const layers = makeChunkLayers();
    const first = layers[0];
    if (first === undefined) throw new Error("unreachable");
    layers[0] = { name: first.name, data: [0, 0] };
    expect(() =>
      validateChunk(
        { coordinate: { x: 0, y: 0 }, layers },
        makeSpec(),
        LAYER_STRATEGIES,
      ),
    ).toThrow(WorldChunkError);
  });

  it("层数不是 24 抛错", () => {
    const layers = makeChunkLayers().slice(0, 23);
    expect(() =>
      validateChunk(
        { coordinate: { x: 0, y: 0 }, layers },
        makeSpec(),
        LAYER_STRATEGIES,
      ),
    ).toThrow(WorldChunkError);
  });
});

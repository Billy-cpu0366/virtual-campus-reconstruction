import { describe, expect, it } from "vitest";

import { createWorld } from "../../src/world/index.js";
import { makeChunk, makeChunkLayers, makeSpec } from "./fixtures.js";

function readyWorld(
  ...args: Parameters<typeof createWorld>
): NonNullable<Extract<ReturnType<typeof createWorld>, { kind: "ready" }>["world"]> {
  const result = createWorld(...args);
  if (result.kind !== "ready") {
    throw new Error(`expected ready world, got ${result.kind}`);
  }
  return result.world;
}

describe("createWorld 建世界", () => {
  it("合法规格返回 ready 世界", () => {
    const result = createWorld(makeSpec());
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.world.state).toBe("ready");
      expect(result.world.renderedChunks).toEqual([]);
    }
  });

  it("规格不自洽返回 failure", () => {
    const result = createWorld({ ...makeSpec(), worldWidthTiles: 141 });
    expect(result.kind).toBe("failure");
  });

  it("图层计划为空返回 failure", () => {
    const result = createWorld(makeSpec(), { layerPlan: [] });
    expect(result.kind).toBe("failure");
  });

  it("图层计划层名重复返回 failure", () => {
    const result = createWorld(makeSpec(), {
      layerPlan: [
        { name: "a", role: "visual", depth: 1 },
        { name: "a", role: "visual", depth: 2 },
      ],
    });
    expect(result.kind).toBe("failure");
  });
});

describe("applyChunk 放块", () => {
  it("首次放块 applied", () => {
    const world = readyWorld(makeSpec());
    expect(world.applyChunk(makeChunk(1, 2))).toEqual({ kind: "applied" });
    expect(world.renderedChunks).toEqual([{ x: 1, y: 2 }]);
  });

  it("重复放块 already-applied，不漂移", () => {
    const world = readyWorld(makeSpec());
    expect(world.applyChunk(makeChunk(1, 2))).toEqual({ kind: "applied" });
    expect(world.applyChunk(makeChunk(1, 2))).toEqual({
      kind: "already-applied",
    });
    expect(world.renderedChunks).toHaveLength(1);
  });

  it("结构非法（层名错）failure 且不登记", () => {
    const world = readyWorld(makeSpec());
    const layers = makeChunkLayers();
    const first = layers[0];
    if (first === undefined) throw new Error("unreachable");
    layers[0] = { name: "wrong", data: first.data };
    const result = world.applyChunk({ coordinate: { x: 0, y: 0 }, layers });
    expect(result.kind).toBe("failure");
    expect(world.renderedChunks).toEqual([]);
  });

  it("写入任一层失败则带原数据整块回滚", () => {
    let writes = 0;
    const cleared: number[] = [];
    const layers = makeChunkLayers();
    const first = layers[0];
    if (first === undefined) throw new Error("unreachable");
    layers[0] = { name: first.name, data: [17, ...first.data.slice(1)] };
    const world = readyWorld(makeSpec(), {
      hooks: {
        writeLayer: (layer) => {
          writes += 1;
          if (layer.name === "layer5") throw new Error("写入失败");
        },
        clearLayer: (layer) => {
          cleared.push(layer.data[0] ?? -1);
        },
      },
    });
    const result = world.applyChunk({ coordinate: { x: 0, y: 0 }, layers });
    expect(result).toEqual({ kind: "failure", reason: "写入失败" });
    expect(world.renderedChunks).toEqual([]);
    expect(writes).toBe(5);
    expect(cleared).toEqual([17, 0, 0, 0]);
  });

  it("5×5 全图 25 块可全部放满且已排序", () => {
    const world = readyWorld(makeSpec());
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        expect(world.applyChunk(makeChunk(x, y))).toEqual({ kind: "applied" });
      }
    }
    expect(world.renderedChunks).toHaveLength(25);
    expect(world.renderedChunks[0]).toEqual({ x: 0, y: 0 });
    expect(world.renderedChunks[24]).toEqual({ x: 4, y: 4 });
  });
});

describe("removeChunk 撤块", () => {
  it("撤已渲染块 removed", () => {
    const world = readyWorld(makeSpec());
    world.applyChunk(makeChunk(1, 2));
    expect(world.removeChunk({ x: 1, y: 2 })).toEqual({ kind: "removed" });
    expect(world.renderedChunks).toEqual([]);
  });

  it("撤未渲染块 already-absent", () => {
    const world = readyWorld(makeSpec());
    expect(world.removeChunk({ x: 1, y: 2 })).toEqual({
      kind: "already-absent",
    });
  });

  it("重复撤 already-absent", () => {
    const world = readyWorld(makeSpec());
    world.applyChunk(makeChunk(1, 2));
    expect(world.removeChunk({ x: 1, y: 2 })).toEqual({ kind: "removed" });
    expect(world.removeChunk({ x: 1, y: 2 })).toEqual({
      kind: "already-absent",
    });
  });

  it("清除任一层失败则 failure 且仍登记", () => {
    const world = readyWorld(makeSpec(), {
      hooks: {
        clearLayer: () => {
          throw new Error("清除失败");
        },
      },
    });
    world.applyChunk(makeChunk(0, 0));
    expect(world.removeChunk({ x: 0, y: 0 })).toEqual({
      kind: "failure",
      reason: "清除失败",
    });
    expect(world.renderedChunks).toEqual([{ x: 0, y: 0 }]);
  });

  it("清除部分层后失败则用原层数据回滚、仍登记", () => {
    let writes = 0;
    const restored: number[] = [];
    const layers = makeChunkLayers();
    const first = layers[0];
    if (first === undefined) throw new Error("unreachable");
    layers[0] = { name: first.name, data: [42, ...first.data.slice(1)] };
    const world = readyWorld(makeSpec(), {
      hooks: {
        clearLayer: (layer) => {
          if (layer.name === "layer5") throw new Error("清除失败");
        },
        writeLayer: (layer) => {
          writes += 1;
          if (layer.name === "layer1") {
            restored.push(layer.data[0] ?? -1);
          }
        },
      },
    });
    world.applyChunk({ coordinate: { x: 0, y: 0 }, layers });
    writes = 0; // 只看回滚重写次数，不把 applyChunk 的 24 次写入算进去
    expect(world.removeChunk({ x: 0, y: 0 })).toEqual({
      kind: "failure",
      reason: "清除失败",
    });
    expect(world.renderedChunks).toEqual([{ x: 0, y: 0 }]);
    expect(writes).toBe(4); // layer1–4 已清，回滚重写这 4 层
    expect(restored).toEqual([42, 42]);
  });
});

describe("destroy 拆世界", () => {
  it("destroy 后拒绝写入与清除", () => {
    const world = readyWorld(makeSpec());
    world.destroy();
    expect(world.state).toBe("destroyed");
    expect(world.applyChunk(makeChunk(0, 0)).kind).toBe("failure");
    expect(world.removeChunk({ x: 0, y: 0 }).kind).toBe("failure");
  });

  it("destroy 幂等，可重复调用", () => {
    const world = readyWorld(makeSpec());
    world.applyChunk(makeChunk(0, 0));
    world.destroy();
    expect(() => world.destroy()).not.toThrow();
    expect(world.state).toBe("destroyed");
    expect(world.renderedChunks).toEqual([]);
  });
});

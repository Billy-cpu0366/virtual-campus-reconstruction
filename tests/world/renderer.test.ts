import { describe, expect, it } from "vitest";

import {
  LAYER_STRATEGIES,
  ROOF_FADE_MS,
  type TileCoordinate,
} from "../../src/layer/index.js";
import { createWorld } from "../../src/world/index.js";
import { PhaserWorldRenderer } from "../../game/PhaserWorldRenderer.js";
import { makeChunk, makeSpec } from "./fixtures.js";

class FakeTilemapLayer {
  alpha = 1;
  depth = 0;
  visible = true;
  destroyed = false;
  removeFromTilemapOnDestroy: boolean | undefined;
  tiles: readonly (readonly number[])[] = [];

  putTilesAt(tiles: readonly (readonly number[])[]): void {
    this.tiles = tiles;
  }

  setAlpha(value: number): void {
    this.alpha = value;
  }

  setDepth(value: number): void {
    this.depth = value;
  }

  setVisible(value: boolean): void {
    this.visible = value;
  }

  destroy(removeFromTilemap = true): void {
    this.destroyed = true;
    this.removeFromTilemapOnDestroy = removeFromTilemap;
  }
}

class FakeTilemap {
  readonly created = new Map<string, FakeTilemapLayer>();
  destroyed = false;
  destroyCalls = 0;

  createBlankLayer(id: string): FakeTilemapLayer {
    const layer = new FakeTilemapLayer();
    this.created.set(id, layer);
    return layer;
  }

  removeLayer(layer: FakeTilemapLayer): void {
    for (const [id, current] of this.created) {
      if (current === layer) {
        this.created.delete(id);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.destroyCalls += 1;
  }
}

function setTile(
  layerName: string,
  gid: number,
  tile: TileCoordinate,
): ReturnType<typeof makeChunk> {
  const chunk = makeChunk(1, 2);
  const layer = chunk.layers.find((item) => item.name === layerName);
  if (layer === undefined) throw new Error(`missing ${layerName}`);
  const data = [...layer.data];
  data[tile.y * 28 + tile.x] = gid;
  return {
    coordinate: chunk.coordinate,
    layers: chunk.layers.map((item) =>
      item.name === layerName ? { name: item.name, data } : item,
    ),
  };
}

describe("PhaserWorldRenderer SYS-LAYER 运行时语义", () => {
  it("particles raw visual 按 chunk 对称写入并清除，particles3 保留诊断", () => {
    const map = new FakeTilemap();
    const renderer = new PhaserWorldRenderer(
      map,
      [],
      makeSpec(),
      LAYER_STRATEGIES,
    );
    const hooks = renderer.hooks();
    const chunk = { x: 1, y: 2 };
    const particles = setTile("particles", 69359, { x: 2, y: 3 });
    const particles3 = setTile("particles3", 69361, { x: 4, y: 5 });

    hooks.writeLayer!(
      particles.layers.find((layer) => layer.name === "particles")!,
      chunk,
    );
    hooks.writeLayer!(
      particles3.layers.find((layer) => layer.name === "particles3")!,
      chunk,
    );

    const particleLayer = map.created.get("particles@1_2");
    expect(particleLayer?.depth).toBe(0);
    expect(particleLayer?.tiles[3]?.[2]).toBe(69359);
    expect(renderer.markers).toHaveLength(1);
    expect(renderer.particles3Diagnostics).toHaveLength(1);
    expect(renderer.particles3Diagnostics[0]?.message).toContain(
      "particles3",
    );

    hooks.clearLayer!(
      particles.layers.find((layer) => layer.name === "particles")!,
      chunk,
    );
    expect(renderer.layers.has("particles@1_2")).toBe(false);
    expect(particleLayer?.destroyed).toBe(true);
    expect(particleLayer?.removeFromTilemapOnDestroy).toBe(false);
    expect(renderer.markers).toHaveLength(1);
    hooks.clearLayer!(
      particles3.layers.find((layer) => layer.name === "particles3")!,
      chunk,
    );
    expect(renderer.markers).toEqual([]);
    expect(renderer.diagnostics).toEqual([]);
  });

  it("raw visual 未知 GID 失败时可被 World apply 回滚", () => {
    const map = new FakeTilemap();
    const renderer = new PhaserWorldRenderer(
      map,
      [],
      makeSpec(),
      LAYER_STRATEGIES,
    );
    const worldResult = createWorld(makeSpec(), { hooks: renderer.hooks() });
    if (worldResult.kind !== "ready") throw new Error(worldResult.reason);
    const chunk = setTile("cars", 69345, { x: 1, y: 1 });
    const badChunk = {
      coordinate: chunk.coordinate,
      layers: chunk.layers.map((layer) =>
        layer.name === "particles"
          ? {
              name: layer.name,
              data: layer.data.map((gid, index) =>
                index === 0 ? 69360 : gid,
              ),
            }
          : layer,
      ),
    };

    const result = worldResult.world.applyChunk(badChunk);
    expect(result.kind).toBe("failure");
    expect(result.kind === "failure" ? result.reason : "").toContain(
      "未知 raw visual GID：layer=particles",
    );
    expect(result.kind === "failure" ? result.reason : "").toContain(
      "69360",
    );
    expect(renderer.layers).toEqual(new Map());
    expect(map.created).toEqual(new Map());
    expect(renderer.markers).toEqual([]);
    expect(renderer.diagnostics).toEqual([]);
  });

  it("roof 按 concert/factory 分组，状态幂等且新层继承", () => {
    const map = new FakeTilemap();
    const renderer = new PhaserWorldRenderer(
      map,
      [],
      makeSpec(),
      LAYER_STRATEGIES,
    );
    const hooks = renderer.hooks();
    const chunk = makeChunk(0, 0);
    for (const name of [
      "roof_concert",
      "roof_concert2",
      "roof_factory",
      "roof_factory2",
    ]) {
      hooks.writeLayer!(
        chunk.layers.find((layer) => layer.name === name)!,
        chunk.coordinate,
      );
    }

    expect(renderer.getRoofState("concert")).toEqual({
      group: "concert",
      state: "visible",
      visible: true,
      alpha: 1,
      durationMs: ROOF_FADE_MS,
    });
    expect(renderer.setRoofState("factory", "faded")).toEqual({
      group: "factory",
      state: "faded",
      visible: true,
      alpha: 0,
      durationMs: 300,
    });
    expect(map.created.get("roof_factory@0_0")?.alpha).toBe(0);
    expect(map.created.get("roof_factory2@0_0")?.visible).toBe(true);
    expect(map.created.get("roof_concert@0_0")?.alpha).toBe(1);
    expect(renderer.setRoofState("factory", "faded")).toEqual(
      renderer.getRoofState("factory"),
    );

    const second = makeChunk(1, 0);
    hooks.writeLayer!(
      second.layers.find((layer) => layer.name === "roof_factory")!,
      second.coordinate,
    );
    expect(map.created.get("roof_factory@1_0")?.alpha).toBe(0);
  });

  it("roof 状态变化可注入 300ms 应用回调且重复状态不重复触发", () => {
    const applied: Array<{
      state: string;
      durationMs: number;
      layerCount: number;
    }> = [];
    const renderer = new PhaserWorldRenderer(
      new FakeTilemap(),
      [],
      makeSpec(),
      LAYER_STRATEGIES,
      {
        onRoofStateApplied: (state, layers) => {
          applied.push({
            state: state.state,
            durationMs: state.durationMs,
            layerCount: layers.length,
          });
        },
      },
    );
    const hooks = renderer.hooks();
    const chunk = makeChunk(0, 0);
    for (const name of ["roof_factory", "roof_factory2"]) {
      hooks.writeLayer!(
        chunk.layers.find((layer) => layer.name === name)!,
        chunk.coordinate,
      );
    }

    renderer.setRoofState("factory", "faded");
    renderer.setRoofState("factory", "faded");
    expect(applied).toEqual([
      { state: "faded", durationMs: ROOF_FADE_MS, layerCount: 2 },
    ]);
  });

  it("destroy 清理 marker、diagnostics、roof layer 和 Tilemap 状态", async () => {
    const map = new FakeTilemap();
    const renderer = new PhaserWorldRenderer(
      map,
      [],
      makeSpec(),
      LAYER_STRATEGIES,
    );
    const hooks = renderer.hooks();
    const chunk = setTile("particles3", 69361, { x: 0, y: 0 });
    const rawParticles = setTile("particles", 69355, { x: 1, y: 1 });
    hooks.writeLayer!(
      chunk.layers.find((layer) => layer.name === "particles3")!,
      chunk.coordinate,
    );
    hooks.writeLayer!(
      rawParticles.layers.find((layer) => layer.name === "particles")!,
      rawParticles.coordinate,
    );
    hooks.writeLayer!(
      makeChunk().layers.find((layer) => layer.name === "roof_concert")!,
      { x: 0, y: 0 },
    );

    await Promise.all([renderer.destroyAsync(), renderer.destroyAsync()]);
    expect(map.destroyed).toBe(true);
    expect(map.destroyCalls).toBe(1);
    expect(renderer.markers).toEqual([]);
    expect(renderer.diagnostics).toEqual([]);
    expect(renderer.layers).toEqual(new Map());
    expect(renderer.getRoofState("concert").alpha).toBe(1);
  });
});

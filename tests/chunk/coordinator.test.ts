import { describe, expect, it } from "vitest";

import {
  ChunkCoordinator,
  ChunkDataStore,
} from "../../src/chunk/index.js";
import { createWorld } from "../../src/world/index.js";
import { LAYER_STRATEGIES } from "../../src/layer/index.js";

function master(): Record<string, unknown> {
  return {
    chunkWidth: 2,
    chunkHeight: 2,
    nbChunksHorizontal: 2,
    nbChunksVertical: 1,
    originalWidth: 4,
    originalHeight: 2,
    tilesets: [{ tilewidth: 16, tileheight: 16 }],
  };
}

function chunk(): Record<string, unknown> {
  return {
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    layers: LAYER_STRATEGIES.map((strategy) => ({
      name: strategy.name,
      width: 2,
      height: 2,
      data: [0, 0, 0, 0],
    })),
  };
}

function readyWorld(
  options: Parameters<typeof createWorld>[1] = {},
) {
  const result = createWorld({
    chunkWidthTiles: 2,
    chunkHeightTiles: 2,
    chunksHorizontal: 2,
    chunksVertical: 1,
    worldWidthTiles: 4,
    worldHeightTiles: 2,
    tileWidthPixels: 16,
    tileHeightPixels: 16,
    worldPixelWidth: 64,
    worldPixelHeight: 32,
  }, options);
  if (result.kind !== "ready") throw new Error(result.reason);
  return result.world;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe("ChunkCoordinator", () => {
  it("公开 target/requesting/cached/rendered 状态并应用缓存", async () => {
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const coordinator = new ChunkCoordinator(store, readyWorld());

    await coordinator.updateTargets([{ x: 0, y: 0 }]);

    expect(coordinator.state.targets).toEqual([{ x: 0, y: 0 }]);
    expect(coordinator.state.requesting).toEqual([]);
    expect(coordinator.state.cached).toEqual([{ x: 0, y: 0 }]);
    expect(coordinator.state.rendered).toEqual([{ x: 0, y: 0 }]);
    expect(coordinator.state.failed).toEqual([]);
  });

  it("通过调度器延后 World 写入并等待写入完成", async () => {
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    await store.loadMaster();
    const queued: Array<() => Promise<void>> = [];
    const coordinator = new ChunkCoordinator(store, readyWorld(), {
      scheduleMutation: (mutation) =>
        new Promise<void>((resolve) => {
          queued.push(async () => {
            await mutation();
            resolve();
          });
        }),
    });

    const pending = coordinator.updateTargets([{ x: 0, y: 0 }]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(coordinator.rendered).toEqual([]);
    expect(queued).toHaveLength(1);
    await queued.shift()?.();
    await pending;
    expect(coordinator.rendered).toEqual([{ x: 0, y: 0 }]);
  });

  it("缓存 chunk 在异步写入期间不会重复排队", async () => {
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    await store.loadChunk({ x: 0, y: 0 });
    const queued: Array<() => Promise<void>> = [];
    const coordinator = new ChunkCoordinator(store, readyWorld(), {
      scheduleMutation: (mutation) =>
        new Promise<void>((resolve) => {
          queued.push(async () => {
            await mutation();
            resolve();
          });
        }),
    });

    const first = coordinator.updateTargets([{ x: 0, y: 0 }]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const second = coordinator.updateTargets([{ x: 0, y: 0 }]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(queued).toHaveLength(1);
    await queued.shift()?.();
    await Promise.all([first, second]);
    expect(coordinator.rendered).toEqual([{ x: 0, y: 0 }]);
  });

  it("目标变更会清除离开块，过期请求只进 cache 不写 World", async () => {
    const chunkRequest = deferred<unknown>();
    const loader = (url: string) => {
      if (url.endsWith("master.json")) return Promise.resolve(master());
      return chunkRequest.promise;
    };
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const world = readyWorld();
    const coordinator = new ChunkCoordinator(store, world);

    const pending = coordinator.updateTargets([{ x: 0, y: 0 }]);
    expect(coordinator.requesting).toEqual([{ x: 0, y: 0 }]);
    await coordinator.updateTargets([]);
    chunkRequest.resolve(chunk());
    await pending;

    expect(coordinator.targets).toEqual([]);
    expect(coordinator.rendered).toEqual([]);
    expect(coordinator.cached).toEqual([{ x: 0, y: 0 }]);
  });

  it("World 写入或移除失败会进入 failed 状态", async () => {
    const world = readyWorld({
      hooks: {
        clearLayer: (layer) => {
          if (layer.name === "layer1") throw new Error("clear failed");
        },
      },
    });
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const coordinator = new ChunkCoordinator(store, world);

    await coordinator.updateTargets([{ x: 0, y: 0 }]);
    await coordinator.updateTargets([]);

    expect(coordinator.state.failed).toEqual([
      expect.objectContaining({
        coordinate: { x: 0, y: 0 },
        stage: "remove",
        reason: "clear failed",
      }),
    ]);
    expect(coordinator.rendered).toEqual([{ x: 0, y: 0 }]);
  });

  it("活动 apply 完成后若目标过期，会补偿清除过期回写", async () => {
    const writeStarted = deferred<void>();
    const releaseWrite = deferred<void>();
    let firstWrite = true;
    const world = readyWorld({
      hooks: {
        writeLayerAsync: async (layer) => {
          if (firstWrite && layer.name === "layer1") {
            firstWrite = false;
            writeStarted.resolve();
            await releaseWrite.promise;
          }
        },
      },
    });
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const coordinator = new ChunkCoordinator(store, world);

    const loading = coordinator.updateTargets([{ x: 0, y: 0 }]);
    await writeStarted.promise;
    await coordinator.updateTargets([]);
    releaseWrite.resolve();
    await loading;

    expect(coordinator.targets).toEqual([]);
    expect(coordinator.rendered).toEqual([]);
  });

  it("活动 remove 完成后若目标重新加入，会补偿重新写入", async () => {
    const clearStarted = deferred<void>();
    const releaseClear = deferred<void>();
    let firstClear = true;
    const world = readyWorld({
      hooks: {
        clearLayerAsync: async (layer) => {
          if (firstClear && layer.name === "layer1") {
            firstClear = false;
            clearStarted.resolve();
            await releaseClear.promise;
          }
        },
      },
    });
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const coordinator = new ChunkCoordinator(store, world);

    await coordinator.updateTargets([{ x: 0, y: 0 }]);
    const removing = coordinator.updateTargets([]);
    await clearStarted.promise;
    await coordinator.updateTargets([{ x: 0, y: 0 }]);
    releaseClear.resolve();
    await removing;

    expect(coordinator.targets).toEqual([{ x: 0, y: 0 }]);
    expect(coordinator.rendered).toEqual([{ x: 0, y: 0 }]);
  });

  it("destroyAsync 立即清理 observable 状态并等待活动 mutation", async () => {
    const writeStarted = deferred<void>();
    const releaseWrite = deferred<void>();
    let firstWrite = true;
    const world = readyWorld({
      hooks: {
        writeLayerAsync: async (layer) => {
          if (firstWrite && layer.name === "layer1") {
            firstWrite = false;
            writeStarted.resolve();
            await releaseWrite.promise;
          }
        },
      },
    });
    const loader = async (url: string) =>
      url.endsWith("master.json") ? master() : chunk();
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const coordinator = new ChunkCoordinator(store, world);

    const pending = coordinator.updateTargets([{ x: 0, y: 0 }]);
    await writeStarted.promise;
    const destroyed = coordinator.destroyAsync();

    expect(coordinator.state.targets).toEqual([]);
    expect(coordinator.state.requesting).toEqual([]);
    expect(coordinator.state.cached).toEqual([]);
    expect(coordinator.state.rendered).toEqual([]);
    expect(coordinator.state.failed).toEqual([]);
    expect(coordinator.destroyed).toBe(true);
    expect(world.state).toBe("destroyed");

    releaseWrite.resolve();
    await expect(destroyed).resolves.toBeUndefined();
    await expect(pending).resolves.toBeUndefined();
  });

  it("destroy 后晚到结果不能写入 World，且幂等", async () => {
    const chunkRequest = deferred<unknown>();
    const loader = (url: string) => {
      if (url.endsWith("master.json")) return Promise.resolve(master());
      return chunkRequest.promise;
    };
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);
    const world = readyWorld();
    const coordinator = new ChunkCoordinator(store, world);
    const pending = coordinator.updateTargets([{ x: 0, y: 0 }]);

    coordinator.destroy();
    coordinator.destroy();
    chunkRequest.resolve(chunk());
    await pending;

    expect(coordinator.state.destroyed).toBe(true);
    expect(world.state).toBe("destroyed");
    expect(coordinator.rendered).toEqual([]);
    expect(coordinator.requesting).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  ChunkDataError,
  ChunkDataStore,
} from "../../src/chunk/index.js";
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

function chunk(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    layers: LAYER_STRATEGIES.map((strategy) => ({
      name: strategy.name,
      width: 2,
      height: 2,
      data: [1, 2, 3, 4],
    })),
    ...overrides,
  };
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

describe("ChunkDataStore", () => {
  it("加载 master，校验 chunk 并解析相对 URL", async () => {
    const loader = vi.fn(async (url: string) => {
      if (url === "assets/maps/chunks/master.json") return master();
      expect(url).toBe("assets/maps/chunks/chunk0.json");
      return chunk();
    });
    const store = new ChunkDataStore(
      "assets/maps/chunks/master.json",
      loader,
      { maxAttempts: 1 },
    );

    const loaded = await store.loadChunk({ x: 0, y: 0 });

    expect(loaded.coordinate).toEqual({ x: 0, y: 0 });
    expect(loaded.layers).toHaveLength(24);
    expect(store.cachedChunks).toEqual([{ x: 0, y: 0 }]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("拒绝尺寸或策略不匹配的 raw chunk 并记录失败", async () => {
    const loader = vi.fn(async (url: string) => {
      if (url.endsWith("master.json")) return master();
      return chunk({ width: 3 });
    });
    const store = new ChunkDataStore("https://test.invalid/master.json", loader, {
      maxAttempts: 1,
    });

    await expect(store.loadChunk({ x: 0, y: 0 })).rejects.toThrow(
      ChunkDataError,
    );
    expect(store.getFailure({ x: 0, y: 0 })).toMatchObject({
      attempts: 1,
      coordinate: { x: 0, y: 0 },
    });
    expect(store.cachedChunks).toEqual([]);
  });

  it("同坐标请求共享一个 in-flight promise", async () => {
    const chunkRequest = deferred<unknown>();
    const loader = vi.fn((url: string) => {
      if (url.endsWith("master.json")) return Promise.resolve(master());
      return chunkRequest.promise;
    });
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);

    const first = store.loadChunk({ x: 1, y: 0 });
    const second = store.loadChunk({ x: 1, y: 0 });
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));

    chunkRequest.resolve(chunk());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("失败只执行有限 attempts，retryChunk 才开启新的有限尝试", async () => {
    let chunkCalls = 0;
    const loader = vi.fn(async (url: string) => {
      if (url.endsWith("master.json")) return master();
      chunkCalls += 1;
      if (chunkCalls <= 2) throw new Error("temporary");
      return chunk();
    });
    const store = new ChunkDataStore("https://test.invalid/master.json", loader, {
      maxAttempts: 2,
    });

    await expect(store.loadChunk({ x: 0, y: 0 })).rejects.toThrow("temporary");
    expect(store.getFailure({ x: 0, y: 0 })?.attempts).toBe(2);
    await expect(store.loadChunk({ x: 0, y: 0 })).rejects.toThrow("temporary");
    expect(chunkCalls).toBe(2);

    await expect(store.retryChunk({ x: 0, y: 0 }, 1)).resolves.toMatchObject({
      coordinate: { x: 0, y: 0 },
    });
    expect(store.getFailure({ x: 0, y: 0 })).toBeUndefined();
    expect(chunkCalls).toBe(3);
  });

  it("destroy 会取消 master 请求且不记录失败", async () => {
    const masterRequest = deferred<unknown>();
    let receivedSignal: AbortSignal | undefined;
    const loader = vi.fn((url: string, signal?: AbortSignal) => {
      receivedSignal = signal;
      return masterRequest.promise;
    });
    const store = new ChunkDataStore(
      "https://test.invalid/master.json",
      loader,
    );

    const pending = store.loadMaster();
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    store.destroy();
    masterRequest.resolve(master());

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(receivedSignal?.aborted).toBe(true);
    expect(store.masterFailure).toBeUndefined();
    expect(store.destroyed).toBe(true);
  });

  it("destroy 会取消 chunk 请求且不写入 cache 或 failure", async () => {
    const chunkRequest = deferred<unknown>();
    const loader = vi.fn((url: string) => {
      if (url.endsWith("master.json")) return Promise.resolve(master());
      return chunkRequest.promise;
    });
    const store = new ChunkDataStore("https://test.invalid/master.json", loader);

    const pending = store.loadChunk({ x: 0, y: 0 });
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    store.destroy();
    chunkRequest.resolve(chunk());

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(store.cachedChunks).toEqual([]);
    expect(store.getFailure({ x: 0, y: 0 })).toBeUndefined();
    expect(store.master).toBeUndefined();
    expect(store.masterFailure).toBeUndefined();
    await expect(store.loadChunk({ x: 0, y: 0 })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("master 失败会阻止隐式重试，显式 retryChunk 可恢复", async () => {
    let masterCalls = 0;
    const loader = vi.fn(async (url: string) => {
      if (url.endsWith("master.json")) {
        masterCalls += 1;
        if (masterCalls === 1) throw new Error("master temporary");
        return master();
      }
      return chunk();
    });
    const store = new ChunkDataStore("https://test.invalid/master.json", loader, {
      maxAttempts: 1,
    });

    await expect(store.loadChunk({ x: 0, y: 0 })).rejects.toThrow(
      "master temporary",
    );
    await expect(store.loadChunk({ x: 0, y: 0 })).rejects.toThrow(
      "master temporary",
    );
    expect(masterCalls).toBe(1);

    await expect(store.retryChunk({ x: 0, y: 0 })).resolves.toMatchObject({
      coordinate: { x: 0, y: 0 },
    });
    expect(masterCalls).toBe(2);
  });
});

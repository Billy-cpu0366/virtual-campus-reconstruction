import { describe, expect, it } from "vitest";

import {
  PRODUCT_ENTRY_CAMERA_DURATION_MS,
  PRODUCT_ENTRY_TRAIN_ARRIVAL_MS,
  PhaserTrainArrivalAdapter,
  ProductEntryCameraAdapter,
  TimedTrainArrivalAdapter,
} from "../../game/ProductEntryAdapters.js";
import type {
  CameraRunResult,
  CameraRuntimeStartOptions,
} from "../../src/camera/index.js";

describe("ProductEntryCameraAdapter", () => {
  it("只提交当前点加3000ms回玩家，不使用默认111秒序列", async () => {
    const starts: CameraRuntimeStartOptions[] = [];
    let shutdowns = 0;
    const adapter = new ProductEntryCameraAdapter(
      {
        start: (options) => {
          starts.push(options);
          return Promise.resolve({ status: "completed" });
        },
        shutdown: () => {
          shutdowns += 1;
        },
      },
      () => ({ x: 944, y: 928 }),
    );

    const first = adapter.settleOnPlayer();
    expect(adapter.settleOnPlayer()).toBe(first);
    await expect(first).resolves.toBeUndefined();
    expect(starts).toEqual([
      {
        sequence: [
          { x: 944, y: 928, duration: 0, stayDuration: 0 },
        ],
        returnDuration: PRODUCT_ENTRY_CAMERA_DURATION_MS,
      },
    ]);
    expect(starts[0]?.sequence).toHaveLength(1);
    adapter.shutdown();
    expect(shutdowns).toBe(1);
  });

  it.each([
    { status: "cancelled" as const },
    { status: "failed" as const, error: new Error("camera failed") },
  ])("将非完成相机结果转成入口失败: $status", async (result) => {
    const adapter = new ProductEntryCameraAdapter(
      {
        start: () => Promise.resolve(result as CameraRunResult),
        shutdown: () => undefined,
      },
      () => ({ x: 0, y: 0 }),
    );

    await expect(adapter.settleOnPlayer()).rejects.toThrow(
      result.status === "failed" ? "camera failed" : "entry camera cancelled",
    );
  });
});

describe("PhaserTrainArrivalAdapter", () => {
  it("只从真实route holding状态发布arrival并移除观察listener", async () => {
    let state = "idle";
    let starts = 0;
    const listeners = new Set<(...args: unknown[]) => void>();
    const adapter = new PhaserTrainArrivalAdapter(
      {
        get snapshot() {
          return { state };
        },
        start: (now) => {
          expect(now).toBe(42);
          starts += 1;
          state = "arriving";
          return { ok: true };
        },
        shutdown: () => {
          state = "shutdown";
        },
      },
      {
        on: (_event, listener) => listeners.add(listener),
        off: (_event, listener) => listeners.delete(listener),
      },
      () => 42,
    );

    let resolved = false;
    const first = adapter.waitForArrival();
    expect(adapter.waitForArrival()).toBe(first);
    void first.then(() => {
      resolved = true;
    });
    expect(starts).toBe(1);
    expect(adapter.status).toBe("entering");
    for (const listener of listeners) listener(3_000);
    await Promise.resolve();
    expect(resolved).toBe(false);

    state = "holding";
    for (const listener of [...listeners]) listener(5_000);
    await expect(first).resolves.toBeUndefined();
    expect(adapter.status).toBe("arrived");
    expect(listeners.size).toBe(0);
  });

  it("start失败和shutdown都拒绝等待且不残留listener", async () => {
    const listeners = new Set<(...args: unknown[]) => void>();
    const failed = new PhaserTrainArrivalAdapter(
      {
        snapshot: { state: "idle" },
        start: () => ({ ok: false, reason: "missing-texture" }),
        shutdown: () => undefined,
      },
      {
        on: (_event, listener) => listeners.add(listener),
        off: (_event, listener) => listeners.delete(listener),
      },
      () => 0,
    );
    await expect(failed.waitForArrival()).rejects.toThrow("missing-texture");
    expect(listeners.size).toBe(0);

    let shutdowns = 0;
    const running = new PhaserTrainArrivalAdapter(
      {
        snapshot: { state: "arriving" },
        start: () => ({ ok: true }),
        shutdown: () => {
          shutdowns += 1;
        },
      },
      {
        on: (_event, listener) => listeners.add(listener),
        off: (_event, listener) => listeners.delete(listener),
      },
      () => 0,
    );
    const pending = running.waitForArrival();
    running.shutdown();
    running.shutdown();
    await expect(pending).rejects.toThrow("shut down");
    expect(shutdowns).toBe(1);
    expect(listeners.size).toBe(0);
  });
});

describe("TimedTrainArrivalAdapter", () => {
  it("5000ms只发布一次 arrived，并复用同一等待", async () => {
    let duration = -1;
    let callback: (() => void) | undefined;
    const adapter = new TimedTrainArrivalAdapter({
      delayedCall: (delay, handler) => {
        duration = delay;
        callback = handler;
        return {};
      },
    });

    const first = adapter.waitForArrival();
    expect(adapter.waitForArrival()).toBe(first);
    expect(duration).toBe(PRODUCT_ENTRY_TRAIN_ARRIVAL_MS);
    expect(adapter.status).toBe("entering");
    callback?.();
    await expect(first).resolves.toBeUndefined();
    expect(adapter.status).toBe("arrived");
  });

  it("shutdown清timer、拒绝等待且保持幂等", async () => {
    let removes = 0;
    const adapter = new TimedTrainArrivalAdapter({
      delayedCall: () => ({
        remove: () => {
          removes += 1;
        },
      }),
    });
    const pending = adapter.waitForArrival();

    adapter.shutdown();
    adapter.shutdown();
    await expect(pending).rejects.toThrow("shut down");
    await expect(adapter.waitForArrival()).rejects.toThrow("shut down");
    expect(adapter.status).toBe("shutdown");
    expect(removes).toBe(1);
  });
});

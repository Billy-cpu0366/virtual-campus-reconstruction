import { describe, expect, it } from "vitest";

import {
  PRODUCT_ENTRY_CAMERA_DURATION_MS,
  PRODUCT_ENTRY_TRAIN_ARRIVAL_MS,
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

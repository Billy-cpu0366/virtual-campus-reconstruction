import { describe, expect, it } from "vitest";

import { GameplayControlLeaseRuntime } from "../../game/GameplayControlLeaseRuntime.js";
import {
  MEMO6_GUIDE_TARGET,
  ProductEntryRuntime,
  type ProductEntryCameraPort,
  type ProductEntrySnapshot,
  type ProductEntryTrainPort,
} from "../../game/ProductEntryRuntime.js";

function deferred(): {
  readonly promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
} {
  let resolvePromise!: () => void;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function setup(options: { guideThrows?: boolean } = {}) {
  const calls: string[] = [];
  const snapshots: ProductEntrySnapshot[] = [];
  const cameraWork = deferred();
  const trainWork = deferred();
  const camera: ProductEntryCameraPort = {
    settleOnPlayer: () => {
      calls.push("camera:start");
      return cameraWork.promise;
    },
    shutdown: () => {
      calls.push("camera:shutdown");
    },
  };
  const train: ProductEntryTrainPort = {
    waitForArrival: () => {
      calls.push("train:start");
      return trainWork.promise;
    },
    shutdown: () => {
      calls.push("train:shutdown");
    },
  };
  const lease = new GameplayControlLeaseRuntime({
    disableControls: () => {
      calls.push("controls:disable");
    },
    enableControls: () => {
      calls.push("controls:enable");
    },
  });
  const runtime = new ProductEntryRuntime({
    lease,
    camera,
    train,
    guide: {
      publish: (target) => {
        calls.push(`guide:${target.menuId}`);
        expect(target).toEqual(MEMO6_GUIDE_TARGET);
        if (options.guideThrows === true) throw new Error("guide unavailable");
      },
    },
    onStatus: (snapshot) => snapshots.push(snapshot),
  });
  return { runtime, lease, calls, snapshots, cameraWork, trainWork };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ProductEntryRuntime", () => {
  it("同时启动相机和火车，两个收据齐全后才释放 entry lease", async () => {
    const { runtime, lease, calls, cameraWork, trainWork } = setup();
    const first = runtime.start();
    const second = runtime.start();

    expect(second).toBe(first);
    expect(calls.slice(0, 3)).toEqual([
      "controls:disable",
      "camera:start",
      "train:start",
    ]);
    expect(lease.activeLeaseCount).toBe(1);

    cameraWork.resolve();
    await flush();
    expect(runtime.snapshot).toMatchObject({
      status: "entering",
      cameraStable: true,
      trainArrived: false,
    });
    expect(calls).not.toContain("controls:enable");

    trainWork.resolve();
    await expect(first).resolves.toEqual({
      status: "completed",
      guidePublished: true,
    });
    expect(runtime.snapshot).toEqual({
      status: "playable",
      cameraStable: true,
      trainArrived: true,
      guidePublished: true,
    });
    expect(calls.slice(-2)).toEqual(["controls:enable", "guide:memo6"]);
    expect(lease.activeLeaseCount).toBe(0);
  });

  it("火车先到也必须等待相机稳定，Play 重复调用不重复启动", async () => {
    const { runtime, calls, cameraWork, trainWork } = setup();
    const run = runtime.start();
    expect(runtime.start()).toBe(run);

    trainWork.resolve();
    await flush();
    expect(runtime.snapshot).toMatchObject({
      status: "entering",
      cameraStable: false,
      trainArrived: true,
    });
    expect(calls.filter((call) => call === "camera:start")).toHaveLength(1);
    expect(calls.filter((call) => call === "train:start")).toHaveLength(1);
    expect(calls).not.toContain("controls:enable");

    cameraWork.resolve();
    await expect(run).resolves.toMatchObject({ status: "completed" });
  });

  it("任一入口端口失败时保持控制锁定并清理两个端口", async () => {
    const { runtime, lease, calls, cameraWork } = setup();
    const run = runtime.start();
    cameraWork.reject(new Error("camera failed"));

    await expect(run).resolves.toMatchObject({
      status: "failed",
      error: { message: "camera failed" },
    });
    expect(runtime.snapshot.status).toBe("failed");
    expect(lease.activeLeaseCount).toBe(1);
    expect(calls).toContain("camera:shutdown");
    expect(calls).toContain("train:shutdown");
    expect(calls).not.toContain("controls:enable");
    expect(calls).not.toContain("guide:memo6");
  });

  it("shutdown 取消入口、释放自身lease且晚到收据不能发布 guide", async () => {
    const { runtime, lease, calls, cameraWork, trainWork } = setup();
    const run = runtime.start();
    runtime.shutdown();
    runtime.shutdown();
    cameraWork.resolve();
    trainWork.resolve();

    await expect(run).resolves.toEqual({ status: "cancelled" });
    expect(runtime.snapshot.status).toBe("shutdown");
    expect(calls.filter((call) => call === "camera:shutdown")).toHaveLength(1);
    expect(calls.filter((call) => call === "train:shutdown")).toHaveLength(1);
    expect(calls.filter((call) => call === "controls:enable")).toHaveLength(1);
    expect(lease.activeLeaseCount).toBe(0);
    expect(calls).not.toContain("guide:memo6");
  });

  it("guide 失败不阻断 playable，也不重新锁控制", async () => {
    const { runtime, calls, cameraWork, trainWork } = setup({
      guideThrows: true,
    });
    const run = runtime.start();
    cameraWork.resolve();
    trainWork.resolve();

    await expect(run).resolves.toEqual({
      status: "completed",
      guidePublished: false,
    });
    expect(runtime.snapshot).toMatchObject({
      status: "playable",
      guidePublished: false,
    });
    expect(calls).toContain("controls:enable");
  });
});

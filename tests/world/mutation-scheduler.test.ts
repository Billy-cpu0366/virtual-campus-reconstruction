import { describe, expect, it, vi } from "vitest";

import { PhaserWorldMutationScheduler } from "../../game/PhaserWorldMutationScheduler.js";

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe("PhaserWorldMutationScheduler 生命周期", () => {
  it("活动异步写入期间新增任务保持串行", async () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => frames.push(cb));
    const scheduler = new PhaserWorldMutationScheduler();
    const gate = deferred();
    const first = scheduler.schedule(() => gate.promise);
    frames.shift()?.();
    await Promise.resolve();
    const next = vi.fn();
    const second = scheduler.schedule(next);
    let idle = false;
    const waiting = scheduler.waitForIdle().then(() => { idle = true; });
    expect(frames).toHaveLength(0);
    expect(idle).toBe(false);
    gate.resolve();
    await first;
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    expect(next).not.toHaveBeenCalled();
    frames.shift()?.();
    await second;
    await waiting;
    expect(next).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("同步异常释放已有 idle 等待者", async () => {
    let frame: (() => void) | undefined;
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { frame = cb; return 1; });
    const scheduler = new PhaserWorldMutationScheduler();
    const failed = scheduler.schedule(() => { throw new Error("sync"); });
    const rejected = expect(failed).rejects.toThrow("sync");
    const idle = scheduler.waitForIdle();
    frame?.();
    await rejected;
    await idle;
    vi.unstubAllGlobals();
  });

  it("销毁取消待执行帧并立即释放等待者", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 42);
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const scheduler = new PhaserWorldMutationScheduler();
    const mutation = vi.fn();
    const pending = scheduler.schedule(mutation);
    const idle = scheduler.waitForIdle();
    scheduler.destroy();
    await Promise.all([pending, idle]);
    expect(cancel).toHaveBeenCalledWith(42);
    expect(mutation).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("销毁时清空排队 mutation，并等待 active mutation", async () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: () => void) => {
        frames.push(callback);
        return frames.length;
      },
    );

    const scheduler = new PhaserWorldMutationScheduler();
    const activeGate = deferred();
    let activeStarted = false;
    const queuedMutation = vi.fn();
    const active = scheduler.schedule(async () => {
      activeStarted = true;
      await activeGate.promise;
    });
    const queued = scheduler.schedule(queuedMutation);

    frames.shift()?.();
    await vi.waitFor(() => expect(activeStarted).toBe(true));
    scheduler.destroy();

    await expect(queued).resolves.toBeUndefined();
    let idle = false;
    const idlePromise = scheduler.waitForActiveIdle().then(() => {
      idle = true;
    });
    expect(idle).toBe(false);

    activeGate.resolve();
    await expect(active).resolves.toBeUndefined();
    await idlePromise;
    expect(idle).toBe(true);
    expect(queuedMutation).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("waitForIdle 同时等待排队和 active mutation", async () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: () => void) => {
        frames.push(callback);
        return frames.length;
      },
    );

    const scheduler = new PhaserWorldMutationScheduler();
    const calls: string[] = [];
    const first = scheduler.schedule(() => {
      calls.push("first");
    });
    const second = scheduler.schedule(() => {
      calls.push("second");
    });
    let idle = false;
    const idlePromise = scheduler.waitForIdle().then(() => {
      idle = true;
    });

    expect(idle).toBe(false);
    frames.shift()?.();
    await first;
    await vi.waitFor(() => expect(frames.length).toBe(1));
    expect(idle).toBe(false);
    frames.shift()?.();
    await second;
    await idlePromise;
    expect(calls).toEqual(["first", "second"]);
    expect(idle).toBe(true);

    scheduler.destroy();
    vi.unstubAllGlobals();
  });

  it("active mutation rejection 可观察且 idle 等待不再产生 rejection", async () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: () => void) => {
        frames.push(callback);
        return frames.length;
      },
    );

    const scheduler = new PhaserWorldMutationScheduler();
    const failure = new Error("mutation failed");
    const pending = scheduler.schedule(async () => {
      throw failure;
    });
    frames.shift()?.();

    await expect(pending).rejects.toBe(failure);
    await expect(scheduler.waitForActiveIdle()).resolves.toBeUndefined();
    scheduler.destroy();
    vi.unstubAllGlobals();
  });
});

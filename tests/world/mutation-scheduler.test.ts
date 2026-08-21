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

import { describe, expect, it } from "vitest";

import {
  AppRuntime,
  type AppLoadCallbacks,
  type AppRuntimeEffects,
} from "../../src/app/index.js";

class FakeEffects implements AppRuntimeEffects {
  readonly callbacks = new Map<number, AppLoadCallbacks>();
  readonly cleanupCalls: number[] = [];
  readonly canceledGenerations: number[] = [];
  readonly entryCallbacks = new Map<
    number,
    { readonly onEntered: () => void; readonly onError: (error: unknown) => void }
  >();
  cleanupThrows = false;
  startLoadingCalls = 0;

  startLoading(generation: number, callbacks: AppLoadCallbacks) {
    this.startLoadingCalls += 1;
    this.callbacks.set(generation, callbacks);
    return {
      cancel: () => {
        this.canceledGenerations.push(generation);
      },
    };
  }

  cleanup(generation: number): void {
    this.cleanupCalls.push(generation);
    if (this.cleanupThrows) throw new Error("cleanup failed");
  }

  enterGame(
    generation: number,
    onEntered: () => void,
    onError: (error: unknown) => void,
  ): void {
    this.entryCallbacks.set(generation, { onEntered, onError });
  }
}

describe("AppRuntime", () => {
  it("runs the accepted lifecycle and makes Play/modal/shutdown idempotent", () => {
    const effects = new FakeEffects();
    const states: string[] = [];
    const runtime = new AppRuntime({
      effects,
      onChange: (snapshot) => states.push(snapshot.status),
    });

    expect(runtime.start()).toBe(true);
    expect(runtime.snapshot).toEqual({
      status: "LOADING",
      generation: 1,
      progress: 0,
    });
    expect(runtime.reportProgress(1, 0.4)).toBe(true);
    expect(runtime.snapshot.progress).toBe(0.4);
    expect(runtime.markReady(1)).toBe(true);
    expect(runtime.play()).toBe(true);
    expect(runtime.play()).toBe(false);
    expect(runtime.snapshot.status).toBe("ENTERING_GAME");

    effects.entryCallbacks.get(1)?.onEntered();
    expect(runtime.snapshot.status).toBe("PLAYING");
    expect(runtime.openModal()).toBe(true);
    expect(runtime.openModal()).toBe(false);
    expect(runtime.closeModal()).toBe(true);
    expect(runtime.closeModal()).toBe(false);
    expect(runtime.shutdown()).toBe(true);
    expect(runtime.shutdown()).toBe(false);
    expect(runtime.snapshot.status).toBe("SHUTDOWN");
    expect(effects.cleanupCalls).toEqual([1]);
    expect(effects.canceledGenerations).toEqual([1]);
    expect(states).toEqual([
      "LOADING",
      "LOADING",
      "READY",
      "ENTERING_GAME",
      "PLAYING",
      "MODAL_OPEN",
      "PLAYING",
      "SHUTDOWN",
    ]);
  });

  it("accepts only real monotonic progress and rejects stale callbacks after Retry", () => {
    const effects = new FakeEffects();
    const runtime = new AppRuntime({ effects });
    expect(runtime.start()).toBe(true);
    expect(runtime.reportProgress(1, 0.6)).toBe(true);
    expect(runtime.reportProgress(1, 0.5)).toBe(false);
    expect(runtime.reportProgress(1, 1.1)).toBe(false);
    expect(runtime.snapshot.progress).toBe(0.6);

    effects.callbacks.get(1)?.onError(new Error("asset failed"));
    expect(runtime.snapshot.status).toBe("ERROR");
    expect(runtime.snapshot.progress).toBe(0.6);
    expect(runtime.retry()).toBe(true);
    expect(runtime.snapshot).toEqual({
      status: "LOADING",
      generation: 2,
      progress: 0,
    });
    expect(effects.cleanupCalls).toEqual([1]);

    expect(runtime.reportProgress(1, 1)).toBe(false);
    expect(runtime.markReady(1)).toBe(false);
    expect(runtime.reportProgress(2, 0.25)).toBe(true);
    expect(runtime.retry()).toBe(false);
    effects.callbacks.get(2)?.onReady();
    expect(runtime.snapshot.status).toBe("READY");
  });

  it("does not start a new generation when old cleanup cannot finish", () => {
    const effects = new FakeEffects();
    const runtime = new AppRuntime({ effects });
    expect(runtime.start()).toBe(true);
    effects.cleanupThrows = true;
    effects.callbacks.get(1)?.onError("asset failed");

    expect(runtime.snapshot.status).toBe("ERROR");
    expect(runtime.snapshot.error?.kind).toBe("cleanup");
    expect(runtime.retry()).toBe(false);
    expect(runtime.snapshot.status).toBe("ERROR");
    expect(runtime.snapshot.generation).toBe(1);
    expect(effects.startLoadingCalls).toBe(1);
    expect(effects.cleanupCalls).toEqual([1, 1]);
  });

  it("ignores late entry callbacks and closes an entry error", () => {
    const effects = new FakeEffects();
    const runtime = new AppRuntime({ effects });
    runtime.start();
    effects.callbacks.get(1)?.onReady();
    runtime.play();
    effects.entryCallbacks.get(1)?.onError(new Error("entry failed"));
    expect(runtime.snapshot.status).toBe("ERROR");
    expect(runtime.markEntered(1)).toBe(false);

    expect(runtime.retry()).toBe(true);
    expect(runtime.markEntered(1)).toBe(false);
    expect(runtime.snapshot.generation).toBe(2);
    effects.callbacks.get(2)?.onReady();
    expect(runtime.snapshot.status).toBe("READY");
  });

  it("turns observer failures into no-op and remains shutdown-safe", () => {
    const effects = new FakeEffects();
    const runtime = new AppRuntime({
      effects,
      onChange: () => {
        throw new Error("observer failed");
      },
    });

    expect(() => runtime.start()).not.toThrow();
    expect(() => runtime.shutdown()).not.toThrow();
    expect(runtime.snapshot.status).toBe("SHUTDOWN");
  });
});

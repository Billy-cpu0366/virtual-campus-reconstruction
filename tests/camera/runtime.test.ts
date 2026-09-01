import { describe, expect, it } from "vitest";

import {
  CAMERA_RUNTIME_SETTINGS,
  CAMERA_SEQUENCE,
  CameraRuntime,
  type CameraPosition,
  type CameraRuntimeCallbacks,
  type CameraRuntimeDriver,
  type CameraRuntimeTweenOptions,
  type CameraViewport,
} from "../../src/camera/index.js";
import {
  PhaserCameraRuntime,
  type PhaserCameraLike,
  type PhaserCameraSceneLike,
} from "../../game/PhaserCameraRuntime.js";

class ManualDriver implements CameraRuntimeDriver {
  readonly timers: Array<() => void> = [];
  readonly tweens: Array<{
    readonly from: CameraPosition;
    readonly to: CameraPosition;
    readonly onUpdate: (position: CameraPosition) => void;
    readonly onComplete: () => void;
    readonly options: CameraRuntimeTweenOptions | undefined;
    cancelled: boolean;
  }> = [];

  delay(_duration: number, callback: () => void) {
    let cancelled = false;
    this.timers.push(() => {
      if (!cancelled) callback();
    });
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  tween(
    from: CameraPosition,
    to: CameraPosition,
    _duration: number,
    onUpdate: (position: CameraPosition) => void,
    onComplete: () => void,
    options?: CameraRuntimeTweenOptions,
  ) {
    const tween = {
      from,
      to,
      onUpdate,
      onComplete,
      options,
      cancelled: false,
    };
    this.tweens.push(tween);
    return {
      cancel: () => {
        tween.cancelled = true;
      },
    };
  }

  fireTimer(): void {
    this.timers.shift()?.();
  }

  updateTween(index: number, position: CameraPosition): void {
    const tween = this.tweens[index];
    if (tween !== undefined && !tween.cancelled) tween.onUpdate(position);
  }

  completeTween(index: number): void {
    const tween = this.tweens[index];
    if (tween !== undefined && !tween.cancelled) tween.onComplete();
  }
}

function makeCallbacks(log: string[], output: CameraViewport[] = []): {
  callbacks: CameraRuntimeCallbacks;
  viewport: CameraViewport;
} {
  const viewport: CameraViewport = {
    scrollX: 100,
    scrollY: 200,
    width: 320,
    height: 240,
    zoom: 2,
  };
  const callbacks: CameraRuntimeCallbacks = {
    disableControls: () => log.push("disable"),
    enableControls: () => log.push("enable"),
    stopFollow: () => log.push("stopFollow"),
    startHardFollow: (settings) => {
      expect(settings).toEqual(CAMERA_RUNTIME_SETTINGS);
      log.push("startHardFollow");
    },
    getViewport: () => viewport,
    outputViewport: (next) => {
      output.push(next);
      log.push(`viewport:${next.scrollX},${next.scrollY}`);
    },
    getPlayerPosition: () => ({ x: 900, y: 901 }),
    restoreCameraSettings: (settings) => {
      expect(settings).toEqual(CAMERA_RUNTIME_SETTINGS);
      log.push("restoreSettings");
    },
  };
  return { callbacks, viewport };
}

describe("CameraRuntime", () => {
  it("locks controls, emits only viewports, returns with Power2, then restores hard follow", async () => {
    const log: string[] = [];
    const output: CameraViewport[] = [];
    const driver = new ManualDriver();
    const { callbacks } = makeCallbacks(log, output);
    const runtime = new CameraRuntime(callbacks, driver);

    const sequence = [
      { x: 10, y: 20, duration: 0, stayDuration: 5 },
      { x: 30, y: 40, duration: 7, stayDuration: 0 },
    ] as const;
    const first = runtime.start({ sequence, returnDuration: 9 });
    const second = runtime.start({ sequence, returnDuration: 1 });

    expect(second).toBe(first);
    expect(log.slice(0, 2)).toEqual(["disable", "stopFollow"]);
    expect(output[0]).toMatchObject({ scrollX: -70, scrollY: -40, zoom: 2 });

    driver.fireTimer();
    expect(driver.tweens[0]?.options).toEqual({ ease: "Linear" });
    driver.updateTween(0, { x: 25, y: 35 });
    driver.completeTween(0);
    expect(driver.tweens[1]?.options).toEqual({ ease: "Power2" });
    driver.updateTween(1, { x: 500, y: 600 });
    driver.completeTween(1);

    await expect(first).resolves.toEqual({ status: "completed" });
    expect(output.at(-1)).toMatchObject({ scrollX: 820, scrollY: 841 });
    expect(log.slice(-3)).toEqual([
      "restoreSettings",
      "startHardFollow",
      "enable",
    ]);
    expect(runtime.start()).toBe(first);
    expect(CAMERA_SEQUENCE).toHaveLength(6);
    expect(log.filter((entry) => entry === "disable")).toHaveLength(1);
    expect(log.filter((entry) => entry === "restoreSettings")).toHaveLength(1);
    expect(log.filter((entry) => entry === "startHardFollow")).toHaveLength(1);
    expect(log.filter((entry) => entry === "enable")).toHaveLength(1);
  });

  it("uses the complete 111 second production schedule plus 3 second return", async () => {
    const log: string[] = [];
    const { callbacks } = makeCallbacks(log);
    const delays: number[] = [];
    const tweens: Array<{
      duration: number;
      ease: string | undefined;
    }> = [];
    const driver: CameraRuntimeDriver = {
      delay: (duration, callback) => {
        delays.push(duration);
        callback();
        return { cancel: () => undefined };
      },
      tween: (_from, to, duration, onUpdate, onComplete, options) => {
        tweens.push({ duration, ease: options?.ease });
        onUpdate(to);
        onComplete();
        return { cancel: () => undefined };
      },
    };
    const runtime = new CameraRuntime(callbacks, driver);

    await expect(runtime.start()).resolves.toEqual({ status: "completed" });
    expect(delays).toEqual([7000, 7000, 5000, 5000, 7000, 5000]);
    expect(tweens.map(({ duration }) => duration)).toEqual([
      15000,
      15000,
      15000,
      15000,
      15000,
      3000,
    ]);
    expect(
      delays.reduce((total, duration) => total + duration, 0) +
        tweens.slice(0, -1).reduce(
          (total, { duration }) => total + duration,
          0,
        ),
    ).toBe(111000);
    expect(tweens.at(-1)).toEqual({ duration: 3000, ease: "Power2" });
  });

  it("does not replace nested active handles when callbacks are synchronous", async () => {
    const log: string[] = [];
    const { callbacks } = makeCallbacks(log);
    const handles: Array<{ cancelled: boolean }> = [];
    const driver: CameraRuntimeDriver = {
      delay: (_duration, callback) => {
        const handle = { cancelled: false };
        handles.push(handle);
        callback();
        return { cancel: () => { handle.cancelled = true; } };
      },
      tween: (_from, to, _duration, onUpdate, onComplete) => {
        const handle = { cancelled: false };
        handles.push(handle);
        onUpdate(to);
        onComplete();
        return { cancel: () => { handle.cancelled = true; } };
      },
    };
    const runtime = new CameraRuntime(callbacks, driver);

    await expect(
      runtime.start({
        sequence: [
          { x: 10, y: 20, duration: 1, stayDuration: 1 },
          { x: 30, y: 40, duration: 1, stayDuration: 0 },
        ],
        returnDuration: 1,
      }),
    ).resolves.toEqual({ status: "completed" });
    expect(handles.every((handle) => !handle.cancelled)).toBe(true);
  });

  it("fails and restores when a viewport output throws", async () => {
    const log: string[] = [];
    const driver = new ManualDriver();
    const { callbacks } = makeCallbacks(log);
    const failingCallbacks: CameraRuntimeCallbacks = {
      ...callbacks,
      outputViewport: () => {
        throw new Error("viewport failed");
      },
    };
    const runtime = new CameraRuntime(failingCallbacks, driver);

    await expect(
      runtime.start({
        sequence: [{ x: 1, y: 2, duration: 0, stayDuration: 0 }],
        returnDuration: 0,
      }),
    ).resolves.toMatchObject({ status: "failed", error: { message: "viewport failed" } });
    expect(log).toContain("startHardFollow");
    expect(log).toContain("enable");
    expect(driver.timers).toHaveLength(0);
  });

  it("shutdown cancels active work and rejects later starts", async () => {
    const log: string[] = [];
    const driver = new ManualDriver();
    const { callbacks } = makeCallbacks(log);
    const runtime = new CameraRuntime(callbacks, driver);
    const running = runtime.start({
      sequence: [{ x: 1, y: 2, duration: 0, stayDuration: 100 }],
      returnDuration: 100,
    });

    runtime.shutdown();
    driver.fireTimer();
    await expect(running).resolves.toEqual({ status: "cancelled" });
    await expect(runtime.start()).rejects.toThrow("shut down");
    expect(runtime.status).toBe("shutdown");
    expect(log).toContain("startHardFollow");
    expect(log).toContain("enable");
  });
});

class FakeCamera implements PhaserCameraLike {
  scrollX = 50;
  scrollY = 60;
  readonly width = 320;
  readonly height = 240;
  zoom = 2;
  roundPixels = false;
  readonly calls: string[] = [];

  stopFollow(): void {
    this.calls.push("stopFollow");
  }

  setZoom(value: number): void {
    this.zoom = value;
    this.calls.push(`zoom:${value}`);
  }

  setFollowOffset(x: number, y: number): void {
    this.calls.push(`offset:${x},${y}`);
  }

  setDeadzone(x: number, y: number): void {
    this.calls.push(`deadzone:${x},${y}`);
  }
}

describe("PhaserCameraRuntime", () => {
  it("reads nativeScale per run, reports effect degradation, and adapts viewport output", async () => {
    const camera = new FakeCamera();
    const warnings: string[] = [];
    const scales: number[] = [];
    const scene: PhaserCameraSceneLike = {
      cameras: { main: camera },
      time: { delayedCall: () => ({}) },
      tweens: { add: () => ({}) },
    };
    let providerCalls = 0;
    const effectSettings: number[] = [];
    const runtime = new PhaserCameraRuntime(scene, {
      controlGate: {
        disableControls: () => camera.calls.push("disable"),
        enableControls: () => camera.calls.push("enable"),
      },
      getPlayerPosition: () => ({ x: 700, y: 701 }),
      startHardFollow: (settings) => {
        expect(settings).toEqual(CAMERA_RUNTIME_SETTINGS);
        camera.calls.push("startHardFollow");
      },
      nativeScaleProvider: () => {
        providerCalls += 1;
        camera.calls.push("nativeScale");
        return 1.5;
      },
      onNativeScaleSettings: (settings) => scales.push(settings.nativeScale),
      warn: (warning) => warnings.push(warning),
      effectInstallers: {
        HeatHaze: (settings) => {
          effectSettings.push(settings.blurStrength);
          camera.calls.push("effect:HeatHaze");
          return undefined;
        },
        Fire: () => {
          throw new Error("missing pipeline");
        },
      },
      driver: {
        delay: (_duration, callback) => {
          callback();
          return { cancel: () => undefined };
        },
        tween: (_from, to, _duration, onUpdate, onComplete) => {
          onUpdate(to);
          onComplete();
          return { cancel: () => undefined };
        },
      },
    });

    const first = runtime.start({
      sequence: [{ x: 10, y: 20, duration: 0, stayDuration: 0 }],
      returnDuration: 0,
    });
    const second = runtime.start();
    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ status: "completed" });

    expect(providerCalls).toBe(1);
    expect(scales).toEqual([1.5]);
    expect(effectSettings).toEqual([24]);
    expect(runtime.nativeScaleSettings).toMatchObject({
      blurStrength: 24,
      scaleFactor: 2 / 3,
      chunkRenderBlockSize: 15,
    });
    expect(runtime.effectAvailability).toEqual({
      HeatHaze: "installed",
      Fire: "unavailable",
      Morph: "unavailable",
    });
    expect(warnings).toHaveLength(2);
    expect(camera.scrollX).toBe(540);
    expect(camera.scrollY).toBe(581);
    expect(camera.roundPixels).toBe(true);
    expect(camera.calls).toContain("stopFollow");
    expect(camera.calls).toContain("startHardFollow");
    expect(camera.calls).toContain("enable");
    expect(camera.calls.indexOf("startHardFollow")).toBeLessThan(
      camera.calls.indexOf("nativeScale"),
    );
    expect(camera.calls.indexOf("nativeScale")).toBeLessThan(
      camera.calls.indexOf("effect:HeatHaze"),
    );
    expect(camera.calls.indexOf("effect:HeatHaze")).toBeLessThan(
      camera.calls.indexOf("enable"),
    );
  });

  it("keeps optional-effect warning failures non-blocking", async () => {
    const camera = new FakeCamera();
    const scene: PhaserCameraSceneLike = {
      cameras: { main: camera },
      time: { delayedCall: () => ({}) },
      tweens: { add: () => ({}) },
    };
    const runtime = new PhaserCameraRuntime(scene, {
      controlGate: {
        disableControls: () => undefined,
        enableControls: () => camera.calls.push("enable"),
      },
      getPlayerPosition: () => ({ x: 700, y: 701 }),
      startHardFollow: () => undefined,
      nativeScaleProvider: () => 2,
      warn: () => {
        throw new Error("diagnostic sink failed");
      },
      driver: {
        delay: (_duration, callback) => {
          callback();
          return { cancel: () => undefined };
        },
        tween: (_from, to, _duration, onUpdate, onComplete) => {
          onUpdate(to);
          onComplete();
          return { cancel: () => undefined };
        },
      },
    });

    await expect(
      runtime.start({
        sequence: [{ x: 10, y: 20, duration: 0, stayDuration: 0 }],
        returnDuration: 0,
      }),
    ).resolves.toEqual({ status: "completed" });
    expect(runtime.effectAvailability).toEqual({
      HeatHaze: "unavailable",
      Fire: "unavailable",
      Morph: "unavailable",
    });
    expect(camera.calls).toContain("enable");
  });

  it("does not install effects or read nativeScale on failure or shutdown", async () => {
    const makeScene = (camera: FakeCamera): PhaserCameraSceneLike => ({
      cameras: { main: camera },
      time: { delayedCall: () => ({}) },
      tweens: { add: () => ({}) },
    });
    const failedCamera = new FakeCamera();
    let failedProviderCalls = 0;
    let failedInstallCalls = 0;
    const failedRuntime = new PhaserCameraRuntime(
      makeScene(failedCamera),
      {
        controlGate: {
          disableControls: () => undefined,
          enableControls: () => undefined,
        },
        getPlayerPosition: () => ({ x: 700, y: 701 }),
        startHardFollow: () => undefined,
        nativeScaleProvider: () => {
          failedProviderCalls += 1;
          return 1;
        },
        onViewport: () => {
          throw new Error("output failed");
        },
        effectInstallers: {
          HeatHaze: () => {
            failedInstallCalls += 1;
          },
          Fire: () => {
            failedInstallCalls += 1;
          },
          Morph: () => {
            failedInstallCalls += 1;
          },
        },
      },
    );

    await expect(
      failedRuntime.start({
        sequence: [{ x: 10, y: 20, duration: 0, stayDuration: 0 }],
        returnDuration: 0,
      }),
    ).resolves.toMatchObject({ status: "failed" });
    expect(failedProviderCalls).toBe(0);
    expect(failedInstallCalls).toBe(0);

    const shutdownCamera = new FakeCamera();
    let shutdownProviderCalls = 0;
    let shutdownInstallCalls = 0;
    const shutdownRuntime = new PhaserCameraRuntime(
      makeScene(shutdownCamera),
      {
        controlGate: {
          disableControls: () => undefined,
          enableControls: () => undefined,
        },
        getPlayerPosition: () => ({ x: 700, y: 701 }),
        startHardFollow: () => undefined,
        nativeScaleProvider: () => {
          shutdownProviderCalls += 1;
          return 1;
        },
        effectInstallers: {
          HeatHaze: () => {
            shutdownInstallCalls += 1;
          },
          Fire: () => {
            shutdownInstallCalls += 1;
          },
          Morph: () => {
            shutdownInstallCalls += 1;
          },
        },
        driver: {
          delay: () => ({ cancel: () => undefined }),
          tween: () => ({ cancel: () => undefined }),
        },
      },
    );
    const running = shutdownRuntime.start({
      sequence: [{ x: 10, y: 20, duration: 0, stayDuration: 100 }],
      returnDuration: 0,
    });
    shutdownRuntime.shutdown();

    await expect(running).resolves.toEqual({ status: "cancelled" });
    expect(shutdownProviderCalls).toBe(0);
    expect(shutdownInstallCalls).toBe(0);
  });
});

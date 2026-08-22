import type {
  CameraPosition,
  CameraRunResult,
  CameraRuntimeStartOptions,
} from "../src/camera/index.js";
import type {
  ProductEntryCameraPort,
  ProductEntryTrainPort,
} from "./ProductEntryRuntime.js";

export const PRODUCT_ENTRY_CAMERA_DURATION_MS = 3000;
export const PRODUCT_ENTRY_TRAIN_ARRIVAL_MS = 5000;

interface ProductEntryCameraRuntimeLike {
  start(options: CameraRuntimeStartOptions): Promise<CameraRunResult>;
  shutdown(): void;
}

export class ProductEntryCameraAdapter implements ProductEntryCameraPort {
  private promise: Promise<void> | undefined;

  constructor(
    private readonly runtime: ProductEntryCameraRuntimeLike,
    private readonly getCurrentCenter: () => CameraPosition,
  ) {}

  settleOnPlayer(): Promise<void> {
    if (this.promise !== undefined) return this.promise;
    const center = this.getCurrentCenter();
    this.promise = this.runtime
      .start({
        sequence: [
          Object.freeze({
            x: center.x,
            y: center.y,
            duration: 0,
            stayDuration: 0,
          }),
        ],
        returnDuration: PRODUCT_ENTRY_CAMERA_DURATION_MS,
      })
      .then((result) => {
        if (result.status === "completed") return;
        if (result.status === "failed") throw result.error;
        throw new Error("entry camera cancelled");
      });
    return this.promise;
  }

  shutdown(): void {
    this.runtime.shutdown();
  }
}

type ProductEntryUpdateListener = (...args: unknown[]) => void;

export interface ProductEntryTrainRuntimeLike {
  readonly snapshot: {
    readonly state: string;
  };
  start(nowMs: number): { readonly ok: true } | { readonly ok: false; readonly reason: string };
  shutdown(nowMs?: number): void;
}

export interface ProductEntryUpdateEventsLike {
  on(event: "update", listener: ProductEntryUpdateListener, context?: unknown): unknown;
  off(event: "update", listener: ProductEntryUpdateListener, context?: unknown): unknown;
}

/** Resolves only from the real route entering holding; it owns no truth timer. */
export class PhaserTrainArrivalAdapter implements ProductEntryTrainPort {
  private promise: Promise<void> | undefined;
  private resolvePromise: (() => void) | undefined;
  private rejectPromise: ((error: Error) => void) | undefined;
  private listenerAttached = false;
  private state: "idle" | "entering" | "arrived" | "failed" | "shutdown" = "idle";

  private readonly handleUpdate: ProductEntryUpdateListener = (): void => {
    this.observeRoute();
  };

  constructor(
    private readonly runtime: ProductEntryTrainRuntimeLike,
    private readonly events: ProductEntryUpdateEventsLike,
    private readonly now: () => number,
  ) {}

  get status(): "idle" | "entering" | "arrived" | "failed" | "shutdown" {
    return this.state;
  }

  waitForArrival(): Promise<void> {
    if (this.promise !== undefined) return this.promise;
    if (this.state === "shutdown") {
      return Promise.reject(new Error("entry train adapter has been shut down"));
    }

    this.promise = new Promise<void>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
    this.state = "entering";
    try {
      const started = this.runtime.start(this.now());
      if (!started.ok) {
        this.fail(new Error(`entry train start failed: ${started.reason}`));
        return this.promise;
      }
      this.attach();
      this.observeRoute();
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    }
    return this.promise;
  }

  shutdown(): void {
    if (this.state === "shutdown") return;
    this.state = "shutdown";
    this.detach();
    this.runtime.shutdown(this.now());
    const reject = this.rejectPromise;
    this.resolvePromise = undefined;
    this.rejectPromise = undefined;
    reject?.(new Error("entry train adapter has been shut down"));
  }

  private observeRoute(): void {
    if (this.state !== "entering") return;
    const routeState = this.runtime.snapshot.state;
    if (routeState === "holding") {
      this.state = "arrived";
      this.detach();
      const resolve = this.resolvePromise;
      this.resolvePromise = undefined;
      this.rejectPromise = undefined;
      resolve?.();
      return;
    }
    if (
      routeState === "complete" ||
      routeState === "cancelled" ||
      routeState === "shutdown"
    ) {
      this.fail(new Error(`entry train ended before arrival: ${routeState}`));
    }
  }

  private fail(error: Error): void {
    if (this.state === "shutdown" || this.state === "arrived") return;
    this.state = "failed";
    this.detach();
    const reject = this.rejectPromise;
    this.resolvePromise = undefined;
    this.rejectPromise = undefined;
    reject?.(error);
  }

  private attach(): void {
    if (this.listenerAttached) return;
    this.events.on("update", this.handleUpdate, this);
    this.listenerAttached = true;
  }

  private detach(): void {
    if (!this.listenerAttached) return;
    this.events.off("update", this.handleUpdate, this);
    this.listenerAttached = false;
  }
}

export interface ProductEntryTimerLike {
  remove?(destroy?: boolean): unknown;
  destroy?(): unknown;
}

export interface ProductEntryClockLike {
  delayedCall(
    delay: number,
    callback: () => void,
  ): ProductEntryTimerLike;
}

export class TimedTrainArrivalAdapter implements ProductEntryTrainPort {
  private timer: ProductEntryTimerLike | undefined;
  private promise: Promise<void> | undefined;
  private rejectPromise: ((error: Error) => void) | undefined;
  private state: "idle" | "entering" | "arrived" | "shutdown" = "idle";

  constructor(private readonly clock: ProductEntryClockLike) {}

  get status(): "idle" | "entering" | "arrived" | "shutdown" {
    return this.state;
  }

  waitForArrival(): Promise<void> {
    if (this.promise !== undefined) return this.promise;
    if (this.state === "shutdown") {
      return Promise.reject(new Error("entry train adapter has been shut down"));
    }
    this.state = "entering";
    this.promise = new Promise<void>((resolve, reject) => {
      this.rejectPromise = reject;
      this.timer = this.clock.delayedCall(PRODUCT_ENTRY_TRAIN_ARRIVAL_MS, () => {
        if (this.state !== "entering") return;
        this.timer = undefined;
        this.rejectPromise = undefined;
        this.state = "arrived";
        resolve();
      });
    });
    return this.promise;
  }

  shutdown(): void {
    if (this.state === "shutdown") return;
    this.state = "shutdown";
    const timer = this.timer;
    this.timer = undefined;
    if (timer?.remove !== undefined) timer.remove(false);
    else timer?.destroy?.();
    const reject = this.rejectPromise;
    this.rejectPromise = undefined;
    reject?.(new Error("entry train adapter has been shut down"));
  }
}

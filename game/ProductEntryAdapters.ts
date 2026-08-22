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

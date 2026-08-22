import type {
  GameplayControlLeasePort,
  GameplayControlLeaseToken,
} from "../src/content/contract.js";

export type ProductEntryStatus =
  | "ready"
  | "entering"
  | "playable"
  | "failed"
  | "shutdown";

export interface ProductEntryCameraPort {
  settleOnPlayer(): Promise<void>;
  shutdown(): void;
}

export interface ProductEntryTrainPort {
  waitForArrival(): Promise<void>;
  shutdown(): void;
}

export interface ProductEntryGuideTarget {
  readonly menuId: "memo6";
  readonly westTiles: 36;
  readonly northTiles: 7;
}

export interface ProductEntryGuidePort {
  publish(target: ProductEntryGuideTarget): void | boolean;
}

export interface ProductEntrySnapshot {
  readonly status: ProductEntryStatus;
  readonly cameraStable: boolean;
  readonly trainArrived: boolean;
  readonly guidePublished: boolean;
}

export type ProductEntryResult =
  | {
      readonly status: "completed";
      readonly guidePublished: boolean;
    }
  | { readonly status: "failed"; readonly error: Error }
  | { readonly status: "cancelled" };

export interface ProductEntryRuntimeOptions {
  readonly lease: GameplayControlLeasePort;
  readonly camera: ProductEntryCameraPort;
  readonly train: ProductEntryTrainPort;
  readonly guide: ProductEntryGuidePort;
  readonly onStatus?: (snapshot: ProductEntrySnapshot) => void;
}

export const MEMO6_GUIDE_TARGET: ProductEntryGuideTarget = Object.freeze({
  menuId: "memo6",
  westTiles: 36,
  northTiles: 7,
});

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Main-owned orchestration only; camera, train, app and content remain ports. */
export class ProductEntryRuntime {
  private statusState: ProductEntryStatus = "ready";
  private cameraStableState = false;
  private trainArrivedState = false;
  private guidePublishedState = false;
  private leaseToken: GameplayControlLeaseToken | undefined;
  private runPromise: Promise<ProductEntryResult> | undefined;

  constructor(private readonly options: ProductEntryRuntimeOptions) {}

  get snapshot(): ProductEntrySnapshot {
    return Object.freeze({
      status: this.statusState,
      cameraStable: this.cameraStableState,
      trainArrived: this.trainArrivedState,
      guidePublished: this.guidePublishedState,
    });
  }

  start(): Promise<ProductEntryResult> {
    if (this.runPromise !== undefined) return this.runPromise;
    if (this.statusState === "shutdown") {
      return Promise.resolve(Object.freeze({ status: "cancelled" as const }));
    }
    this.runPromise = this.run();
    return this.runPromise;
  }

  shutdown(): void {
    if (this.statusState === "shutdown") return;
    this.statusState = "shutdown";
    this.options.camera.shutdown();
    this.options.train.shutdown();
    this.notify();
  }

  private async run(): Promise<ProductEntryResult> {
    this.statusState = "entering";
    this.notify();

    const acquired = this.options.lease.acquire("entry-transition");
    if (!acquired.ok) {
      return this.fail(new Error(`entry lease acquire failed: ${acquired.reason}`));
    }
    this.leaseToken = acquired.token;

    try {
      await Promise.all([
        this.options.camera.settleOnPlayer().then(() => {
          this.cameraStableState = true;
          this.notify();
        }),
        this.options.train.waitForArrival().then(() => {
          this.trainArrivedState = true;
          this.notify();
        }),
      ]);
      if (this.isShutdown()) {
        return Object.freeze({ status: "cancelled" as const });
      }

      const token = this.leaseToken;
      if (token === undefined) {
        throw new Error("entry lease token missing");
      }
      const released = this.options.lease.release(token);
      if (!released.ok) {
        throw new Error(`entry lease release failed: ${released.reason}`);
      }
      this.leaseToken = undefined;
      this.statusState = "playable";
      this.notify();

      try {
        this.guidePublishedState =
          this.options.guide.publish(MEMO6_GUIDE_TARGET) !== false;
      } catch {
        this.guidePublishedState = false;
      }
      this.notify();
      return Object.freeze({
        status: "completed" as const,
        guidePublished: this.guidePublishedState,
      });
    } catch (error: unknown) {
      if (this.isShutdown()) {
        return Object.freeze({ status: "cancelled" as const });
      }
      return this.fail(asError(error));
    }
  }

  private isShutdown(): boolean {
    return this.statusState === "shutdown";
  }

  private fail(error: Error): ProductEntryResult {
    this.statusState = "failed";
    this.options.camera.shutdown();
    this.options.train.shutdown();
    this.notify();
    return Object.freeze({ status: "failed" as const, error });
  }

  private notify(): void {
    try {
      this.options.onStatus?.(this.snapshot);
    } catch {
      // A status observer cannot own or break entry lifecycle.
    }
  }
}

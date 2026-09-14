import type { ChunkMutation, ChunkMutationScheduler } from "../src/chunk/index.js";

interface PendingMutation {
  readonly mutation: ChunkMutation;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

/**
 * Limits synchronous Phaser Tilemap mutations to one chunk operation per
 * animation frame, so a burst of chunk responses cannot monopolize input.
 */
export class PhaserWorldMutationScheduler {
  #queue: PendingMutation[] = [];
  #frameRequested = false;
  #frameId: number | undefined;
  #active: Promise<void> | undefined;
  #idleWaiters: Array<() => void> = [];
  #destroyed = false;

  readonly schedule: ChunkMutationScheduler = (mutation) => {
    if (this.#destroyed) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.#queue.push({ mutation, resolve, reject });
      this.#requestFrame();
    });
  };

  destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    if (this.#frameId !== undefined) {
      cancelAnimationFrame(this.#frameId);
      this.#frameId = undefined;
      this.#frameRequested = false;
    }
    const pending = this.#queue.splice(0);
    for (const item of pending) {
      item.resolve();
    }
    this.#resolveIdleIfNeeded();
  }

  waitForIdle(): Promise<void> {
    if (this.#isIdle()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.#idleWaiters.push(resolve);
    });
  }

  waitForActiveIdle(): Promise<void> {
    return this.waitForIdle();
  }

  #requestFrame(): void {
    if (
      this.#destroyed ||
      this.#frameRequested ||
      this.#active !== undefined ||
      this.#queue.length === 0
    ) {
      return;
    }

    this.#frameRequested = true;
    this.#frameId = requestAnimationFrame(() => {
      this.#frameId = undefined;
      this.#frameRequested = false;
      const item = this.#queue.shift();
      if (item === undefined) {
        this.#resolveIdleIfNeeded();
        return;
      }
      if (this.#destroyed) {
        item.resolve();
        this.#resolveIdleIfNeeded();
        return;
      }

      // Publish the active promise before invoking user work (including
      // synchronous throws and reentrant schedule calls).
      const active = Promise.resolve()
        .then(() => item.mutation())
        .then(
          () => {
            item.resolve();
          },
          (error: unknown) => {
            item.reject(error);
          },
        )
        .then(() => undefined, () => undefined);
      this.#active = active;
      void active.then(() => {
        if (this.#active === active) {
          this.#active = undefined;
        }
        this.#requestFrame();
        this.#resolveIdleIfNeeded();
      });
    });
  }

  #isIdle(): boolean {
    return (
      this.#queue.length === 0 &&
      !this.#frameRequested &&
      this.#active === undefined
    );
  }

  #resolveIdleIfNeeded(): void {
    if (!this.#isIdle()) return;
    const waiters = this.#idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}

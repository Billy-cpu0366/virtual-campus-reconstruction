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
  #active: Promise<void> | undefined;
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
    const pending = this.#queue.splice(0);
    for (const item of pending) {
      item.resolve();
    }
  }

  async waitForActiveIdle(): Promise<void> {
    while (this.#active !== undefined) {
      await this.#active;
    }
  }

  #requestFrame(): void {
    if (
      this.#destroyed ||
      this.#frameRequested ||
      this.#queue.length === 0
    ) {
      return;
    }

    this.#frameRequested = true;
    requestAnimationFrame(() => {
      this.#frameRequested = false;
      const item = this.#queue.shift();
      if (item === undefined) {
        return;
      }
      if (this.#destroyed) {
        item.resolve();
        return;
      }

      let result: void | Promise<void>;
      try {
        result = item.mutation();
      } catch (error) {
        item.reject(error);
        this.#requestFrame();
        return;
      }

      const active = Promise.resolve(result)
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
      });
    });
  }
}

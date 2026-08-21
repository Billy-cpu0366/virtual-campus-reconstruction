import type { ChunkCoordinate } from "./coordinates.js";
import {
  ChunkDataStore,
  type ChunkLoadFailure,
} from "./data-store.js";
import type { World } from "../world/contract.js";

export interface ChunkCoordinatorFailure {
  readonly coordinate: ChunkCoordinate;
  readonly stage: "apply" | "remove";
  readonly reason: string;
}

export type ChunkMutation = () => void | Promise<void>;
export type ChunkMutationScheduler = (
  mutation: ChunkMutation,
) => Promise<void>;

export interface ChunkCoordinatorOptions {
  readonly scheduleMutation?: ChunkMutationScheduler;
}

export interface ChunkCoordinatorState {
  readonly targets: readonly ChunkCoordinate[];
  readonly rendered: readonly ChunkCoordinate[];
  readonly requesting: readonly ChunkCoordinate[];
  readonly cached: readonly ChunkCoordinate[];
  readonly failed: readonly (ChunkLoadFailure | ChunkCoordinatorFailure)[];
  readonly destroyed: boolean;
}

function coordinateKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}_${coordinate.y}`;
}

const immediateMutationScheduler: ChunkMutationScheduler = async (mutation) => {
  await mutation();
};

function copyCoordinates(
  coordinates: Iterable<ChunkCoordinate>,
): readonly ChunkCoordinate[] {
  return [...coordinates]
    .map((coordinate) => Object.freeze({ x: coordinate.x, y: coordinate.y }))
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

export class ChunkCoordinator {
  readonly store: ChunkDataStore;
  readonly world: World;
  #targets = new Map<string, ChunkCoordinate>();
  #requesting = new Map<string, Promise<void>>();
  #mutating = new Map<string, Promise<void>>();
  #worldFailures = new Map<string, ChunkCoordinatorFailure>();
  #destroyed = false;
  #destroyPromise: Promise<void> | undefined;
  #scheduleMutation: ChunkMutationScheduler;

  constructor(
    store: ChunkDataStore,
    world: World,
    options: ChunkCoordinatorOptions = {},
  ) {
    this.store = store;
    this.world = world;
    this.#scheduleMutation =
      options.scheduleMutation ?? immediateMutationScheduler;
  }

  get destroyed(): boolean {
    return this.#destroyed;
  }

  get targets(): readonly ChunkCoordinate[] {
    return copyCoordinates(this.#targets.values());
  }

  get rendered(): readonly ChunkCoordinate[] {
    return copyCoordinates(this.world.renderedChunks);
  }

  get requesting(): readonly ChunkCoordinate[] {
    return copyCoordinates(
      [...this.#requesting.keys()].map((key) => {
        const [x, y] = key.split("_");
        return { x: Number(x), y: Number(y) };
      }),
    );
  }

  get cached(): readonly ChunkCoordinate[] {
    return this.store.cachedChunks;
  }

  get failed(): readonly (ChunkLoadFailure | ChunkCoordinatorFailure)[] {
    return [
      ...this.store.failures,
      ...this.#worldFailures.values(),
    ];
  }

  get state(): ChunkCoordinatorState {
    return Object.freeze({
      targets: this.targets,
      rendered: this.rendered,
      requesting: this.requesting,
      cached: this.cached,
      failed: this.failed,
      destroyed: this.#destroyed,
    });
  }

  async updateTargets(
    coordinates: Iterable<ChunkCoordinate>,
  ): Promise<void> {
    if (this.#destroyed) {
      return;
    }

    this.#targets = new Map(
      [...coordinates].map((coordinate) => [
        coordinateKey(coordinate),
        Object.freeze({ x: coordinate.x, y: coordinate.y }),
      ]),
    );

    const pending: Promise<void>[] = [];
    for (const rendered of this.world.renderedChunks) {
      const key = coordinateKey(rendered);
      if (!this.#targets.has(key)) {
        pending.push(this.#removeIfCurrent(rendered));
      }
    }

    for (const coordinate of this.#targets.values()) {
      const key = coordinateKey(coordinate);
      if (this.world.renderedChunks.some((item) => coordinateKey(item) === key)) {
        this.#worldFailures.delete(key);
        continue;
      }

      const cached = this.store.getCached(coordinate);
      if (cached !== undefined) {
        pending.push(this.#applyIfCurrent(cached));
        continue;
      }

      const existing = this.#requesting.get(key);
      if (existing !== undefined) {
        pending.push(existing);
        continue;
      }
      if (this.store.getFailure(coordinate) !== undefined) {
        continue;
      }

      const request = this.#request(coordinate, false);
      pending.push(request);
    }

    await Promise.all(pending);
  }

  retry(
    coordinate: ChunkCoordinate,
    attempts = this.store.maxAttempts,
  ): Promise<void> {
    if (this.#destroyed || !this.#targets.has(coordinateKey(coordinate))) {
      return Promise.resolve();
    }
    return this.#request(coordinate, true, attempts);
  }

  destroy(): void {
    void this.destroyAsync();
  }

  async destroyAsync(): Promise<void> {
    if (this.#destroyPromise !== undefined) {
      return this.#destroyPromise;
    }

    this.#destroyed = true;
    this.#targets.clear();
    this.#worldFailures.clear();
    this.store.destroy();
    this.world.destroy();

    const requests = [...this.#requesting.values()];
    const mutations = [...this.#mutating.values()];
    this.#requesting.clear();
    this.#mutating.clear();
    this.#destroyPromise = Promise.allSettled([
      ...requests,
      ...mutations,
    ]).then(() => undefined);
    return this.#destroyPromise;
  }

  #request(
    coordinate: ChunkCoordinate,
    retry: boolean,
    attempts = this.store.maxAttempts,
  ): Promise<void> {
    const key = coordinateKey(coordinate);
    const request = (retry
      ? this.store.retryChunk(coordinate, attempts)
      : this.store.loadChunk(coordinate)
    )
      .then((chunk) => this.#applyIfCurrent(chunk))
      .catch(() => undefined);
    this.#requesting.set(key, request);
    void request.then(() => {
      if (this.#requesting.get(key) === request) {
        this.#requesting.delete(key);
      }
    });
    return request;
  }

  #trackMutation(
    key: string,
    mutation: () => void | Promise<void>,
  ): Promise<void> {
    const existing = this.#mutating.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const scheduled = this.#scheduleMutation(mutation);
    this.#mutating.set(key, scheduled);
    const clear = (): void => {
      if (this.#mutating.get(key) === scheduled) {
        this.#mutating.delete(key);
      }
    };
    void scheduled.then(clear, clear);
    return scheduled;
  }

  #applyIfCurrent(chunk: Parameters<World["applyChunk"]>[0]): Promise<void> {
    const key = coordinateKey(chunk.coordinate);
    if (
      this.#destroyed ||
      !this.#targets.has(key) ||
      this.world.renderedChunks.some((item) => coordinateKey(item) === key)
    ) {
      return Promise.resolve();
    }
    let mutationCompleted = false;
    const mutation = this.#trackMutation(key, async () => {
      if (this.#destroyed || !this.#targets.has(key)) {
        return;
      }
      const result =
        this.world.applyChunkAsync !== undefined
          ? await this.world.applyChunkAsync(chunk)
          : this.world.applyChunk(chunk);
      if (result.kind === "failure") {
        this.#recordWorldFailure(chunk.coordinate, "apply", result.reason);
      } else {
        mutationCompleted = true;
        this.#worldFailures.delete(key);
      }
    });
    return mutation.then(() =>
      this.#reconcileAfterMutation(chunk.coordinate, mutationCompleted),
    );
  }

  #removeIfCurrent(coordinate: ChunkCoordinate): Promise<void> {
    const key = coordinateKey(coordinate);
    if (this.#destroyed || this.#targets.has(key)) {
      return Promise.resolve();
    }
    let mutationCompleted = false;
    const mutation = this.#trackMutation(key, async () => {
      if (this.#destroyed || this.#targets.has(key)) {
        return;
      }
      const result =
        this.world.removeChunkAsync !== undefined
          ? await this.world.removeChunkAsync(coordinate)
          : this.world.removeChunk(coordinate);
      if (result.kind === "failure") {
        this.#recordWorldFailure(coordinate, "remove", result.reason);
      } else {
        mutationCompleted = true;
        this.#worldFailures.delete(key);
      }
    });
    return mutation.then(() =>
      this.#reconcileAfterMutation(coordinate, mutationCompleted),
    );
  }

  #reconcileAfterMutation(
    coordinate: ChunkCoordinate,
    mutationCompleted: boolean,
  ): Promise<void> {
    if (this.#destroyed || !mutationCompleted) {
      return Promise.resolve();
    }
    const key = coordinateKey(coordinate);
    const rendered = this.world.renderedChunks.some(
      (item) => coordinateKey(item) === key,
    );
    if (this.#targets.has(key)) {
      if (rendered) {
        return Promise.resolve();
      }
      const cached = this.store.getCached(coordinate);
      return cached === undefined
        ? Promise.resolve()
        : this.#applyIfCurrent(cached);
    }
    return rendered
      ? this.#removeIfCurrent(coordinate)
      : Promise.resolve();
  }

  #recordWorldFailure(
    coordinate: ChunkCoordinate,
    stage: ChunkCoordinatorFailure["stage"],
    reason: string,
  ): void {
    if (this.#destroyed) {
      return;
    }
    this.#worldFailures.set(coordinateKey(coordinate), {
      coordinate: Object.freeze({ ...coordinate }),
      stage,
      reason,
    });
    console.error("chunk world failure", coordinate, stage, reason);
  }
}

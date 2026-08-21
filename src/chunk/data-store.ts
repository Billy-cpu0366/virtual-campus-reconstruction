import { parseChunkMaster, type ChunkMaster } from "./contract.js";
import {
  chunkFileName,
  geometryFromMaster,
  type ChunkCoordinate,
  type ChunkGeometry,
} from "./coordinates.js";
import { LAYER_STRATEGIES } from "../layer/strategy.js";
import type { ChunkLayer, ValidatedChunk } from "../world/contract.js";

export type JsonLoader = (
  url: string,
  signal?: AbortSignal,
) => Promise<unknown>;
export type MasterUrl = string | URL;

export class ChunkDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChunkDataError";
  }
}

export class ChunkRequestAbortedError extends Error {
  constructor() {
    super("chunk request aborted");
    this.name = "AbortError";
  }
}

export function isChunkRequestAbortedError(error: unknown): boolean {
  return (
    error instanceof ChunkRequestAbortedError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

export interface ChunkDataStoreOptions {
  readonly maxAttempts?: number;
}

export interface ChunkLoadFailure {
  readonly coordinate: ChunkCoordinate;
  readonly attempts: number;
  readonly url: string;
  readonly error: Error;
}

function coordinateKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}_${coordinate.y}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesPositiveInteger(
  value: Record<string, unknown>,
  field: string,
  expected: number,
): boolean {
  const candidate = value[field];
  return (
    Number.isInteger(candidate) &&
    (candidate as number) > 0 &&
    candidate === expected
  );
}

function optionalDimension(
  value: Record<string, unknown>,
  field: string,
  expected: number,
): void {
  if (value[field] !== undefined && !matchesPositiveInteger(value, field, expected)) {
    throw new ChunkDataError(`${field} must equal ${expected}`);
  }
}

function parseChunk(
  value: unknown,
  coordinate: ChunkCoordinate,
  master: ChunkMaster,
): ValidatedChunk {
  if (!isRecord(value)) {
    throw new ChunkDataError("chunk must be an object");
  }

  optionalDimension(value, "width", master.chunkWidth);
  optionalDimension(value, "height", master.chunkHeight);
  optionalDimension(value, "tilewidth", master.tileWidth);
  optionalDimension(value, "tileheight", master.tileHeight);

  if (!Array.isArray(value.layers)) {
    throw new ChunkDataError("chunk layers must be an array");
  }
  if (value.layers.length !== LAYER_STRATEGIES.length) {
    throw new ChunkDataError(
      `chunk must contain ${LAYER_STRATEGIES.length} layers`,
    );
  }

  const tileCount = master.chunkWidth * master.chunkHeight;
  const layers: ChunkLayer[] = value.layers.map((rawLayer, index) => {
    if (!isRecord(rawLayer)) {
      throw new ChunkDataError(`layer ${index} must be an object`);
    }
    const strategy = LAYER_STRATEGIES[index];
    if (strategy === undefined || rawLayer.name !== strategy.name) {
      throw new ChunkDataError(`layer ${index} name does not match strategy`);
    }
    optionalDimension(rawLayer, "width", master.chunkWidth);
    optionalDimension(rawLayer, "height", master.chunkHeight);
    if (!Array.isArray(rawLayer.data) || rawLayer.data.length !== tileCount) {
      throw new ChunkDataError(
        `layer ${strategy.name} data must contain ${tileCount} values`,
      );
    }
    if (!rawLayer.data.every((entry) => Number.isInteger(entry))) {
      throw new ChunkDataError(`layer ${strategy.name} data must be integers`);
    }

    return Object.freeze({
      name: strategy.name,
      data: Object.freeze([...rawLayer.data] as number[]),
    });
  });

  return Object.freeze({
    coordinate: Object.freeze({ x: coordinate.x, y: coordinate.y }),
    layers: Object.freeze(layers),
  });
}

function resolveRelativeUrl(masterUrl: MasterUrl, fileName: string): string {
  const source = typeof masterUrl === "string" ? masterUrl : masterUrl.href;
  try {
    return new URL(fileName, source).toString();
  } catch {
    const resolved = new URL(fileName, new URL(source, "https://chunk.invalid/"));
    return `${resolved.pathname.replace(/^\//, "")}${resolved.search}`;
  }
}

function assertAttempts(attempts: number): void {
  if (!Number.isInteger(attempts) || attempts <= 0) {
    throw new RangeError("attempts must be a positive integer");
  }
}

function sortCoordinates(
  coordinates: Iterable<ChunkCoordinate>,
): readonly ChunkCoordinate[] {
  return [...coordinates]
    .map((coordinate) => Object.freeze({ x: coordinate.x, y: coordinate.y }))
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

export class ChunkDataStore {
  readonly masterUrl: string;
  readonly maxAttempts: number;
  #loader: JsonLoader;
  #master: ChunkMaster | undefined;
  #masterError: Error | undefined;
  #masterRequest: Promise<ChunkMaster> | undefined;
  #cache = new Map<string, ValidatedChunk>();
  #inFlight = new Map<string, Promise<ValidatedChunk>>();
  #failures = new Map<string, ChunkLoadFailure>();
  #destroyed = false;
  #abortController = new AbortController();

  constructor(
    masterUrl: MasterUrl,
    loader: JsonLoader,
    options: ChunkDataStoreOptions = {},
  ) {
    this.masterUrl = typeof masterUrl === "string" ? masterUrl : masterUrl.href;
    this.#loader = loader;
    this.maxAttempts = options.maxAttempts ?? 3;
    assertAttempts(this.maxAttempts);
  }

  get destroyed(): boolean {
    return this.#destroyed;
  }

  get master(): ChunkMaster | undefined {
    return this.#master;
  }

  get geometry(): ChunkGeometry | undefined {
    return this.#master === undefined
      ? undefined
      : geometryFromMaster(this.#master);
  }

  get cachedChunks(): readonly ChunkCoordinate[] {
    return sortCoordinates([...this.#cache.values()].map((chunk) => chunk.coordinate));
  }

  get failures(): readonly ChunkLoadFailure[] {
    return [...this.#failures.values()].map((failure) => ({
      ...failure,
      coordinate: Object.freeze({ ...failure.coordinate }),
    }));
  }

  async loadMaster(forceRetry = false): Promise<ChunkMaster> {
    this.#throwIfDestroyed();
    if (this.#master !== undefined) {
      return this.#master;
    }
    if (this.#masterError !== undefined && !forceRetry) {
      throw this.#masterError;
    }
    if (this.#masterRequest !== undefined) {
      return this.#masterRequest;
    }

    if (forceRetry) {
      this.#masterError = undefined;
    }
    const request = Promise.resolve()
      .then(() => {
        this.#throwIfDestroyed();
        return this.#loader(this.masterUrl, this.#abortController.signal);
      })
      .then((value) => {
        this.#throwIfDestroyed();
        const master = parseChunkMaster(value);
        this.#master = master;
        this.#masterError = undefined;
        return master;
      })
      .catch((error: unknown) => {
        if (this.#destroyed || isChunkRequestAbortedError(error)) {
          throw new ChunkRequestAbortedError();
        }
        const normalized = asError(error);
        this.#masterError = normalized;
        throw normalized;
      });
    this.#masterRequest = request;
    try {
      return await request;
    } finally {
      if (this.#masterRequest === request) {
        this.#masterRequest = undefined;
      }
    }
  }

  get masterFailure(): Error | undefined {
    return this.#masterError;
  }

  retryMaster(): Promise<ChunkMaster> {
    return this.loadMaster(true);
  }

  destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#abortController.abort();
    this.#master = undefined;
    this.#masterError = undefined;
    this.#masterRequest = undefined;
    this.#cache.clear();
    this.#inFlight.clear();
    this.#failures.clear();
  }

  hasCached(coordinate: ChunkCoordinate): boolean {
    return this.#cache.has(coordinateKey(coordinate));
  }

  getCached(coordinate: ChunkCoordinate): ValidatedChunk | undefined {
    return this.#cache.get(coordinateKey(coordinate));
  }

  getFailure(coordinate: ChunkCoordinate): ChunkLoadFailure | undefined {
    const failure = this.#failures.get(coordinateKey(coordinate));
    return failure === undefined
      ? undefined
      : { ...failure, coordinate: Object.freeze({ ...failure.coordinate }) };
  }

  loadChunk(coordinate: ChunkCoordinate): Promise<ValidatedChunk> {
    return this.#requestChunk(coordinate, this.maxAttempts, false);
  }

  retryChunk(
    coordinate: ChunkCoordinate,
    attempts = this.maxAttempts,
  ): Promise<ValidatedChunk> {
    assertAttempts(attempts);
    return this.#requestChunk(coordinate, attempts, true);
  }

  #requestChunk(
    coordinate: ChunkCoordinate,
    attempts: number,
    allowRetry: boolean,
  ): Promise<ValidatedChunk> {
    if (this.#destroyed) {
      return Promise.reject(new ChunkRequestAbortedError());
    }
    const key = coordinateKey(coordinate);
    const cached = this.#cache.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    const existing = this.#inFlight.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const previousFailure = this.#failures.get(key);
    if (previousFailure !== undefined && !allowRetry) {
      return Promise.reject(previousFailure.error);
    }

    const request = this.#loadChunk(coordinate, attempts, allowRetry);
    this.#inFlight.set(key, request);
    void request.then(
      () => {
        if (this.#inFlight.get(key) === request) {
          this.#inFlight.delete(key);
        }
      },
      () => {
        if (this.#inFlight.get(key) === request) {
          this.#inFlight.delete(key);
        }
      },
    );
    return request;
  }

  async #loadChunk(
    coordinate: ChunkCoordinate,
    attempts: number,
    forceMasterRetry: boolean,
  ): Promise<ValidatedChunk> {
    assertAttempts(attempts);
    this.#throwIfDestroyed();
    if (
      !Number.isInteger(coordinate.x) ||
      !Number.isInteger(coordinate.y) ||
      coordinate.x < 0 ||
      coordinate.y < 0
    ) {
      const error = new ChunkDataError("chunk coordinate is outside the grid");
      this.#recordFailure(coordinate, "", 0, error);
      throw error;
    }

    let master: ChunkMaster | undefined;
    let masterError: Error | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        master = await this.loadMaster(forceMasterRetry || attempt > 1);
        break;
      } catch (error) {
        if (this.#destroyed || isChunkRequestAbortedError(error)) {
          throw new ChunkRequestAbortedError();
        }
        masterError = asError(error);
      }
    }
    if (master === undefined) {
      const previous = this.#failures.get(coordinateKey(coordinate));
      const failure = masterError ?? new Error("master load failed");
      this.#recordFailure(
        coordinate,
        this.masterUrl,
        (previous?.attempts ?? 0) + attempts,
        failure,
      );
      throw failure;
    }

    const geometry = geometryFromMaster(master);
    if (
      coordinate.x >= geometry.chunksHorizontal ||
      coordinate.y >= geometry.chunksVertical
    ) {
      const error = new ChunkDataError("chunk coordinate is outside the grid");
      this.#recordFailure(coordinate, "", 0, error);
      throw error;
    }

    const index = coordinate.y * geometry.chunksHorizontal + coordinate.x;
    const url = resolveRelativeUrl(this.masterUrl, `chunk${index}.json`);
    let lastError = new Error("chunk load failed");
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const raw = await this.#loader(url, this.#abortController.signal);
        this.#throwIfDestroyed();
        const chunk = parseChunk(raw, coordinate, master);
        this.#throwIfDestroyed();
        this.#cache.set(coordinateKey(coordinate), chunk);
        this.#failures.delete(coordinateKey(coordinate));
        return chunk;
      } catch (error) {
        if (this.#destroyed || isChunkRequestAbortedError(error)) {
          throw new ChunkRequestAbortedError();
        }
        lastError = asError(error);
      }
    }

    const previous = this.#failures.get(coordinateKey(coordinate));
    this.#recordFailure(
      coordinate,
      url,
      (previous?.attempts ?? 0) + attempts,
      lastError,
    );
    throw lastError;
  }

  #recordFailure(
    coordinate: ChunkCoordinate,
    url: string,
    attempts: number,
    error: Error,
  ): void {
    if (this.#destroyed || isChunkRequestAbortedError(error)) {
      return;
    }
    this.#failures.set(coordinateKey(coordinate), {
      coordinate: Object.freeze({ x: coordinate.x, y: coordinate.y }),
      attempts,
      url,
      error,
    });
  }

  #throwIfDestroyed(): void {
    if (this.#destroyed || this.#abortController.signal.aborted) {
      throw new ChunkRequestAbortedError();
    }
  }
}

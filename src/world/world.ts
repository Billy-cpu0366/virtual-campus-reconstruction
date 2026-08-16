import type { ChunkCoordinate } from "../chunk/coordinates.js";
import type { LayerStrategy } from "../layer/contract.js";
import { LAYER_STRATEGIES } from "../layer/strategy.js";
import { validateChunk, validateCoordinate } from "./chunk.js";
import { validateWorldSpec } from "./spec.js";
import type {
  ApplyResult,
  CreateWorldOptions,
  RemoveResult,
  ValidatedChunk,
  World,
  WorldCreateResult,
  WorldLifecycle,
  WorldSpec,
  WorldWriteHooks,
} from "./contract.js";

function coordinateKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}_${coordinate.y}`;
}

// 图层计划结构有效性：非空且层名唯一。24 层的语义完整性由 SYS-LAYER 的 LAYER_STRATEGIES 保证；
// 世界不自行硬编码层名或层数（SYS-WORLD 卡：世界只消费，不硬编码语义）。
function isWellFormedLayerPlan(plan: readonly LayerStrategy[]): boolean {
  if (plan.length === 0) {
    return false;
  }
  const seen = new Set<string>();
  for (const strategy of plan) {
    if (strategy.name.length === 0 || seen.has(strategy.name)) {
      return false;
    }
    seen.add(strategy.name);
  }
  return true;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

class WorldImpl implements World {
  readonly spec: WorldSpec;
  #state: WorldLifecycle = "ready";
  #rendered = new Map<string, ChunkCoordinate>();
  #layerPlan: readonly LayerStrategy[];
  #hooks: WorldWriteHooks;

  constructor(
    spec: WorldSpec,
    layerPlan: readonly LayerStrategy[],
    hooks: WorldWriteHooks,
  ) {
    this.spec = spec;
    this.#layerPlan = layerPlan;
    this.#hooks = hooks;
  }

  get state(): WorldLifecycle {
    return this.#state;
  }

  get renderedChunks(): readonly ChunkCoordinate[] {
    return [...this.#rendered.values()].sort(
      (left, right) => left.y - right.y || left.x - right.x,
    );
  }

  applyChunk(chunk: ValidatedChunk): ApplyResult {
    if (this.#state !== "ready") {
      return { kind: "failure", reason: "世界未就绪，拒绝写入" };
    }

    let validated: ValidatedChunk;
    try {
      validated = validateChunk(chunk, this.spec, this.#layerPlan);
    } catch (error) {
      return { kind: "failure", reason: errorMessage(error) };
    }

    const key = coordinateKey(validated.coordinate);
    if (this.#rendered.has(key)) {
      return { kind: "already-applied" };
    }

    // 原子写入：24 层全部成功才登记；任一层失败回滚本次已写层，不登记。
    const written: string[] = [];
    try {
      for (const layer of validated.layers) {
        this.#hooks.writeLayer?.(layer.name, validated.coordinate);
        written.push(layer.name);
      }
    } catch (error) {
      for (const name of written) {
        try {
          this.#hooks.clearLayer?.(name, validated.coordinate);
        } catch {
          // 回滚尽力而为，不覆盖原始失败原因。
        }
      }
      return { kind: "failure", reason: errorMessage(error) };
    }

    this.#rendered.set(key, validated.coordinate);
    return { kind: "applied" };
  }

  removeChunk(coordinate: ChunkCoordinate): RemoveResult {
    if (this.#state !== "ready") {
      return { kind: "failure", reason: "世界未就绪，拒绝清除" };
    }

    try {
      validateCoordinate(coordinate, this.spec);
    } catch (error) {
      return { kind: "failure", reason: errorMessage(error) };
    }

    const key = coordinateKey(coordinate);
    if (!this.#rendered.has(key)) {
      return { kind: "already-absent" };
    }

    // 按显式策略清除全部 24 层（不复制发布 Bundle 只清 11 层的遗漏行为）。
    // 与 applyChunk 对称：任一层清除失败则回滚本次已清层，仍登记、不半清。
    const cleared: string[] = [];
    try {
      for (const layer of this.#layerPlan) {
        this.#hooks.clearLayer?.(layer.name, coordinate);
        cleared.push(layer.name);
      }
    } catch (error) {
      for (const name of cleared) {
        try {
          this.#hooks.writeLayer?.(name, coordinate);
        } catch {
          // 回滚尽力而为，不覆盖原始失败原因。
        }
      }
      return { kind: "failure", reason: errorMessage(error) };
    }

    this.#rendered.delete(key);
    return { kind: "removed" };
  }

  destroy(): void {
    if (this.#state === "destroyed") {
      return;
    }
    this.#state = "destroying";
    this.#rendered.clear();
    this.#state = "destroyed";
  }
}

// 建世界工厂：规格 + 图层计划校验全部通过才发布 ready 世界；否则返回 failure。
export function createWorld(
  spec: WorldSpec,
  options: CreateWorldOptions = {},
): WorldCreateResult {
  let validSpec: WorldSpec;
  try {
    validSpec = validateWorldSpec(spec);
  } catch (error) {
    return { kind: "failure", reason: errorMessage(error) };
  }

  const layerPlan = options.layerPlan ?? LAYER_STRATEGIES;
  if (!isWellFormedLayerPlan(layerPlan)) {
    return { kind: "failure", reason: "图层策略不完整（为空或层名重复）" };
  }

  return {
    kind: "ready",
    world: new WorldImpl(validSpec, layerPlan, options.hooks ?? {}),
  };
}

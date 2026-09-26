import { isWalkable } from "../move/walls.js";
import type {
  RouteCrowdPathProvider,
  RouteCrowdPathRequest,
  RouteCrowdPathResult,
  RouteCrowdTile,
} from "./routeCrowd.js";

const key = (point: RouteCrowdTile) => `${point.x},${point.y}`;

/** 一条走法：往哪偏几格、代价多少。 */
export interface GridRouteCrowdDirection {
  readonly dx: number;
  readonly dy: number;
  readonly cost: number;
}

/**
 * 寻路的四项可改值，全部来自 `path-tuning.json`。
 *
 * 四项都**必须**由调用方递进来：少给一项就编译不过。这样改配置的人不会被
 * 「代码里还留着一份旧值」骗到。
 */
export interface GridRouteCrowdPathProviderOptions {
  /** 一格多少像素。它同时是格坐标和像素坐标之间的换算基准，通常不该动。 */
  readonly tileSize: number;
  /**
   * 一次 findPath 最多算多少步，算不完就留到下一帧接着算。
   * 写太小开场要多等几帧；写太大开场会卡一下。
   */
  readonly iterationsPerStep: number;
  /** 单条路径最多算多少步，超了就放弃这条路径。 */
  readonly maxIterations: number;
  /** 八个走法方向和各自的代价。改它等于改寻路形状，不是调参。 */
  readonly directions: readonly GridRouteCrowdDirection[];
  readonly isBlocked?: (point: RouteCrowdTile) => boolean;
}

type OpenNode = { point: RouteCrowdTile; priority: number; order: number };
class MinHeap {
  private readonly items: OpenNode[] = [];
  get size(): number { return this.items.length; }
  push(node: OpenNode): void {
    this.items.push(node);
    for (let index = this.items.length - 1; index > 0;) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.less(this.items[index]!, this.items[parent]!)) break;
      [this.items[index], this.items[parent]] = [this.items[parent]!, this.items[index]!];
      index = parent;
    }
  }
  pop(): OpenNode | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    if (first === undefined || last === undefined) return first;
    if (this.items.length > 0) {
      this.items[0] = last;
      for (let index = 0;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.less(this.items[left]!, this.items[smallest]!)) smallest = left;
        if (right < this.items.length && this.less(this.items[right]!, this.items[smallest]!)) smallest = right;
        if (smallest === index) break;
        [this.items[index], this.items[smallest]] = [this.items[smallest]!, this.items[index]!];
        index = smallest;
      }
    }
    return first;
  }
  private less(left: OpenNode, right: OpenNode): boolean {
    return left.priority < right.priority ||
      (left.priority === right.priority && left.order < right.order);
  }
}

type PathJob = {
  readonly id: string;
  readonly start: RouteCrowdTile;
  readonly goal: RouteCrowdTile;
  readonly open: MinHeap;
  readonly closed: Set<string>;
  readonly cameFrom: Map<string, string>;
  readonly scores: Map<string, number>;
  readonly randomFactor: number;
  readonly ignoreWalls: boolean;
  readonly allowConfiguredEndpoints: boolean;
  readonly isBlocked: ((point: RouteCrowdTile) => boolean) | undefined;
  seed: number;
  order: number;
  iterations: number;
};

const heuristic = (a: RouteCrowdTile, b: RouteCrowdTile): number => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + .41 * Math.min(dx, dy);
};

const nearestWalkable = (
  grid: readonly (readonly number[])[],
  point: RouteCrowdTile,
  tileSize: number,
  isBlocked?: (point: RouteCrowdTile) => boolean,
  maxRadius = 4,
): RouteCrowdTile | undefined => {
  const worldCenter = (tile: RouteCrowdTile): RouteCrowdTile => ({
    x: tile.x * tileSize + tileSize / 2,
    y: tile.y * tileSize + tileSize / 2,
  });
  if (isWalkable(grid, point.x, point.y) &&
    !isBlocked?.(worldCenter(point))) return point;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    const candidates: RouteCrowdTile[] = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate = { x: point.x + dx, y: point.y + dy };
        if (isWalkable(grid, candidate.x, candidate.y) &&
          !isBlocked?.(worldCenter(candidate))) candidates.push(candidate);
      }
    }
    candidates.sort((left, right) =>
      (left.x - point.x) ** 2 + (left.y - point.y) ** 2 -
        ((right.x - point.x) ** 2 + (right.y - point.y) ** 2) ||
      left.y - right.y || left.x - right.x,
    );
    if (candidates[0] !== undefined) return candidates[0];
  }
  return undefined;
};

/** Source-aligned seeded A* split into bounded main-thread steps. */
export class GridRouteCrowdPathProvider implements RouteCrowdPathProvider {
  private readonly jobs = new Map<string, PathJob>();

  constructor(
    private readonly grid: readonly (readonly number[])[],
    private readonly options: GridRouteCrowdPathProviderOptions,
  ) {}

  private get tileSize(): number {
    return this.options.tileSize;
  }

  private get isBlocked(): ((point: RouteCrowdTile) => boolean) | undefined {
    return this.options.isBlocked;
  }

  findPath(request: RouteCrowdPathRequest): RouteCrowdPathResult {
    const id = [
      request.start.x, request.start.y, request.end.x, request.end.y,
      request.randomSeed ?? 0, request.randomFactor ?? 0,
      request.ignoreWalls === true ? 1 : 0,
      request.allowBlockedEndpoints === true ? 1 : 0,
    ].join(":");
    let job = this.jobs.get(id);
    if (job === undefined) {
      job = this.createJob(id, request);
      if (job === undefined) return null;
      this.jobs.set(id, job);
    }

    for (
      let step = 0;
      step < this.options.iterationsPerStep && job.open.size > 0;
      step += 1
    ) {
      job.iterations += 1;
      if (job.iterations > this.options.maxIterations) break;
      const current = job.open.pop()!.point;
      const currentKey = key(current);
      if (job.closed.has(currentKey)) continue;
      if (currentKey === key(job.goal)) {
        const path = this.reconstruct(job);
        this.jobs.delete(id);
        return path;
      }
      job.closed.add(currentKey);
      for (const direction of this.options.directions) {
        const next = { x: current.x + direction.dx, y: current.y + direction.dy };
        const nextKey = key(next);
        const isGoal = nextKey === key(job.goal);
        const nextWorld = {
          x: next.x * this.tileSize + this.tileSize / 2,
          y: next.y * this.tileSize + this.tileSize / 2,
        };
        const walkable = job.ignoreWalls || isWalkable(this.grid, next.x, next.y) ||
          (isGoal && job.allowConfiguredEndpoints);
        const blocked = !job.ignoreWalls && job.isBlocked?.(nextWorld) === true;
        if (!walkable || blocked || job.closed.has(nextKey)) continue;
        if (
          !job.ignoreWalls && direction.dx !== 0 && direction.dy !== 0 &&
          (!isWalkable(this.grid, current.x + direction.dx, current.y) ||
            !isWalkable(this.grid, current.x, current.y + direction.dy) ||
            job.isBlocked?.({
              x: (current.x + direction.dx) * this.tileSize + this.tileSize / 2,
              y: current.y * this.tileSize + this.tileSize / 2,
            }) === true ||
            job.isBlocked?.({
              x: current.x * this.tileSize + this.tileSize / 2,
              y: (current.y + direction.dy) * this.tileSize + this.tileSize / 2,
            }) === true)
        ) continue;
        job.seed = (job.seed * 1_664_525 + 1_013_904_223) >>> 0;
        const noise = job.randomFactor > 0 ? job.seed / 2 ** 32 * job.randomFactor : 0;
        const score = job.scores.get(currentKey)! + direction.cost + noise;
        if (score >= (job.scores.get(nextKey) ?? Infinity)) continue;
        job.cameFrom.set(nextKey, currentKey);
        job.scores.set(nextKey, score);
        job.open.push({
          point: next,
          priority: score + heuristic(next, job.goal),
          order: job.order++,
        });
      }
    }
    if (job.open.size > 0 && job.iterations <= this.options.maxIterations) {
      return undefined;
    }
    this.jobs.delete(id);
    return null;
  }

  private createJob(id: string, request: RouteCrowdPathRequest): PathJob | undefined {
    const requestedStart = {
      x: Math.floor(request.start.x / this.tileSize),
      y: Math.floor(request.start.y / this.tileSize),
    };
    const requestedGoal = {
      x: Math.floor(request.end.x / this.tileSize),
      y: Math.floor(request.end.y / this.tileSize),
    };
    const ignoreWalls = request.ignoreWalls === true;
    const allowConfiguredEndpoints = request.allowBlockedEndpoints === true;
    const start = ignoreWalls || (
      isWalkable(this.grid, requestedStart.x, requestedStart.y) &&
      this.isBlocked?.({
        x: requestedStart.x * this.tileSize + this.tileSize / 2,
        y: requestedStart.y * this.tileSize + this.tileSize / 2,
      }) !== true
    )
      ? requestedStart
      : allowConfiguredEndpoints
        ? nearestWalkable(this.grid, requestedStart, this.tileSize, this.isBlocked)
        : undefined;
    const goal = ignoreWalls || (
      isWalkable(this.grid, requestedGoal.x, requestedGoal.y) &&
      this.isBlocked?.({
        x: requestedGoal.x * this.tileSize + this.tileSize / 2,
        y: requestedGoal.y * this.tileSize + this.tileSize / 2,
      }) !== true
    )
      ? requestedGoal
      : allowConfiguredEndpoints
        ? nearestWalkable(this.grid, requestedGoal, this.tileSize, this.isBlocked)
        : undefined;
    if (start === undefined || goal === undefined) return undefined;
    const open = new MinHeap();
    open.push({ point: start, priority: heuristic(start, goal), order: 0 });
    return {
      id, start, goal, open,
      closed: new Set(),
      cameFrom: new Map(),
      scores: new Map([[key(start), 0]]),
      randomFactor: request.randomFactor ?? 0,
      ignoreWalls,
      allowConfiguredEndpoints,
      isBlocked: this.isBlocked,
      seed: request.randomSeed || 12345,
      order: 1,
      iterations: 0,
    };
  }

  private reconstruct(job: PathJob): readonly RouteCrowdTile[] {
    const path: RouteCrowdTile[] = [];
    let cursor: string | undefined = key(job.goal);
    while (cursor !== undefined) {
      const [x, y] = cursor.split(",").map(Number);
      path.unshift({
        x: x! * this.tileSize + this.tileSize / 2,
        y: y! * this.tileSize + this.tileSize / 2,
      });
      cursor = job.cameFrom.get(cursor);
    }
    return path;
  }
}

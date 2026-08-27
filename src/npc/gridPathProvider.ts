import { isWalkable } from "../move/walls.js";
import type {
  RouteCrowdPathProvider,
  RouteCrowdPathRequest,
  RouteCrowdPathResult,
  RouteCrowdTile,
} from "./routeCrowd.js";

const TILE_SIZE = 16;
const ITERATIONS_PER_STEP = 512;
const key = (point: RouteCrowdTile) => `${point.x},${point.y}`;
const DIRECTIONS = Object.freeze([
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 1, dy: -1, cost: 1.41 },
  { dx: 1, dy: 1, cost: 1.41 },
  { dx: -1, dy: 1, cost: 1.41 },
  { dx: -1, dy: -1, cost: 1.41 },
]);

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
  isBlocked?: (point: RouteCrowdTile) => boolean,
  maxRadius = 4,
): RouteCrowdTile | undefined => {
  const worldCenter = (tile: RouteCrowdTile): RouteCrowdTile => ({
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2,
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
    private readonly isBlocked?: (point: RouteCrowdTile) => boolean,
  ) {}

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

    for (let step = 0; step < ITERATIONS_PER_STEP && job.open.size > 0; step += 1) {
      job.iterations += 1;
      if (job.iterations > 50_000) break;
      const current = job.open.pop()!.point;
      const currentKey = key(current);
      if (job.closed.has(currentKey)) continue;
      if (currentKey === key(job.goal)) {
        const path = this.reconstruct(job);
        this.jobs.delete(id);
        return path;
      }
      job.closed.add(currentKey);
      for (const direction of DIRECTIONS) {
        const next = { x: current.x + direction.dx, y: current.y + direction.dy };
        const nextKey = key(next);
        const isGoal = nextKey === key(job.goal);
        const nextWorld = {
          x: next.x * TILE_SIZE + TILE_SIZE / 2,
          y: next.y * TILE_SIZE + TILE_SIZE / 2,
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
              x: (current.x + direction.dx) * TILE_SIZE + TILE_SIZE / 2,
              y: current.y * TILE_SIZE + TILE_SIZE / 2,
            }) === true ||
            job.isBlocked?.({
              x: current.x * TILE_SIZE + TILE_SIZE / 2,
              y: (current.y + direction.dy) * TILE_SIZE + TILE_SIZE / 2,
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
    if (job.open.size > 0 && job.iterations <= 50_000) return undefined;
    this.jobs.delete(id);
    return null;
  }

  private createJob(id: string, request: RouteCrowdPathRequest): PathJob | undefined {
    const requestedStart = {
      x: Math.floor(request.start.x / TILE_SIZE),
      y: Math.floor(request.start.y / TILE_SIZE),
    };
    const requestedGoal = {
      x: Math.floor(request.end.x / TILE_SIZE),
      y: Math.floor(request.end.y / TILE_SIZE),
    };
    const ignoreWalls = request.ignoreWalls === true;
    const allowConfiguredEndpoints = request.allowBlockedEndpoints === true;
    const start = ignoreWalls || (
      isWalkable(this.grid, requestedStart.x, requestedStart.y) &&
      this.isBlocked?.({
        x: requestedStart.x * TILE_SIZE + TILE_SIZE / 2,
        y: requestedStart.y * TILE_SIZE + TILE_SIZE / 2,
      }) !== true
    )
      ? requestedStart
      : allowConfiguredEndpoints
        ? nearestWalkable(this.grid, requestedStart, this.isBlocked)
        : undefined;
    const goal = ignoreWalls || (
      isWalkable(this.grid, requestedGoal.x, requestedGoal.y) &&
      this.isBlocked?.({
        x: requestedGoal.x * TILE_SIZE + TILE_SIZE / 2,
        y: requestedGoal.y * TILE_SIZE + TILE_SIZE / 2,
      }) !== true
    )
      ? requestedGoal
      : allowConfiguredEndpoints
        ? nearestWalkable(this.grid, requestedGoal, this.isBlocked)
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
      path.unshift({ x: x! * TILE_SIZE + 8, y: y! * TILE_SIZE + 8 });
      cursor = job.cameFrom.get(cursor);
    }
    return path;
  }
}

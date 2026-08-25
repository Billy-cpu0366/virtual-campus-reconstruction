import { isWalkable } from "../move/walls.js";
import type { RouteCrowdPathProvider, RouteCrowdPathRequest, RouteCrowdTile } from "./routeCrowd.js";

const TILE_SIZE = 16;
const key = (p: RouteCrowdTile) => `${p.x},${p.y}`;

/** Bounded 8-way grid path provider matching the public EasyStar fallback. */
export class GridRouteCrowdPathProvider implements RouteCrowdPathProvider {
  constructor(private readonly grid: readonly (readonly number[])[]) {}
  findPath(request: RouteCrowdPathRequest): readonly RouteCrowdTile[] | null {
    const start = { x: Math.floor(request.start.x / TILE_SIZE), y: Math.floor(request.start.y / TILE_SIZE) };
    const goal = { x: Math.floor(request.end.x / TILE_SIZE), y: Math.floor(request.end.y / TILE_SIZE) };
    // Public worker rejects blocked starts and endpoints unless the route group
    // explicitly requests ignoreWalls (handled by its own provider path).
    if (!isWalkable(this.grid, start.x, start.y) || !isWalkable(this.grid, goal.x, goal.y)) return null;
    const queue = [start]; const previous = new Map<string, RouteCrowdTile>();
    let seed = request.randomSeed ?? 1;
    const random = () => { seed = (seed * 1_664_525 + 1_013_904_223) >>> 0; return seed / 2 ** 32; };
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      if (current.x === goal.x && current.y === goal.y) {
        const path: RouteCrowdTile[] = [goal]; let node = goal;
        while (key(node) !== key(start)) { const parent = previous.get(key(node)); if (!parent) return null; path.push(parent); node = parent; }
        return path.reverse().map((tile) => ({ x: tile.x * TILE_SIZE + 8, y: tile.y * TILE_SIZE + 8 }));
      }
      const directions: [number, number][] = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ];
      if ((request.randomFactor ?? 0) > 0) directions.sort(() => random() - .5);
      for (const [dx, dy] of directions) {
        const next = { x: current.x + dx, y: current.y + dy };
        const nextKey = key(next);
        const isGoal = nextKey === key(goal);
        const diagonal = dx !== 0 && dy !== 0;
        const cutsBlockedCorner = diagonal &&
          (!isWalkable(this.grid, current.x + dx, current.y) ||
            !isWalkable(this.grid, current.x, current.y + dy));
        if (
          isWalkable(this.grid, next.x, next.y) &&
          !cutsBlockedCorner &&
          !previous.has(nextKey) &&
          nextKey !== key(start)
        ) {
          previous.set(nextKey, current);
          queue.push(next);
        }
      }
    }
    return null;
  }
}

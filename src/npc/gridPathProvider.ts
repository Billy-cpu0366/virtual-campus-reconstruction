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
    // The public manager passes its configured endpoints directly to the
    // worker, including tiles marked blocked in walls-layer. Keep endpoints as
    // legal path terminals while requiring every intermediate tile to be walkable.
    const queue = [start]; const previous = new Map<string, RouteCrowdTile>();
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      if (current.x === goal.x && current.y === goal.y) {
        const path: RouteCrowdTile[] = [goal]; let node = goal;
        while (key(node) !== key(start)) { const parent = previous.get(key(node)); if (!parent) return null; path.push(parent); node = parent; }
        return path.reverse().map((tile) => ({ x: tile.x * TILE_SIZE + 8, y: tile.y * TILE_SIZE + 8 }));
      }
      for (const [dx, dy] of [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ] as const) {
        const next = { x: current.x + dx, y: current.y + dy };
        const nextKey = key(next);
        const isGoal = nextKey === key(goal);
        if (
          (isGoal || isWalkable(this.grid, next.x, next.y)) &&
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

import { isWalkable } from "../move/walls.js";
import type { RouteCrowdPathProvider, RouteCrowdPathRequest, RouteCrowdTile } from "./routeCrowd.js";

const TILE_SIZE = 16;
const key = (p: RouteCrowdTile) => `${p.x},${p.y}`;

/** Bounded 4-way grid path provider for public walls-layer data. */
export class GridRouteCrowdPathProvider implements RouteCrowdPathProvider {
  constructor(private readonly grid: readonly (readonly number[])[]) {}
  findPath(request: RouteCrowdPathRequest): readonly RouteCrowdTile[] | null {
    const start = { x: Math.floor(request.start.x / TILE_SIZE), y: Math.floor(request.start.y / TILE_SIZE) };
    const goal = { x: Math.floor(request.end.x / TILE_SIZE), y: Math.floor(request.end.y / TILE_SIZE) };
    if (!isWalkable(this.grid, start.x, start.y) || !isWalkable(this.grid, goal.x, goal.y)) return null;
    const queue = [start]; const previous = new Map<string, RouteCrowdTile>();
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      if (current.x === goal.x && current.y === goal.y) {
        const path: RouteCrowdTile[] = [goal]; let node = goal;
        while (key(node) !== key(start)) { const parent = previous.get(key(node)); if (!parent) return null; path.push(parent); node = parent; }
        return path.reverse().map((tile) => ({ x: tile.x * TILE_SIZE + 8, y: tile.y * TILE_SIZE + 8 }));
      }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        const next = { x: current.x + dx, y: current.y + dy };
        if (isWalkable(this.grid, next.x, next.y) && !previous.has(key(next)) && key(next) !== key(start)) { previous.set(key(next), current); queue.push(next); }
      }
    }
    return null;
  }
}

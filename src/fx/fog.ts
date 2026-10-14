export const FOG_ORANGE_SMOKE_ID = "orange_smoke";
export const FOG_ORANGE_SMOKE_REGION = 75;
export const FOG_ORANGE_SMOKE_ASSET_KEY = "particle_smoke_white";

export interface FogPoint {
  readonly x: number;
  readonly y: number;
}

export interface FogCell {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface FogViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FogPlayerInput extends FogPoint {
  readonly velocityX?: number;
  readonly velocityY?: number;
  readonly direction?: number;
}

export interface FogCellSnapshot extends FogCell {
  readonly active: boolean;
  readonly cleared: boolean;
  readonly respawnAt: number | null;
}

export interface FogSnapshot {
  readonly state: "idle" | "active" | "shutdown";
  readonly region: typeof FOG_ORANGE_SMOKE_ID;
  readonly regionNumber: typeof FOG_ORANGE_SMOKE_REGION;
  readonly cells: readonly FogCellSnapshot[];
  readonly viewport: FogViewport | null;
  readonly carsInputIntegrated: boolean;
}

function pointInPolygon(point: FogPoint, polygon: readonly FogPoint[]): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    if (current === undefined || next === undefined) continue;
    if (
      (current.y > point.y) !== (next.y > point.y) &&
      point.x <
        ((next.x - current.x) * (point.y - current.y)) /
          (next.y - current.y) +
          current.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function createCells(
  polygon: readonly FogPoint[],
  cellSize: number,
  regionId: string,
): FogCell[] {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cells: FogCell[] = [];
  const firstColumn = Math.floor(minX / cellSize);
  const lastColumn = Math.ceil(maxX / cellSize);
  const firstRow = Math.floor(minY / cellSize);
  const lastRow = Math.ceil(maxY / cellSize);
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const x = column * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      if (pointInPolygon({ x, y }, polygon)) {
        cells.push({ id: `${regionId}:${cells.length}`, x, y });
      }
    }
  }
  return cells;
}

function inViewport(cell: FogCell, viewport: FogViewport, padding: number): boolean {
  return (
    cell.x >= viewport.left - padding &&
    cell.x <= viewport.left + viewport.width + padding &&
    cell.y >= viewport.top - padding &&
    cell.y <= viewport.top + viewport.height + padding
  );
}

function cellKey(cell: FogPoint): string {
  return `${cell.x}:${cell.y}`;
}

interface FogCellState extends FogCell {
  active: boolean;
  cleared: boolean;
  respawnAt: number | null;
}

/** Core state owner for the S1 orange trajectory fog region. */
export class FogRuntime {
  private readonly cellStates: FogCellState[];
  private stateState: FogSnapshot["state"] = "idle";
  private viewportState: FogViewport | null = null;
  private lastDirection = Math.PI / 2;

  constructor(
    private readonly carsInputIntegrated: boolean,
    private readonly config: Readonly<{
      polygon: readonly FogPoint[];
      cellSize: number;
      viewportPadding: number;
      clearAhead: number;
      clearWidth: number;
      clearHeight: number;
      carClearRadius: number;
      respawnMs: number;
    }>,
  ) {
    this.cellStates = createCells(config.polygon, config.cellSize, FOG_ORANGE_SMOKE_ID)
      .map((cell) => ({ ...cell, active: false, cleared: false, respawnAt: null }));
  }

  get snapshot(): FogSnapshot {
    return Object.freeze({
      state: this.stateState,
      region: FOG_ORANGE_SMOKE_ID,
      regionNumber: FOG_ORANGE_SMOKE_REGION,
      cells: Object.freeze(
        this.cellStates.map((cell) => Object.freeze({ ...cell })),
      ),
      viewport: this.viewportState,
      carsInputIntegrated: this.carsInputIntegrated,
    });
  }

  start(viewport?: FogViewport): FogSnapshot {
    if (this.stateState === "shutdown") return this.snapshot;
    this.stateState = "active";
    if (viewport !== undefined) this.updateViewport(viewport);
    return this.snapshot;
  }

  updateViewport(viewport: FogViewport): FogSnapshot {
    if (this.stateState !== "active") return this.snapshot;
    this.viewportState = Object.freeze({ ...viewport });
    for (const cell of this.cellStates) {
      cell.active = !cell.cleared && inViewport(cell, viewport, this.config.viewportPadding);
    }
    return this.snapshot;
  }

  updateInteractions(
    player: FogPlayerInput | undefined,
    cars: readonly FogPoint[] | undefined,
    now = 0,
  ): FogSnapshot {
    if (this.stateState !== "active") return this.snapshot;
    if (player !== undefined) {
      const velocityX = player.velocityX ?? 0;
      const velocityY = player.velocityY ?? 0;
      if (
        player.direction !== undefined ||
        Math.abs(velocityX) > 0.1 ||
        Math.abs(velocityY) > 0.1
      ) {
        this.lastDirection =
          player.direction ?? Math.atan2(velocityY, velocityX);
        const ahead = {
          x: player.x + Math.cos(this.lastDirection) * this.config.clearAhead,
          y: player.y + Math.sin(this.lastDirection) * this.config.clearAhead,
        };
        for (const cell of this.cellStates) {
          const dx = cell.x - ahead.x;
          const dy = cell.y - ahead.y;
          const localX =
            dx * Math.cos(-this.lastDirection) -
            dy * Math.sin(-this.lastDirection);
          const localY =
            dx * Math.sin(-this.lastDirection) +
            dy * Math.cos(-this.lastDirection);
          if (
            (localX * localX) /
                (this.config.clearWidth * this.config.clearWidth) +
              (localY * localY) /
                (this.config.clearHeight * this.config.clearHeight) <=
              1
          ) {
            this.clearCell(cell.id, now);
          }
        }
      }
    }
    if (cars !== undefined) {
      for (const car of cars) this.clearAtPosition(car, this.config.carClearRadius, now);
    }
    return this.tick(now);
  }

  clearAtPosition(
    position: FogPoint,
    radius = this.config.carClearRadius,
    now = 0,
  ): readonly string[] {
    const cleared: string[] = [];
    for (const cell of this.cellStates) {
      const dx = cell.x - position.x;
      const dy = cell.y - position.y;
      if (dx * dx + dy * dy < radius * radius && this.clearCell(cell.id, now)) {
        cleared.push(cell.id);
      }
    }
    return Object.freeze(cleared);
  }

  clearCell(id: string, now = 0): boolean {
    const cell = this.cellStates.find((item) => item.id === id);
    if (cell === undefined || cell.cleared) return false;
    cell.cleared = true;
    cell.active = false;
    cell.respawnAt = now + this.config.respawnMs;
    return true;
  }

  tick(now: number): FogSnapshot {
    if (this.stateState !== "active") return this.snapshot;
    for (const cell of this.cellStates) {
      if (cell.respawnAt !== null && cell.respawnAt <= now) {
        cell.cleared = false;
        cell.respawnAt = null;
        cell.active =
          this.viewportState === null || inViewport(cell, this.viewportState, this.config.viewportPadding);
      }
    }
    return this.snapshot;
  }

  shutdown(): FogSnapshot {
    if (this.stateState === "shutdown") return this.snapshot;
    this.stateState = "shutdown";
    for (const cell of this.cellStates) {
      cell.active = false;
      cell.cleared = true;
      cell.respawnAt = null;
    }
    return this.snapshot;
  }

  cellState(id: string): FogCellSnapshot | undefined {
    const cell = this.cellStates.find((item) => item.id === id);
    return cell === undefined ? undefined : Object.freeze({ ...cell });
  }

  cellForPosition(position: FogPoint): FogCellSnapshot | undefined {
    return this.cellState(
      this.cellStates.find((cell) => cellKey(cell) === cellKey(position))?.id ??
        "",
    );
  }
}

export { createCells as createFogCells, pointInPolygon as fogPointInPolygon };

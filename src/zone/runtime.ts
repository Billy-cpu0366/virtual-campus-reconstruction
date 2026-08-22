import {
  CONTENT_MENU_IDS,
  type ContentMenuId,
  type InteractionVisitReceipt,
  type ZoneResidenceEvent,
} from "../content/contract.js";

export interface ZonePoint {
  readonly x: number;
  readonly y: number;
}

export interface ZoneViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ZoneMarker {
  readonly markerId: string;
  readonly menuId: ContentMenuId;
  readonly x: number;
  readonly y: number;
}

export interface ZoneSnapshot {
  readonly player: ZonePoint;
  readonly viewport: ZoneViewport;
}

export interface ZoneScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ZoneRuntimeOptions {
  readonly markers: readonly ZoneMarker[];
  readonly onResidence: (event: ZoneResidenceEvent) => void;
  readonly scheduler?: ZoneScheduler;
  readonly intervalMs?: number;
  readonly viewportPadding?: number;
  readonly interactionDistance?: number;
}

interface ResidenceState {
  readonly marker: ZoneMarker;
  readonly residenceId: string;
}

const DEFAULT_INTERVAL_MS = 100;
const DEFAULT_VIEWPORT_PADDING = 100;
const DEFAULT_INTERACTION_DISTANCE = 30;

function isMenuId(value: unknown): value is ContentMenuId {
  return (
    typeof value === "string" &&
    (CONTENT_MENU_IDS as readonly string[]).includes(value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validSnapshot(snapshot: ZoneSnapshot): boolean {
  return (
    isFiniteNumber(snapshot.player.x) &&
    isFiniteNumber(snapshot.player.y) &&
    isFiniteNumber(snapshot.viewport.x) &&
    isFiniteNumber(snapshot.viewport.y) &&
    isFiniteNumber(snapshot.viewport.width) &&
    isFiniteNumber(snapshot.viewport.height) &&
    snapshot.viewport.width >= 0 &&
    snapshot.viewport.height >= 0
  );
}

function validMarker(marker: ZoneMarker): boolean {
  return (
    marker.markerId.length > 0 &&
    isMenuId(marker.menuId) &&
    isFiniteNumber(marker.x) &&
    isFiniteNumber(marker.y)
  );
}

/** Deterministic marker residence runtime. It has no DOM or physics dependency. */
export class ZoneRuntime {
  private readonly markers: readonly ZoneMarker[];
  private readonly markerById = new Map<string, ZoneMarker>();
  private readonly onResidence: (event: ZoneResidenceEvent) => void;
  private readonly scheduler: ZoneScheduler | undefined;
  private readonly intervalMs: number;
  private readonly viewportPadding: number;
  private readonly interactionDistance: number;
  private readonly residences = new Map<string, ResidenceState>();
  private readonly visitedMarkers = new Set<string>();
  private nextResidenceNumber = 1;
  private latestSnapshot: ZoneSnapshot | undefined;
  private scheduledHandle: unknown;
  private destroyed = false;

  constructor(options: ZoneRuntimeOptions) {
    this.markers = options.markers.map((marker) => Object.freeze({ ...marker }));
    for (const marker of this.markers) {
      if (!validMarker(marker) || this.markerById.has(marker.markerId)) {
        throw new Error(
          `Invalid or duplicate zone marker: ${marker.markerId}`,
        );
      }
      this.markerById.set(marker.markerId, marker);
    }
    this.onResidence = options.onResidence;
    this.scheduler = options.scheduler;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.viewportPadding = options.viewportPadding ?? DEFAULT_VIEWPORT_PADDING;
    this.interactionDistance =
      options.interactionDistance ?? DEFAULT_INTERACTION_DISTANCE;
    if (
      !Number.isFinite(this.intervalMs) ||
      this.intervalMs < 0 ||
      !Number.isFinite(this.viewportPadding) ||
      this.viewportPadding < 0 ||
      !Number.isFinite(this.interactionDistance) ||
      this.interactionDistance <= 0
    ) {
      throw new Error("Invalid zone runtime thresholds");
    }
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get activeResidenceCount(): number {
    return this.residences.size;
  }

  get visitedMarkerIds(): readonly string[] {
    return [...this.visitedMarkers];
  }

  hasVisited(markerId: string): boolean {
    return this.visitedMarkers.has(markerId);
  }

  /** Store the newest position and coalesce checks into an injected 100ms timer. */
  update(snapshot: ZoneSnapshot): void {
    if (this.destroyed || !validSnapshot(snapshot)) return;
    this.latestSnapshot = snapshot;
    if (this.scheduler === undefined) {
      this.checkNow();
      return;
    }
    if (this.scheduledHandle !== undefined) return;
    this.scheduledHandle = this.scheduler.setTimeout(() => {
      this.scheduledHandle = undefined;
      if (!this.destroyed) this.checkNow();
    }, this.intervalMs);
  }

  /** Run one check immediately; useful for deterministic callers and tests. */
  tick(snapshot?: ZoneSnapshot): void {
    if (this.destroyed) return;
    if (snapshot !== undefined) {
      if (!validSnapshot(snapshot)) return;
      this.latestSnapshot = snapshot;
    }
    this.checkNow();
  }

  check(snapshot?: ZoneSnapshot): void {
    this.tick(snapshot);
  }

  /** Accept only a receipt for the marker's currently active residence. */
  acceptVisitReceipt(receipt: InteractionVisitReceipt): boolean {
    if (this.destroyed) return false;
    if (
      receipt.markerId.length === 0 ||
      receipt.residenceId.length === 0 ||
      !isMenuId(receipt.menuId)
    ) {
      return false;
    }
    const residence = this.residences.get(receipt.markerId);
    if (
      residence === undefined ||
      residence.residenceId !== receipt.residenceId ||
      residence.marker.menuId !== receipt.menuId
    ) {
      return false;
    }
    this.visitedMarkers.add(receipt.markerId);
    return true;
  }

  /** Stop scheduling, reject late updates, and release all runtime state. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.scheduledHandle !== undefined && this.scheduler !== undefined) {
      this.scheduler.clearTimeout(this.scheduledHandle);
      this.scheduledHandle = undefined;
    }
    this.latestSnapshot = undefined;
    this.residences.clear();
    this.visitedMarkers.clear();
  }

  private checkNow(): void {
    if (this.destroyed || this.latestSnapshot === undefined) return;
    const snapshot = this.latestSnapshot;
    const candidates = this.candidates(snapshot.viewport);
    for (const marker of candidates) {
      const inside = this.isInside(marker, snapshot.player);
      const current = this.residences.get(marker.markerId);
      if (inside && current === undefined) {
        this.enter(marker);
      } else if (!inside && current !== undefined) {
        this.leave(marker, current);
      }
    }
  }

  private candidates(viewport: ZoneViewport): readonly ZoneMarker[] {
    const left = viewport.x - this.viewportPadding;
    const top = viewport.y - this.viewportPadding;
    const right = viewport.x + viewport.width + this.viewportPadding;
    const bottom = viewport.y + viewport.height + this.viewportPadding;
    return this.markers.filter((marker) => {
      if (this.residences.has(marker.markerId)) return true;
      return (
        marker.x >= left &&
        marker.x <= right &&
        marker.y >= top &&
        marker.y <= bottom
      );
    });
  }

  private isInside(marker: ZoneMarker, player: ZonePoint): boolean {
    const dx = player.x - marker.x;
    const dy = player.y - marker.y;
    return Math.sqrt(dx * dx + dy * dy) < this.interactionDistance;
  }

  private enter(marker: ZoneMarker): void {
    const residenceId = `residence-${this.nextResidenceNumber}`;
    this.nextResidenceNumber += 1;
    const residence = { marker, residenceId };
    this.residences.set(marker.markerId, residence);
    this.emit({
      markerId: marker.markerId,
      menuId: marker.menuId,
      residenceId,
      phase: "enter",
    });
  }

  private leave(marker: ZoneMarker, residence: ResidenceState): void {
    this.residences.delete(marker.markerId);
    this.emit({
      markerId: marker.markerId,
      menuId: marker.menuId,
      residenceId: residence.residenceId,
      phase: "leave",
    });
  }

  private emit(event: ZoneResidenceEvent): void {
    if (this.destroyed) return;
    this.onResidence(event);
  }
}

export const ZoneMarkerRuntime = ZoneRuntime;
export function createZoneRuntime(options: ZoneRuntimeOptions): ZoneRuntime {
  return new ZoneRuntime(options);
}

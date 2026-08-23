import type { ContentMenuId } from "../src/content/contract.js";

export interface CampusMapMarker {
  readonly markerId: string;
  readonly menuId: ContentMenuId;
  readonly label: string;
  readonly kind: "sunburn" | "vortex";
  readonly x: number;
  readonly y: number;
  readonly enabled: boolean;
}

export interface CampusMapPoint {
  readonly x: number;
  readonly y: number;
}

export interface CampusMapClassListLike {
  toggle(token: string, force?: boolean): boolean;
}

export interface CampusMapElementLike {
  hidden: boolean;
  readonly style: {
    left: string;
    top: string;
  };
  readonly classList: CampusMapClassListLike;
  addEventListener(type: "click", handler: CampusMapClickHandler): void;
  removeEventListener(type: "click", handler: CampusMapClickHandler): void;
  setAttribute?(name: string, value: string): void;
  focus?(): void;
}

export interface CampusMapClickEvent {
  preventDefault?(): void;
}

export type CampusMapClickHandler = (event: CampusMapClickEvent) => void;

export interface CampusMapMarkerView {
  readonly markerId: string;
  readonly element: CampusMapElementLike;
}

export interface CampusMapElements {
  readonly hud: CampusMapElementLike;
  readonly openButton: CampusMapElementLike;
  readonly root: CampusMapElementLike;
  readonly backdrop: CampusMapElementLike;
  readonly dialog: CampusMapElementLike;
  readonly closeButton: CampusMapElementLike;
  readonly miniPlayer: CampusMapElementLike;
  readonly bigPlayer: CampusMapElementLike;
  readonly miniMarkers: readonly CampusMapMarkerView[];
  readonly bigMarkers: readonly CampusMapMarkerView[];
}

export interface CampusMapRuntimeOptions {
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly markers: readonly CampusMapMarker[];
  readonly elements: CampusMapElements;
  readonly onOpen: () => boolean;
  readonly onClose: () => void;
  readonly onSelect: (marker: CampusMapMarker) => void;
}

export interface CampusMapSnapshot {
  readonly hudEnabled: boolean;
  readonly hudHidden: boolean;
  readonly mapOpen: boolean;
  readonly rootHidden: boolean;
  readonly contentModalVisible: boolean;
  readonly visitedMarkerIds: readonly string[];
  readonly playerPercent: CampusMapPoint;
  readonly destroyed: boolean;
}

interface BoundClick {
  readonly element: CampusMapElementLike;
  readonly handler: CampusMapClickHandler;
}

function clampPercent(value: number, total: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function percent(value: number): string {
  return `${value.toFixed(4).replace(/\.?(?:0+)$/u, "")}%`;
}

/** Scene-owned DOM consumer for the confirmed mini-map and big-map surfaces. */
export class PhaserCampusMapRuntime {
  private readonly elements: CampusMapElements;
  private readonly markers: readonly CampusMapMarker[];
  private readonly markerById = new Map<string, CampusMapMarker>();
  private readonly miniViewById = new Map<string, CampusMapElementLike>();
  private readonly bigViewById = new Map<string, CampusMapElementLike>();
  private readonly boundClicks: BoundClick[] = [];
  private readonly onOpen: () => boolean;
  private readonly onClose: () => void;
  private readonly onSelect: (marker: CampusMapMarker) => void;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly visitedMarkerIds = new Set<string>();
  private playerPercent: CampusMapPoint = Object.freeze({ x: 0, y: 0 });
  private hudEnabled = false;
  private mapOpen = false;
  private contentModalVisible = false;
  private destroyed = false;

  constructor(options: CampusMapRuntimeOptions) {
    if (
      !Number.isFinite(options.worldWidth) ||
      options.worldWidth <= 0 ||
      !Number.isFinite(options.worldHeight) ||
      options.worldHeight <= 0
    ) {
      throw new Error("invalid campus map world size");
    }
    this.worldWidth = options.worldWidth;
    this.worldHeight = options.worldHeight;
    this.elements = options.elements;
    this.markers = options.markers.map((marker) => Object.freeze({ ...marker }));
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onSelect = options.onSelect;

    for (const view of options.elements.miniMarkers) {
      if (this.miniViewById.has(view.markerId)) {
        throw new Error(`duplicate mini map marker view: ${view.markerId}`);
      }
      this.miniViewById.set(view.markerId, view.element);
    }
    for (const view of options.elements.bigMarkers) {
      if (this.bigViewById.has(view.markerId)) {
        throw new Error(`duplicate big map marker view: ${view.markerId}`);
      }
      this.bigViewById.set(view.markerId, view.element);
    }
    for (const marker of this.markers) {
      if (this.markerById.has(marker.markerId)) {
        throw new Error(`duplicate campus map marker: ${marker.markerId}`);
      }
      const mini = this.miniViewById.get(marker.markerId);
      const big = this.bigViewById.get(marker.markerId);
      if (mini === undefined || big === undefined) {
        throw new Error(`missing campus map marker view: ${marker.markerId}`);
      }
      this.markerById.set(marker.markerId, marker);
      this.positionMarker(marker, mini);
      this.positionMarker(marker, big);
      for (const element of [mini, big]) {
        element.classList.toggle("map-marker-info", marker.kind === "sunburn");
        element.classList.toggle("map-marker-memo", marker.kind === "vortex");
        element.classList.toggle("map-marker-disabled", !marker.enabled);
        element.setAttribute?.("aria-label", marker.label);
        element.setAttribute?.("aria-disabled", String(!marker.enabled));
      }
      if (marker.enabled) {
        this.bind(big, (event) => {
          event.preventDefault?.();
          if (this.destroyed || !this.mapOpen || this.contentModalVisible) return;
          this.close();
          this.onSelect(marker);
        });
      }
    }

    this.bind(this.elements.openButton, (event) => {
      event.preventDefault?.();
      this.open();
    });
    this.bind(this.elements.closeButton, (event) => {
      event.preventDefault?.();
      this.close();
    });
    this.bind(this.elements.backdrop, (event) => {
      event.preventDefault?.();
      this.close();
    });
    this.syncVisibility();
  }

  get snapshot(): CampusMapSnapshot {
    return Object.freeze({
      hudEnabled: this.hudEnabled,
      hudHidden: this.elements.hud.hidden,
      mapOpen: this.mapOpen,
      rootHidden: this.elements.root.hidden,
      contentModalVisible: this.contentModalVisible,
      visitedMarkerIds: Object.freeze([...this.visitedMarkerIds]),
      playerPercent: this.playerPercent,
      destroyed: this.destroyed,
    });
  }

  setHudEnabled(enabled: boolean): void {
    if (this.destroyed) return;
    this.hudEnabled = enabled;
    if (!enabled && this.mapOpen) this.close();
    this.syncVisibility();
  }

  setContentModalVisible(visible: boolean): void {
    if (this.destroyed || this.contentModalVisible === visible) return;
    this.contentModalVisible = visible;
    if (visible && this.mapOpen) this.close();
    this.syncVisibility();
  }

  update(player: CampusMapPoint, visitedMarkerIds: readonly string[]): void {
    if (this.destroyed) return;
    const nextPlayer = Object.freeze({
      x: clampPercent(player.x, this.worldWidth),
      y: clampPercent(player.y, this.worldHeight),
    });
    this.playerPercent = nextPlayer;
    for (const element of [this.elements.miniPlayer, this.elements.bigPlayer]) {
      element.style.left = percent(nextPlayer.x);
      element.style.top = percent(nextPlayer.y);
    }

    this.visitedMarkerIds.clear();
    for (const markerId of visitedMarkerIds) {
      if (this.markerById.has(markerId)) this.visitedMarkerIds.add(markerId);
    }
    for (const marker of this.markers) {
      const visited = this.visitedMarkerIds.has(marker.markerId);
      this.miniViewById.get(marker.markerId)?.classList.toggle("visited", visited);
      this.bigViewById.get(marker.markerId)?.classList.toggle("visited", visited);
    }
  }

  open(): boolean {
    if (
      this.destroyed ||
      !this.hudEnabled ||
      this.mapOpen ||
      this.contentModalVisible
    ) {
      return false;
    }
    if (!this.onOpen()) return false;
    this.mapOpen = true;
    this.syncVisibility();
    this.elements.closeButton.focus?.();
    return true;
  }

  close(): boolean {
    if (this.destroyed || !this.mapOpen) return false;
    this.mapOpen = false;
    this.syncVisibility();
    this.onClose();
    return true;
  }

  destroy(): void {
    if (this.destroyed) return;
    if (this.mapOpen) this.close();
    this.destroyed = true;
    for (const binding of this.boundClicks) {
      binding.element.removeEventListener("click", binding.handler);
    }
    this.boundClicks.length = 0;
    this.hudEnabled = false;
    this.contentModalVisible = false;
    this.elements.hud.hidden = true;
    this.elements.root.hidden = true;
    this.elements.dialog.hidden = true;
    this.visitedMarkerIds.clear();
  }

  private bind(
    element: CampusMapElementLike,
    handler: CampusMapClickHandler,
  ): void {
    element.addEventListener("click", handler);
    this.boundClicks.push({ element, handler });
  }

  private positionMarker(
    marker: CampusMapMarker,
    element: CampusMapElementLike,
  ): void {
    element.style.left = percent(clampPercent(marker.x, this.worldWidth));
    element.style.top = percent(clampPercent(marker.y, this.worldHeight));
  }

  private syncVisibility(): void {
    const hudVisible =
      !this.destroyed &&
      this.hudEnabled &&
      !this.mapOpen &&
      !this.contentModalVisible;
    this.elements.hud.hidden = !hudVisible;
    this.elements.root.hidden = !this.mapOpen;
    this.elements.dialog.hidden = !this.mapOpen;
  }
}

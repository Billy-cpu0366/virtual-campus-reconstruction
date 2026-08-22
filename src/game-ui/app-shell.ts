import type { AppSnapshot, AppStatus } from "../app/contract.js";

export interface DomAppStyle {
  [property: string]: string;
}

export interface DomAppTarget {
  hidden: boolean;
  textContent: string | null;
  style: DomAppStyle;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void;
  focus?(): void;
}

export interface DomAppImageTarget extends DomAppTarget {
  src: string;
  alt: string;
}

export interface DomAppOptionalImage {
  readonly image: DomAppImageTarget;
  readonly fallback?: DomAppTarget;
  readonly fallbackAlt?: string;
  readonly fallbackText?: string;
}

export interface DomAppElements {
  readonly loading: DomAppTarget;
  readonly progressBar: DomAppTarget;
  readonly progressText: DomAppTarget;
  readonly play: DomAppTarget;
  readonly error: DomAppTarget;
  readonly errorText: DomAppTarget;
  readonly retry: DomAppTarget;
}

export interface DomAppViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface DomAppViewport {
  getSize(): DomAppViewportSize;
  subscribeResize(listener: () => void): () => void;
}

export interface DomAppFocusPort {
  getActiveElement(): DomAppTarget | undefined;
  focus(target: DomAppTarget): void;
}

export interface DomAppUiOptions {
  readonly elements: Partial<DomAppElements>;
  readonly viewport: DomAppViewport;
  readonly focus?: DomAppFocusPort;
  readonly optionalImages?: readonly DomAppOptionalImage[];
  readonly onPlay?: () => void;
  readonly onRetry?: () => void;
}

export type DomAppView =
  | "loading"
  | "ready"
  | "entering"
  | "playing"
  | "error"
  | "shutdown";

const FOCUS_RING = "3px solid #0b57d0";
const MOBILE_WIDTH = 767;

function hasTarget(value: DomAppTarget | undefined): value is DomAppTarget {
  return (
    value !== undefined &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function" &&
    value.style !== undefined
  );
}

function validRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validSize(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function hidden(target: DomAppTarget | undefined, value: boolean): void {
  if (!hasTarget(target)) return;
  try {
    target.hidden = value;
    target.style.pointerEvents = value ? "none" : "auto";
  } catch {
    // A broken optional DOM target must not escape an event or loader callback.
  }
}

/** Loading/Play/Error shell with injected DOM and viewport ownership. */
export class DomAppUi {
  private readonly elements: Partial<DomAppElements>;
  private readonly viewport: DomAppViewport;
  private readonly focusPort: DomAppFocusPort | undefined;
  private readonly optionalImages: readonly DomAppOptionalImage[];
  private readonly onPlay: (() => void) | undefined;
  private readonly onRetry: (() => void) | undefined;
  private readonly imageListeners: Array<{
    readonly image: DomAppImageTarget;
    readonly listener: (event: unknown) => void;
  }> = [];
  private unsubscribeResize: (() => void) | undefined;
  private playListenerBound = false;
  private retryListenerBound = false;
  private destroyed = false;
  private view: DomAppView = "loading";
  private progress = 0;
  private generation = 0;

  private readonly playListener = (): void => {
    try {
      this.onPlay?.();
    } catch {
      // The application state machine owns failure conversion.
    }
  };

  private readonly retryListener = (): void => {
    try {
      this.onRetry?.();
    } catch {
      // The application state machine owns failure conversion.
    }
  };

  private readonly resizeListener = (): void => {
    if (this.destroyed) return;
    this.applyViewport();
  };

  constructor(options: DomAppUiOptions) {
    this.elements = options.elements;
    this.viewport = options.viewport;
    this.focusPort = options.focus;
    this.optionalImages = options.optionalImages ?? [];
    this.onPlay = options.onPlay;
    this.onRetry = options.onRetry;

    try {
      this.bindActions();
      this.bindImages();
      const unsubscribeResize = this.viewport.subscribeResize(
        this.resizeListener,
      );
      if (typeof unsubscribeResize !== "function") {
        throw new TypeError("resize subscription did not return cleanup");
      }
      this.unsubscribeResize = unsubscribeResize;
      this.applyViewport();
      this.renderLoading(0);
    } catch (error) {
      this.removeListeners();
      throw error;
    }
  }

  get currentView(): DomAppView {
    return this.view;
  }

  get currentProgress(): number {
    return this.progress;
  }

  render(snapshot: AppSnapshot): boolean {
    if (this.destroyed) return false;
    if (snapshot.generation !== this.generation) {
      this.generation = snapshot.generation;
      this.progress = 0;
    }
    switch (snapshot.status) {
      case "BOOT":
      case "LOADING":
      case "RETRYING":
        return this.renderLoading(snapshot.progress);
      case "READY":
        return this.renderReady();
      case "ENTERING_GAME":
        return this.renderEntering();
      case "PLAYING":
      case "MODAL_OPEN":
        return this.renderPlaying();
      case "ERROR":
        return this.renderError(snapshot.error?.message ?? "Loading failed");
      case "SHUTDOWN":
        this.destroy();
        return true;
    }
  }

  renderLoading(ratio: number): boolean {
    if (this.destroyed || !validRatio(ratio) || ratio < this.progress) {
      return false;
    }
    this.progress = ratio;
    this.view = "loading";
    hidden(this.elements.loading, false);
    hidden(this.elements.play, true);
    hidden(this.elements.error, true);
    hidden(this.elements.retry, true);
    this.setText(this.elements.progressText, `${Math.floor(ratio * 100)}%`);
    this.setStyle(this.elements.progressBar, "width", `${ratio * 100}%`);
    return true;
  }

  renderReady(): boolean {
    if (this.destroyed) return false;
    this.view = "ready";
    hidden(this.elements.loading, true);
    hidden(this.elements.play, false);
    hidden(this.elements.error, true);
    hidden(this.elements.retry, true);
    this.focusTarget(this.elements.play);
    return true;
  }

  renderEntering(): boolean {
    if (this.destroyed) return false;
    this.view = "entering";
    hidden(this.elements.loading, true);
    hidden(this.elements.play, true);
    hidden(this.elements.error, true);
    hidden(this.elements.retry, true);
    return true;
  }

  renderPlaying(): boolean {
    if (this.destroyed) return false;
    this.view = "playing";
    hidden(this.elements.loading, true);
    hidden(this.elements.play, true);
    hidden(this.elements.error, true);
    hidden(this.elements.retry, true);
    return true;
  }

  renderError(message: string): boolean {
    if (this.destroyed) return false;
    this.view = "error";
    hidden(this.elements.loading, true);
    hidden(this.elements.play, true);
    hidden(this.elements.error, false);
    hidden(this.elements.retry, false);
    this.setText(this.elements.errorText, message.trim() || "Loading failed");
    this.focusTarget(this.elements.retry);
    return true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.view = "shutdown";
    this.removeListeners();
    hidden(this.elements.loading, true);
    hidden(this.elements.play, true);
    hidden(this.elements.error, true);
    hidden(this.elements.retry, true);
  }

  private bindActions(): void {
    if (hasTarget(this.elements.play)) {
      this.elements.play.addEventListener("click", this.playListener);
      this.playListenerBound = true;
    }
    if (hasTarget(this.elements.retry)) {
      this.elements.retry.addEventListener("click", this.retryListener);
      this.retryListenerBound = true;
    }
  }

  private bindImages(): void {
    for (const optional of this.optionalImages) {
      if (!hasTarget(optional.image)) continue;
      const listener = (): void => {
        this.applyOptionalFallback(optional);
      };
      optional.image.addEventListener("error", listener);
      this.imageListeners.push({ image: optional.image, listener });
    }
  }

  private applyOptionalFallback(optional: DomAppOptionalImage): void {
    try {
      optional.image.alt = optional.fallbackAlt ?? "Image unavailable";
      optional.image.hidden = false;
      optional.image.style.visibility = "hidden";
      if (optional.fallback !== undefined) {
        optional.fallback.style.visibility = "visible";
        optional.fallback.hidden = false;
        optional.fallback.style.pointerEvents = "none";
        if (optional.fallbackText !== undefined) {
          optional.fallback.textContent = optional.fallbackText;
        }
      }
    } catch {
      // Optional media must never break the required App path.
    }
  }

  private applyViewport(): void {
    let size: DomAppViewportSize;
    try {
      size = this.viewport.getSize();
    } catch {
      return;
    }
    if (!validSize(size.width) || !validSize(size.height)) return;

    const targets = [
      this.elements.loading,
      this.elements.play,
      this.elements.error,
    ];
    for (const target of targets) {
      if (!hasTarget(target)) continue;
      this.setStyle(target, "minHeight", "100dvh");
      this.setStyle(target, "height", `${size.height}px`);
      this.setStyle(
        target,
        "padding",
        size.width <= MOBILE_WIDTH ? "16px" : "24px",
      );
      this.setStyle(
        target,
        "maxWidth",
        "100vw",
      );
    }
  }

  private focusTarget(target: DomAppTarget | undefined): void {
    if (!hasTarget(target)) return;
    this.setStyle(target, "outline", FOCUS_RING);
    try {
      if (this.focusPort !== undefined) {
        this.focusPort.focus(target);
      } else {
        target.focus?.();
      }
    } catch {
      // Focus is best effort; the visible ring remains on the target.
    }
  }

  private setText(target: DomAppTarget | undefined, value: string): void {
    if (!hasTarget(target)) return;
    try {
      target.textContent = value;
    } catch {
      // Rendering an optional target must not break the state machine.
    }
  }

  private setStyle(
    target: DomAppTarget | undefined,
    property: string,
    value: string,
  ): void {
    if (!hasTarget(target)) return;
    try {
      target.style[property] = value;
    } catch {
      // Rendering remains best effort at the DOM boundary.
    }
  }

  private removeListeners(): void {
    if (this.playListenerBound) {
      try {
        this.elements.play?.removeEventListener("click", this.playListener);
      } catch {
        // Best effort cleanup.
      }
    }
    this.playListenerBound = false;

    if (this.retryListenerBound) {
      try {
        this.elements.retry?.removeEventListener("click", this.retryListener);
      } catch {
        // Best effort cleanup.
      }
    }
    this.retryListenerBound = false;

    for (const { image, listener } of this.imageListeners.splice(0)) {
      try {
        image.removeEventListener("error", listener);
      } catch {
        // Best effort cleanup.
      }
    }

    const unsubscribeResize = this.unsubscribeResize;
    this.unsubscribeResize = undefined;
    try {
      unsubscribeResize?.();
    } catch {
      // Destroy remains idempotent after resize cleanup failure.
    }
  }
}

export function createDomAppUi(options: DomAppUiOptions): DomAppUi {
  return new DomAppUi(options);
}

export type { AppStatus };

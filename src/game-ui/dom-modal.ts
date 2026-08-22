import {
  CONTENT_MENU_IDS,
  type GameUiHideRequest,
  type GameUiPort,
  type GameUiShowRequest,
  type ShowResult,
  type UserCloseEvent,
  type UserCloseSource,
} from "../content/contract.js";

export interface DomModalStyle {
  maxHeight: string;
  overflowY: string;
  pointerEvents: string;
  zIndex: string;
}

export interface DomModalTarget {
  hidden: boolean;
  textContent: string | null;
  scrollTop: number;
  style: DomModalStyle;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void;
}

export interface DomModalElements {
  readonly root: DomModalTarget;
  readonly backdrop: DomModalTarget;
  readonly modal: DomModalTarget;
  readonly title: DomModalTarget;
  readonly body: DomModalTarget;
  readonly closeButton: DomModalTarget;
}

export interface DomModalViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface DomModalViewport {
  getSize(): DomModalViewportSize;
  subscribeResize(listener: () => void): () => void;
}

export interface DomModalGameUiOptions {
  readonly elements: Partial<DomModalElements>;
  readonly viewport: DomModalViewport;
}

type PreparedView = {
  readonly menuId: GameUiShowRequest["menuId"];
  readonly residenceId: string;
  readonly title: string;
  readonly body: string;
  readonly backdrop: GameUiShowRequest["presentation"]["backdrop"];
};

type ActiveView = PreparedView;

const DESKTOP_MAX_HEIGHT_RATIO = 0.9;
const MOBILE_MAX_HEIGHT_RATIO = 0.7;
const MOBILE_WIDTH = 767;

function isMenuId(value: unknown): value is GameUiShowRequest["menuId"] {
  return (
    typeof value === "string" &&
    (CONTENT_MENU_IDS as readonly string[]).includes(value)
  );
}

function isBackdrop(value: unknown): value is PreparedView["backdrop"] {
  return value === "none" || value === "global";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasTarget(value: DomModalTarget | undefined): value is DomModalTarget {
  return (
    value !== undefined &&
    value !== null &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function" &&
    value.style !== undefined
  );
}

function sameIdentity(left: ActiveView, right: PreparedView): boolean {
  return (
    left.menuId === right.menuId && left.residenceId === right.residenceId
  );
}

function validateAndBuild(request: unknown): PreparedView | undefined {
  if (!isRecord(request)) return undefined;
  if (!isMenuId(request.menuId) || !hasText(request.residenceId)) {
    return undefined;
  }

  if (!isRecord(request.payload)) return undefined;
  const payload = request.payload;
  if (
    !isMenuId(payload.menuId) ||
    payload.menuId !== request.menuId ||
    !hasText(payload.title) ||
    !Array.isArray(payload.body) ||
    payload.body.length === 0 ||
    !payload.body.every(hasText)
  ) {
    return undefined;
  }

  if (
    !isRecord(request.presentation) ||
    !isBackdrop(request.presentation.backdrop)
  ) {
    return undefined;
  }
  if ("residenceId" in payload && !hasText(payload.residenceId)) {
    return undefined;
  }
  if (
    "presentation" in payload &&
    (!isRecord(payload.presentation) ||
      !isBackdrop(payload.presentation.backdrop))
  ) {
    return undefined;
  }

  return {
    menuId: request.menuId,
    residenceId: request.residenceId,
    title: payload.title,
    body: payload.body.join("\n\n"),
    backdrop: request.presentation.backdrop,
  };
}

export class DomModalGameUi implements GameUiPort {
  private readonly elements: Partial<DomModalElements>;
  private readonly viewport: DomModalViewport;
  private readonly subscribers = new Set<(event: UserCloseEvent) => void>();
  private active: ActiveView | undefined;
  private unsubscribeResize: (() => void) | undefined;
  private listenersBound = false;
  private destroyed = false;

  private readonly closeListener = (): void => {
    this.emitUserClose("close-button");
  };

  private readonly backdropListener = (): void => {
    this.emitUserClose("backdrop");
  };

  private readonly resizeListener = (): void => {
    if (this.destroyed || this.active === undefined) return;
    this.applyMaxHeight();
  };

  constructor(elements: Partial<DomModalElements>, viewport: DomModalViewport) {
    this.elements = elements;
    this.viewport = viewport;
    this.bindListeners();
  }

  show(request: GameUiShowRequest): ShowResult {
    if (this.destroyed) return { status: "destroyed" };
    if (!this.hasAllTargets()) return { status: "missing-target" };

    const prepared = validateAndBuild(request);
    if (prepared === undefined) return { status: "invalid-payload" };
    if (this.active !== undefined && sameIdentity(this.active, prepared)) {
      return { status: "already-visible" };
    }

    if (!this.replaceDom(prepared)) return { status: "invalid-payload" };
    this.active = prepared;
    return { status: "shown" };
  }

  hide(request: GameUiHideRequest) {
    if (this.destroyed) return { status: "destroyed" } as const;
    const active = this.active;
    if (active === undefined) return { status: "already-hidden" } as const;
    if (
      active.menuId !== request.menuId ||
      active.residenceId !== request.residenceId
    ) {
      return { status: "target-mismatch" } as const;
    }

    this.hideDom();
    this.active = undefined;
    return { status: "hidden" } as const;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeListeners();
    this.hideDom();
    this.active = undefined;
    this.subscribers.clear();
  }

  subscribeUserClose(handler: (event: UserCloseEvent) => void): () => void {
    if (this.destroyed) return () => undefined;
    this.subscribers.add(handler);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.subscribers.delete(handler);
    };
  }

  private hasAllTargets(): boolean {
    return (
      hasTarget(this.elements.root) &&
      hasTarget(this.elements.backdrop) &&
      hasTarget(this.elements.modal) &&
      hasTarget(this.elements.title) &&
      hasTarget(this.elements.body) &&
      hasTarget(this.elements.closeButton)
    );
  }

  private bindListeners(): void {
    const { closeButton, backdrop } = this.elements;
    if (!hasTarget(closeButton) || !hasTarget(backdrop)) return;
    if (!this.hasAllTargets()) return;
    closeButton.addEventListener("click", this.closeListener);
    backdrop.addEventListener("click", this.backdropListener);
    this.unsubscribeResize = this.viewport.subscribeResize(
      this.resizeListener,
    );
    this.listenersBound = true;
  }

  private removeListeners(): void {
    const { closeButton, backdrop } = this.elements;
    if (this.listenersBound && hasTarget(closeButton) && hasTarget(backdrop)) {
      try {
        closeButton.removeEventListener("click", this.closeListener);
      } catch {
        // Continue removing every independently owned listener.
      }
      try {
        backdrop.removeEventListener("click", this.backdropListener);
      } catch {
        // Continue with the injected viewport cleanup.
      }
    }
    this.listenersBound = false;
    const unsubscribeResize = this.unsubscribeResize;
    this.unsubscribeResize = undefined;
    try {
      unsubscribeResize?.();
    } catch {
      // Destroy is intentionally best effort and remains idempotent.
    }
  }

  private replaceDom(prepared: PreparedView): boolean {
    const { root, backdrop, modal, title, body } = this.elements;
    if (
      !hasTarget(root) ||
      !hasTarget(backdrop) ||
      !hasTarget(modal) ||
      !hasTarget(title) ||
      !hasTarget(body)
    ) {
      return false;
    }

    const previous = {
      rootHidden: root.hidden,
      rootPointerEvents: root.style.pointerEvents,
      backdropHidden: backdrop.hidden,
      backdropPointerEvents: backdrop.style.pointerEvents,
      modalHidden: modal.hidden,
      modalPointerEvents: modal.style.pointerEvents,
      modalZIndex: modal.style.zIndex,
      modalOverflowY: modal.style.overflowY,
      modalMaxHeight: modal.style.maxHeight,
      titleText: title.textContent,
      bodyText: body.textContent,
      scrollTop: modal.scrollTop,
    };

    try {
      title.textContent = prepared.title;
      body.textContent = prepared.body;
      root.hidden = false;
      root.style.pointerEvents = "auto";
      backdrop.hidden = prepared.backdrop !== "global";
      backdrop.style.pointerEvents = prepared.backdrop === "global" ? "auto" : "none";
      backdrop.style.zIndex = "9998";
      modal.hidden = false;
      modal.style.pointerEvents = "auto";
      modal.style.zIndex = "9999";
      modal.style.overflowY = "auto";
      modal.scrollTop = 0;
      this.applyMaxHeight();
      return true;
    } catch {
      root.hidden = previous.rootHidden;
      root.style.pointerEvents = previous.rootPointerEvents;
      backdrop.hidden = previous.backdropHidden;
      backdrop.style.pointerEvents = previous.backdropPointerEvents;
      modal.hidden = previous.modalHidden;
      modal.style.pointerEvents = previous.modalPointerEvents;
      modal.style.zIndex = previous.modalZIndex;
      modal.style.overflowY = previous.modalOverflowY;
      modal.style.maxHeight = previous.modalMaxHeight;
      title.textContent = previous.titleText;
      body.textContent = previous.bodyText;
      modal.scrollTop = previous.scrollTop;
      return false;
    }
  }

  private applyMaxHeight(): void {
    const modal = this.elements.modal;
    if (!hasTarget(modal)) return;
    const size = this.viewport.getSize();
    if (
      !Number.isFinite(size.width) ||
      !Number.isFinite(size.height) ||
      size.height < 0
    ) {
      return;
    }
    const ratio = size.width <= MOBILE_WIDTH
      ? MOBILE_MAX_HEIGHT_RATIO
      : DESKTOP_MAX_HEIGHT_RATIO;
    modal.style.maxHeight = `${size.height * ratio}px`;
  }

  private hideDom(): void {
    const { root, backdrop, modal, title, body } = this.elements;
    if (hasTarget(root)) {
      root.hidden = true;
      root.style.pointerEvents = "none";
    }
    if (hasTarget(backdrop)) {
      backdrop.hidden = true;
      backdrop.style.pointerEvents = "none";
    }
    if (hasTarget(modal)) {
      modal.hidden = true;
      modal.style.pointerEvents = "none";
      modal.scrollTop = 0;
    }
    if (hasTarget(title)) title.textContent = "";
    if (hasTarget(body)) body.textContent = "";
  }

  private emitUserClose(source: UserCloseSource): void {
    const active = this.active;
    if (
      this.destroyed ||
      active === undefined ||
      (source === "backdrop" && active.backdrop !== "global")
    ) {
      return;
    }

    const event: UserCloseEvent = {
      menuId: active.menuId,
      residenceId: active.residenceId,
      source,
    };
    for (const subscriber of [...this.subscribers]) subscriber(event);
  }
}

export function createDomModalGameUi(
  elements: Partial<DomModalElements>,
  viewport: DomModalViewport,
): GameUiPort {
  return new DomModalGameUi(elements, viewport);
}

export function createDomModalGameUiFromOptions(
  options: DomModalGameUiOptions,
): GameUiPort {
  return new DomModalGameUi(options.elements, options.viewport);
}

export type { GameUiPort };

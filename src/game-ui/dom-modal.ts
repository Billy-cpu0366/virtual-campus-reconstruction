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
  outline?: string;
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
  focus?(): void;
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

export interface DomModalKeyboardEvent {
  readonly key: string;
  readonly shiftKey?: boolean;
  preventDefault(): void;
}

export interface DomModalKeyboard {
  subscribe(listener: (event: DomModalKeyboardEvent) => void): () => void;
}

export interface DomModalFocusPort {
  getActiveElement(): DomModalTarget | undefined;
  focus(target: DomModalTarget): void;
  getFocusableElements?(modal: DomModalTarget): readonly DomModalTarget[];
}

export interface DomModalAccessibility {
  readonly keyboard?: DomModalKeyboard;
  readonly focus?: DomModalFocusPort;
  readonly focusRing?: string;
}

export interface DomModalGameUiOptions {
  readonly elements: Partial<DomModalElements>;
  readonly viewport: DomModalViewport;
  readonly accessibility?: DomModalAccessibility;
}

type PreparedView = {
  readonly menuId: GameUiShowRequest["menuId"];
  readonly residenceId: string;
  readonly title: string;
  readonly body: string;
  readonly backdrop: GameUiShowRequest["presentation"]["backdrop"];
};

type ActiveView = PreparedView;

type DomModalSnapshot = {
  readonly rootHidden: boolean;
  readonly rootPointerEvents: string;
  readonly backdropHidden: boolean;
  readonly backdropPointerEvents: string;
  readonly backdropZIndex: string;
  readonly modalHidden: boolean;
  readonly modalPointerEvents: string;
  readonly modalZIndex: string;
  readonly modalOverflowY: string;
  readonly modalMaxHeight: string;
  readonly titleText: string | null;
  readonly bodyText: string | null;
  readonly scrollTop: number;
};

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
  try {
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
  } catch {
    return undefined;
  }
}

export class DomModalGameUi implements GameUiPort {
  private readonly elements: Partial<DomModalElements>;
  private readonly viewport: DomModalViewport;
  private readonly subscribers = new Set<(event: UserCloseEvent) => void>();
  private active: ActiveView | undefined;
  private unsubscribeResize: (() => void) | undefined;
  private unsubscribeKeyboard: (() => void) | undefined;
  private readonly accessibility: DomModalAccessibility | undefined;
  private previousFocus: DomModalTarget | undefined;
  private closeListenerBound = false;
  private backdropListenerBound = false;
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
    try {
      this.applyMaxHeight();
    } catch {
      // Resize failures must not escape the DOM event boundary.
    }
  };

  constructor(
    elements: Partial<DomModalElements>,
    viewport: DomModalViewport,
    accessibility?: DomModalAccessibility,
  ) {
    this.elements = elements;
    this.viewport = viewport;
    this.accessibility = accessibility;
    this.bindListeners();
  }

  show(request: GameUiShowRequest): ShowResult {
    if (this.destroyed) return { status: "destroyed" };

    try {
      if (!this.hasAllTargets()) return { status: "missing-target" };

      const prepared = validateAndBuild(request);
      if (prepared === undefined) return { status: "invalid-payload" };
      if (this.active !== undefined && sameIdentity(this.active, prepared)) {
        return { status: "already-visible" };
      }

      const wasEmpty = this.active === undefined;
      if (wasEmpty) this.captureFocus();
      if (!this.replaceDom(prepared)) {
        if (wasEmpty) this.previousFocus = undefined;
        return { status: "invalid-payload" };
      }
      this.active = prepared;
      this.focusInitialTarget();
      return { status: "shown" };
    } catch {
      return { status: "invalid-payload" };
    }
  }

  hide(request: GameUiHideRequest) {
    if (this.destroyed) return { status: "destroyed" } as const;
    try {
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
      this.restoreFocus();
      return { status: "hidden" } as const;
    } catch {
      return { status: "target-mismatch" } as const;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeListeners();
    try {
      this.hideDom();
    } catch {
      // Destroy remains best effort even if an injected DOM setter fails.
    }
    this.active = undefined;
    this.restoreFocus();
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
    try {
      if (!this.hasAllTargets()) return;
      const { closeButton, backdrop } = this.elements;
      if (!hasTarget(closeButton) || !hasTarget(backdrop)) return;

      this.closeListenerBound = true;
      closeButton.addEventListener("click", this.closeListener);
      this.backdropListenerBound = true;
      backdrop.addEventListener("click", this.backdropListener);
      const unsubscribeResize = this.viewport.subscribeResize(
        this.resizeListener,
      );
      if (typeof unsubscribeResize !== "function") {
        throw new TypeError("resize subscription did not return cleanup");
      }
      this.unsubscribeResize = unsubscribeResize;
      const keyboard = this.accessibility?.keyboard;
      if (keyboard !== undefined) {
        const unsubscribeKeyboard = keyboard.subscribe(this.keyboardListener);
        if (typeof unsubscribeKeyboard !== "function") {
          throw new TypeError("keyboard subscription did not return cleanup");
        }
        this.unsubscribeKeyboard = unsubscribeKeyboard;
      }
      this.listenersBound = true;
    } catch (error) {
      this.removeListeners();
      throw error;
    }
  }

  private removeListeners(): void {
    if (this.closeListenerBound) {
      try {
        this.elements.closeButton?.removeEventListener(
          "click",
          this.closeListener,
        );
      } catch {
        // Listener cleanup is best effort.
      }
    }
    this.closeListenerBound = false;

    if (this.backdropListenerBound) {
      try {
        this.elements.backdrop?.removeEventListener(
          "click",
          this.backdropListener,
        );
      } catch {
        // Listener cleanup is best effort.
      }
    }
    this.backdropListenerBound = false;
    this.listenersBound = false;

    const unsubscribeResize = this.unsubscribeResize;
    this.unsubscribeResize = undefined;
    try {
      unsubscribeResize?.();
    } catch {
      // Destroy is intentionally best effort and remains idempotent.
    }

    const unsubscribeKeyboard = this.unsubscribeKeyboard;
    this.unsubscribeKeyboard = undefined;
    try {
      unsubscribeKeyboard?.();
    } catch {
      // Destroy is intentionally best effort and remains idempotent.
    }
  }

  private replaceDom(prepared: PreparedView): boolean {
    try {
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

      // Resolve every throwable build input before the first DOM mutation.
      const maxHeight = this.getMaxHeight();
      const previous: DomModalSnapshot = {
        rootHidden: root.hidden,
        rootPointerEvents: root.style.pointerEvents,
        backdropHidden: backdrop.hidden,
        backdropPointerEvents: backdrop.style.pointerEvents,
        backdropZIndex: backdrop.style.zIndex,
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
        backdrop.style.pointerEvents =
          prepared.backdrop === "global" ? "auto" : "none";
        backdrop.style.zIndex = "9998";
        modal.hidden = false;
        modal.style.pointerEvents = "auto";
        modal.style.zIndex = "9999";
        modal.style.overflowY = "auto";
        if (maxHeight !== undefined) modal.style.maxHeight = maxHeight;
        modal.scrollTop = 0;
        return true;
      } catch {
        this.restoreDom(root, backdrop, modal, title, body, previous);
        return false;
      }
    } catch {
      return false;
    }
  }

  private restoreDom(
    root: DomModalTarget,
    backdrop: DomModalTarget,
    modal: DomModalTarget,
    title: DomModalTarget,
    body: DomModalTarget,
    previous: DomModalSnapshot,
  ): void {
    const restore = (operation: () => void): void => {
      try {
        operation();
      } catch {
        // Rollback is best effort and must not block the invalid result.
      }
    };

    restore(() => {
      root.hidden = previous.rootHidden;
    });
    restore(() => {
      root.style.pointerEvents = previous.rootPointerEvents;
    });
    restore(() => {
      backdrop.hidden = previous.backdropHidden;
    });
    restore(() => {
      backdrop.style.pointerEvents = previous.backdropPointerEvents;
    });
    restore(() => {
      backdrop.style.zIndex = previous.backdropZIndex;
    });
    restore(() => {
      modal.hidden = previous.modalHidden;
    });
    restore(() => {
      modal.style.pointerEvents = previous.modalPointerEvents;
    });
    restore(() => {
      modal.style.zIndex = previous.modalZIndex;
    });
    restore(() => {
      modal.style.overflowY = previous.modalOverflowY;
    });
    restore(() => {
      modal.style.maxHeight = previous.modalMaxHeight;
    });
    restore(() => {
      title.textContent = previous.titleText;
    });
    restore(() => {
      body.textContent = previous.bodyText;
    });
    restore(() => {
      modal.scrollTop = previous.scrollTop;
    });
  }

  private getMaxHeight(): string | undefined {
    const size = this.viewport.getSize();
    if (
      !Number.isFinite(size.width) ||
      !Number.isFinite(size.height) ||
      size.height < 0
    ) {
      return undefined;
    }
    const ratio = size.width <= MOBILE_WIDTH
      ? MOBILE_MAX_HEIGHT_RATIO
      : DESKTOP_MAX_HEIGHT_RATIO;
    return `${size.height * ratio}px`;
  }

  private applyMaxHeight(): void {
    try {
      const modal = this.elements.modal;
      if (!hasTarget(modal)) return;
      const maxHeight = this.getMaxHeight();
      if (maxHeight !== undefined) modal.style.maxHeight = maxHeight;
    } catch {
      // Resize failures must not escape the DOM event boundary.
    }
  }

  private hideDom(): void {
    const getTarget = (
      key: keyof DomModalElements,
    ): DomModalTarget | undefined => {
      try {
        const target = this.elements[key];
        return hasTarget(target) ? target : undefined;
      } catch {
        return undefined;
      }
    };
    const mutate = (operation: () => void): void => {
      try {
        operation();
      } catch {
        // Hiding is best effort and must continue after an injected failure.
      }
    };
    const root = getTarget("root");
    const backdrop = getTarget("backdrop");
    const modal = getTarget("modal");
    const title = getTarget("title");
    const body = getTarget("body");

    if (root !== undefined) {
      mutate(() => {
        root.hidden = true;
      });
      mutate(() => {
        root.style.pointerEvents = "none";
      });
    }
    if (backdrop !== undefined) {
      mutate(() => {
        backdrop.hidden = true;
      });
      mutate(() => {
        backdrop.style.pointerEvents = "none";
      });
    }
    if (modal !== undefined) {
      mutate(() => {
        modal.hidden = true;
      });
      mutate(() => {
        modal.style.pointerEvents = "none";
      });
      mutate(() => {
        modal.scrollTop = 0;
      });
    }
    if (title !== undefined) mutate(() => {
      title.textContent = "";
    });
    if (body !== undefined) mutate(() => {
      body.textContent = "";
    });
  }

  private readonly keyboardListener = (event: DomModalKeyboardEvent): void => {
    if (this.destroyed || this.active === undefined) return;
    if (event.key === "Escape") {
      try {
        event.preventDefault();
      } catch {
        // Continue to the same user-close contract even if prevention fails.
      }
      this.emitUserClose("close-button");
      return;
    }
    if (event.key !== "Tab") return;
    const focus = this.accessibility?.focus;
    const modal = this.elements.modal;
    if (focus === undefined || !hasTarget(modal) || focus.getFocusableElements === undefined) {
      return;
    }
    let targets: readonly DomModalTarget[];
    try {
      targets = focus.getFocusableElements(modal).filter(hasTarget);
    } catch {
      return;
    }
    if (targets.length === 0) return;

    let activeIndex = -1;
    try {
      const current = focus.getActiveElement();
      activeIndex = current === undefined ? -1 : targets.indexOf(current);
    } catch {
      activeIndex = -1;
    }
    const backwards = event.shiftKey === true;
    const nextIndex =
      activeIndex < 0
        ? backwards
          ? targets.length - 1
          : 0
        : (activeIndex + (backwards ? -1 : 1) + targets.length) %
          targets.length;
    const nextTarget = targets[nextIndex];
    if (nextTarget === undefined) return;
    try {
      event.preventDefault();
      focus.focus(nextTarget);
    } catch {
      // Focus remains best effort at the DOM boundary.
    }
  };

  private captureFocus(): void {
    const focus = this.accessibility?.focus;
    if (focus === undefined) return;
    try {
      this.previousFocus = focus.getActiveElement();
    } catch {
      this.previousFocus = undefined;
    }
  }

  private focusInitialTarget(): void {
    const target = this.elements.closeButton;
    if (!hasTarget(target)) return;
    try {
      target.style.outline = this.accessibility?.focusRing ?? "3px solid #0b57d0";
    } catch {
      // Continue to focus even if the injected style setter fails.
    }
    try {
      if (this.accessibility?.focus !== undefined) {
        this.accessibility.focus.focus(target);
      } else {
        target.focus?.();
      }
    } catch {
      // Focus is best effort; the modal remains visible and keyboard reachable.
    }
  }

  private restoreFocus(): void {
    const previous = this.previousFocus;
    this.previousFocus = undefined;
    if (previous === undefined) return;
    try {
      if (this.accessibility?.focus !== undefined) {
        this.accessibility.focus.focus(previous);
      } else {
        previous.focus?.();
      }
    } catch {
      // Focus return must not block modal cleanup.
    }
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
  accessibility?: DomModalAccessibility,
): GameUiPort {
  return new DomModalGameUi(elements, viewport, accessibility);
}

export function createDomModalGameUiFromOptions(
  options: DomModalGameUiOptions,
): GameUiPort {
  return new DomModalGameUi(
    options.elements,
    options.viewport,
    options.accessibility,
  );
}

export type { GameUiPort };

import {
  CONTENT_MENU_IDS,
  type GameUiContentImage,
  type GameUiContentLink,
  type GameUiContentSection,
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
  visibility?: string;
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

export type DomModalContentElement =
  | "section"
  | "h3"
  | "p"
  | "figure"
  | "img"
  | "span"
  | "a"
  | "ul"
  | "li";

export interface DomModalContentNode extends DomModalTarget {
  appendChild(child: DomModalContentNode): void;
  setAttribute(name: string, value: string): void;
}

export interface DomModalContentPort {
  createElement(kind: DomModalContentElement): DomModalContentNode;
  appendChildren(
    parent: DomModalContentNode,
    children: readonly DomModalContentNode[],
  ): void;
  replaceChildren(
    parent: DomModalTarget,
    children: readonly DomModalContentNode[],
  ): void;
}

export interface DomModalContentDocument {
  createElement(kind: DomModalContentElement): DomModalContentNode;
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
  readonly content?: DomModalContentPort;
}

type PreparedView = {
  readonly menuId: GameUiShowRequest["menuId"];
  readonly residenceId: string;
  readonly title: string;
  readonly body: string;
  readonly sections?: readonly GameUiContentSection[];
  readonly backdrop: GameUiShowRequest["presentation"]["backdrop"];
};

type PreparedRichImage = {
  readonly image: DomModalContentNode;
  readonly fallback: DomModalContentNode;
  readonly menuId: PreparedView["menuId"];
  readonly residenceId: string;
};

type PreparedRichContent = {
  readonly nodes: readonly DomModalContentNode[];
  readonly images: readonly PreparedRichImage[];
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
const RICH_CONTENT_KEYS = [
  "heading",
  "paragraphs",
  "image",
  "links",
  "tags",
] as const;
const IMAGE_KEYS = ["src", "alt", "fallbackText"] as const;
const LINK_KEYS = ["label", "href"] as const;

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

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isTextArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(hasText);
}

function isLocalImageSource(value: unknown): value is string {
  if (!hasText(value) || value !== value.trim() || value.includes("\\")) {
    return false;
  }
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(value);
}

function isExternalHttpLink(value: unknown): value is string {
  if (!hasText(value) || value !== value.trim()) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname !== ""
    );
  } catch {
    return false;
  }
}

function prepareContentSection(
  value: unknown,
): GameUiContentSection | undefined {
  try {
    if (!isRecord(value)) return undefined;
    if (
      Object.keys(value).length === 0 ||
      !hasOnlyKeys(value, RICH_CONTENT_KEYS)
    ) {
      return undefined;
    }

    const section: {
      heading?: string;
      paragraphs?: readonly string[];
      image?: GameUiContentImage;
      links?: readonly GameUiContentLink[];
      tags?: readonly string[];
    } = {};

    if ("heading" in value) {
      if (!hasText(value.heading)) return undefined;
      section.heading = value.heading;
    }
    if ("paragraphs" in value) {
      if (!isTextArray(value.paragraphs)) return undefined;
      section.paragraphs = [...value.paragraphs];
    }
    if ("image" in value) {
      const image = value.image;
      if (
        !isRecord(image) ||
        !hasOnlyKeys(image, IMAGE_KEYS) ||
        !isLocalImageSource(image.src) ||
        !hasText(image.alt) ||
        !hasText(image.fallbackText)
      ) {
        return undefined;
      }
      section.image = {
        src: image.src,
        alt: image.alt,
        fallbackText: image.fallbackText,
      };
    }
    if ("links" in value) {
      if (!Array.isArray(value.links) || value.links.length === 0) {
        return undefined;
      }
      const links: GameUiContentLink[] = [];
      for (const link of value.links) {
        if (
          !isRecord(link) ||
          !hasOnlyKeys(link, LINK_KEYS) ||
          !hasText(link.label) ||
          !isExternalHttpLink(link.href)
        ) {
          return undefined;
        }
        links.push({ label: link.label, href: link.href });
      }
      section.links = links;
    }
    if ("tags" in value) {
      if (!isTextArray(value.tags)) return undefined;
      section.tags = [...value.tags];
    }

    return section;
  } catch {
    return undefined;
  }
}

function prepareContentSections(
  value: unknown,
): readonly GameUiContentSection[] | undefined {
  try {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    const sections: GameUiContentSection[] = [];
    for (const section of value) {
      const prepared = prepareContentSection(section);
      if (prepared === undefined) return undefined;
      sections.push(prepared);
    }
    return sections;
  } catch {
    return undefined;
  }
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

    let sections: readonly GameUiContentSection[] | undefined;
    if ("sections" in payload) {
      sections = prepareContentSections(payload.sections);
      if (sections === undefined) return undefined;
    }

    return {
      menuId: request.menuId,
      residenceId: request.residenceId,
      title: payload.title,
      body: payload.body.join("\n\n"),
      ...(sections === undefined ? {} : { sections }),
      backdrop: request.presentation.backdrop,
    };
  } catch {
    return undefined;
  }
}

export class DomModalGameUi implements GameUiPort {
  private readonly elements: Partial<DomModalElements>;
  private readonly viewport: DomModalViewport;
  private readonly content: DomModalContentPort | undefined;
  private readonly subscribers = new Set<(event: UserCloseEvent) => void>();
  private readonly richImageListeners: Array<{
    readonly image: DomModalContentNode;
    readonly listener: (event: unknown) => void;
  }> = [];
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
    content?: DomModalContentPort,
  ) {
    this.elements = elements;
    this.viewport = viewport;
    this.accessibility = accessibility;
    this.content = content ?? createDefaultDomModalContentPort(elements.body);
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
      const renderedContent = this.replaceDom(prepared);
      if (renderedContent === null) {
        if (wasEmpty) this.previousFocus = undefined;
        return { status: "invalid-payload" };
      }
      this.clearRichImageListeners();
      this.active = prepared;
      this.bindRichImageListeners(renderedContent);
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
      this.clearRichImageListeners();
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
    this.clearRichImageListeners();
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

  private replaceDom(
    prepared: PreparedView,
  ): PreparedRichContent | undefined | null {
    try {
      const { root, backdrop, modal, title, body } = this.elements;
      if (
        !hasTarget(root) ||
        !hasTarget(backdrop) ||
        !hasTarget(modal) ||
        !hasTarget(title) ||
        !hasTarget(body)
      ) {
        return null;
      }

      // Resolve every throwable build input before the first DOM mutation.
      const maxHeight = this.getMaxHeight();
      const richContent = this.prepareRichContent(prepared);
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
        if (this.content !== undefined) {
          this.content.replaceChildren(body, richContent?.nodes ?? []);
        }
        if (richContent === undefined) body.textContent = prepared.body;
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
        return richContent;
      } catch {
        this.restoreDom(root, backdrop, modal, title, body, previous);
        return null;
      }
    } catch {
      return null;
    }
  }

  private prepareRichContent(
    prepared: PreparedView,
  ): PreparedRichContent | undefined {
    const sections = prepared.sections;
    const content = this.content;
    if (sections === undefined || content === undefined) return undefined;

    try {
      const nodes: DomModalContentNode[] = [];
      const images: PreparedRichImage[] = [];

      for (const section of sections) {
        const sectionNode = content.createElement("section");
        const sectionChildren: DomModalContentNode[] = [];

        if (section.heading !== undefined) {
          const heading = content.createElement("h3");
          heading.textContent = section.heading;
          sectionChildren.push(heading);
        }
        if (section.paragraphs !== undefined) {
          for (const paragraphText of section.paragraphs) {
            const paragraph = content.createElement("p");
            paragraph.textContent = paragraphText;
            sectionChildren.push(paragraph);
          }
        }
        if (section.image !== undefined) {
          const figure = content.createElement("figure");
          const image = content.createElement("img");
          const fallback = content.createElement("span");
          image.setAttribute("src", section.image.src);
          image.setAttribute("alt", section.image.alt);
          image.hidden = false;
          image.style.visibility = "visible";
          fallback.textContent = section.image.fallbackText;
          fallback.hidden = true;
          fallback.style.visibility = "visible";
          content.appendChildren(figure, [image, fallback]);
          sectionChildren.push(figure);
          images.push({
            image,
            fallback,
            menuId: prepared.menuId,
            residenceId: prepared.residenceId,
          });
        }
        if (section.links !== undefined) {
          const links = content.createElement("ul");
          const linkNodes: DomModalContentNode[] = [];
          for (const link of section.links) {
            const item = content.createElement("li");
            const anchor = content.createElement("a");
            anchor.textContent = link.label;
            anchor.setAttribute("href", link.href);
            anchor.setAttribute("target", "_blank");
            anchor.setAttribute("rel", "noopener noreferrer");
            content.appendChildren(item, [anchor]);
            linkNodes.push(item);
          }
          content.appendChildren(links, linkNodes);
          sectionChildren.push(links);
        }
        if (section.tags !== undefined) {
          const tags = content.createElement("ul");
          const tagNodes: DomModalContentNode[] = [];
          for (const tag of section.tags) {
            const item = content.createElement("li");
            item.textContent = tag;
            tagNodes.push(item);
          }
          content.appendChildren(tags, tagNodes);
          sectionChildren.push(tags);
        }

        content.appendChildren(sectionNode, sectionChildren);
        nodes.push(sectionNode);
      }

      return { nodes, images };
    } catch {
      // If an injected DOM adapter cannot stage rich nodes, use body fallback.
      return undefined;
    }
  }

  private bindRichImageListeners(
    content: PreparedRichContent | undefined,
  ): void {
    if (content === undefined) return;
    for (const image of content.images) {
      const listener = (): void => {
        this.handleRichImageError(image);
      };
      try {
        image.image.addEventListener("error", listener);
        this.richImageListeners.push({ image: image.image, listener });
      } catch {
        // A single optional image listener cannot block the modal.
      }
    }
  }

  private handleRichImageError(image: PreparedRichImage): void {
    const active = this.active;
    if (
      this.destroyed ||
      active === undefined ||
      active.menuId !== image.menuId ||
      active.residenceId !== image.residenceId
    ) {
      return;
    }
    try {
      image.image.hidden = false;
      image.image.style.visibility = "hidden";
      image.fallback.hidden = false;
      image.fallback.style.visibility = "visible";
    } catch {
      // Image failure remains optional and cannot close or replace the modal.
    }
  }

  private clearRichImageListeners(): void {
    for (const { image, listener } of this.richImageListeners.splice(0)) {
      try {
        image.removeEventListener("error", listener);
      } catch {
        // Best effort cleanup for detached optional image nodes.
      }
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

function createDefaultDomModalContentPort(
  body: DomModalTarget | undefined,
): DomModalContentPort | undefined {
  if (typeof document === "undefined") return undefined;
  const target = body as
    | (DomModalTarget & {
        replaceChildren?: (...children: DomModalContentNode[]) => void;
      })
    | undefined;
  if (typeof target?.replaceChildren !== "function") return undefined;
  try {
    return createDomModalContentPort({
      createElement: (kind) =>
        document.createElement(kind) as unknown as DomModalContentNode,
    });
  } catch {
    return undefined;
  }
}

export function createDomModalContentPort(
  document: DomModalContentDocument,
): DomModalContentPort {
  return {
    createElement: (kind) => document.createElement(kind),
    appendChildren: (parent, children) => {
      for (const child of children) parent.appendChild(child);
    },
    replaceChildren: (parent, children) => {
      const target = parent as DomModalTarget & {
        replaceChildren?: (...children: DomModalContentNode[]) => void;
      };
      if (typeof target.replaceChildren !== "function") {
        throw new TypeError("content target cannot replace children");
      }
      target.replaceChildren(...children);
    },
  };
}

export function createDomModalGameUi(
  elements: Partial<DomModalElements>,
  viewport: DomModalViewport,
  accessibility?: DomModalAccessibility,
  content?: DomModalContentPort,
): GameUiPort {
  return new DomModalGameUi(elements, viewport, accessibility, content);
}

export function createDomModalGameUiFromOptions(
  options: DomModalGameUiOptions,
): GameUiPort {
  return new DomModalGameUi(
    options.elements,
    options.viewport,
    options.accessibility,
    options.content,
  );
}

export type { GameUiPort };

import { describe, expect, it } from "vitest";

import {
  DomModalGameUi,
  type DomModalElements,
  type DomModalTarget,
  type DomModalViewport,
} from "../../src/game-ui/index.js";
import type {
  GameUiHideRequest,
  GameUiShowRequest,
  UserCloseEvent,
} from "../../src/content/contract.js";

class FakeTarget implements DomModalTarget {
  hidden = true;
  textContent: string | null = null;
  scrollTop = 0;
  style: DomModalTarget["style"] = {
    maxHeight: "",
    overflowY: "",
    pointerEvents: "none",
    zIndex: "",
  };
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  addCount = 0;
  removeCount = 0;
  throwOnAdd = false;

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.addCount += 1;
    if (this.throwOnAdd) throw new Error("add failed");
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void {
    this.removeCount += 1;
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({});
  }

  throwOnStyleSet(property: keyof DomModalTarget["style"]): void {
    const style = this.style;
    const value = style[property];
    Object.defineProperty(style, property, {
      configurable: true,
      get: () => value,
      set: () => {
        throw new Error(`set ${String(property)} failed`);
      },
    });
  }

  throwAfterStyleSetOnce(property: keyof DomModalTarget["style"]): void {
    const style = this.style;
    let value = style[property];
    let shouldThrow = true;
    Object.defineProperty(style, property, {
      configurable: true,
      get: () => value,
      set: (next: string) => {
        value = next;
        if (shouldThrow) {
          shouldThrow = false;
          throw new Error(`set ${String(property)} failed`);
        }
      },
    });
  }

  throwOnTextContentSet(): void {
    const value = this.textContent;
    Object.defineProperty(this, "textContent", {
      configurable: true,
      get: () => value,
      set: () => {
        throw new Error("set textContent failed");
      },
    });
  }
}

class FakeViewport implements DomModalViewport {
  size = { width: 1024, height: 600 };
  subscribeCount = 0;
  unsubscribeCount = 0;
  throwOnSubscribe = false;
  throwOnGetSize = false;
  private listener: (() => void) | undefined;

  getSize(): { width: number; height: number } {
    if (this.throwOnGetSize) throw new Error("size getter failed");
    return this.size;
  }

  subscribeResize(listener: () => void): () => void {
    this.subscribeCount += 1;
    if (this.throwOnSubscribe) throw new Error("subscribe failed");
    this.listener = listener;
    return () => {
      this.unsubscribeCount += 1;
      this.listener = undefined;
    };
  }

  resizeListenerCount(): number {
    return this.listener === undefined ? 0 : 1;
  }

  resize(width: number, height: number): void {
    this.size = { width, height };
    this.listener?.();
  }
}

type FakeElements = {
  [Key in keyof DomModalElements]: FakeTarget;
};

function makeUi(): {
  ui: DomModalGameUi;
  elements: FakeElements;
  viewport: FakeViewport;
} {
  const elements: FakeElements = {
    root: new FakeTarget(),
    backdrop: new FakeTarget(),
    modal: new FakeTarget(),
    title: new FakeTarget(),
    body: new FakeTarget(),
    closeButton: new FakeTarget(),
  };
  const viewport = new FakeViewport();
  return { ui: new DomModalGameUi(elements, viewport), elements, viewport };
}

function showRequest(
  menuId: GameUiShowRequest["menuId"] = "about",
  residenceId = "residence-1",
  backdrop: GameUiShowRequest["presentation"]["backdrop"] = "none",
): GameUiShowRequest {
  return {
    menuId,
    residenceId,
    payload: {
      menuId,
      title: `Title ${menuId}`,
      body: ["first", "second"],
    },
    presentation: { backdrop },
  };
}

function hideRequest(
  menuId: GameUiHideRequest["menuId"],
  residenceId: string,
): GameUiHideRequest {
  return { menuId, residenceId, reason: "leave" };
}

describe("DomModalGameUi", () => {
  it("rejects missing targets without changing the injected DOM", () => {
    const root = new FakeTarget();
    const viewport = new FakeViewport();
    const ui = new DomModalGameUi({ root }, viewport);

    expect(ui.show(showRequest())).toEqual({ status: "missing-target" });
    expect(root.hidden).toBe(true);
    expect(root.style.pointerEvents).toBe("none");
    expect(viewport.subscribeCount).toBe(0);
  });

  it("validates identity and writes untrusted content as text", () => {
    const { ui, elements } = makeUi();
    const request: GameUiShowRequest = {
      ...showRequest(),
      payload: {
        ...showRequest().payload,
        title: "<img src=x onerror=alert(1)>",
        body: ["<script>bad()</script>"],
      },
    };

    expect(ui.show(request)).toEqual({ status: "shown" });
    expect(elements.title.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(elements.body.textContent).toBe("<script>bad()</script>");

    expect(
      ui.show({
        ...showRequest(),
        payload: { ...showRequest().payload, menuId: "cv" },
      }),
    ).toEqual({ status: "invalid-payload" });
    expect(
      ui.show({
        ...showRequest(),
        residenceId: "",
      }),
    ).toEqual({ status: "invalid-payload" });
    expect(
      ui.show({
        ...showRequest(),
        payload: { ...showRequest().payload, body: [] },
      }),
    ).toEqual({ status: "invalid-payload" });
    expect(
      ui.show(null as unknown as GameUiShowRequest),
    ).toEqual({ status: "invalid-payload" });
  });

  it("swallows throwing payload getters, every, and join without changing the active view", () => {
    const { ui, elements } = makeUi();
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "shown",
    });
    elements.modal.scrollTop = 41;

    const throwingGetter = {
      ...showRequest("cv", "new"),
      get menuId(): GameUiShowRequest["menuId"] {
        throw new Error("menu getter failed");
      },
    } as unknown as GameUiShowRequest;
    const throwingEveryBody = ["ok"];
    Object.defineProperty(throwingEveryBody, "every", {
      value: () => {
        throw new Error("every failed");
      },
    });
    const throwingEvery = {
      ...showRequest("cv", "new"),
      payload: { ...showRequest("cv", "new").payload, body: throwingEveryBody },
    } as unknown as GameUiShowRequest;
    const throwingJoinBody = ["ok"];
    Object.defineProperty(throwingJoinBody, "join", {
      value: () => {
        throw new Error("join failed");
      },
    });
    const throwingJoin = {
      ...showRequest("cv", "new"),
      payload: { ...showRequest("cv", "new").payload, body: throwingJoinBody },
    } as unknown as GameUiShowRequest;

    for (const request of [throwingGetter, throwingEvery, throwingJoin]) {
      expect(ui.show(request)).toEqual({ status: "invalid-payload" });
    }
    expect(elements.title.textContent).toBe("Title about");
    expect(elements.body.textContent).toBe("first\n\nsecond");
    expect(elements.modal.scrollTop).toBe(41);
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "already-visible",
    });
  });

  it("rejects a throwing DOM build before any mutation", () => {
    const { ui, elements, viewport } = makeUi();
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "shown",
    });
    elements.modal.scrollTop = 53;
    viewport.throwOnGetSize = true;

    expect(ui.show(showRequest("cv", "new"))).toEqual({
      status: "invalid-payload",
    });
    expect(elements.title.textContent).toBe("Title about");
    expect(elements.body.textContent).toBe("first\n\nsecond");
    expect(elements.root.hidden).toBe(false);
    expect(elements.modal.scrollTop).toBe(53);
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "already-visible",
    });
  });

  it("rolls back every replaced field when a DOM setter throws", () => {
    const { ui, elements } = makeUi();
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "shown",
    });
    elements.root.hidden = true;
    elements.root.style.pointerEvents = "old-root";
    elements.backdrop.hidden = false;
    elements.backdrop.style.pointerEvents = "old-backdrop-events";
    elements.backdrop.style.zIndex = "old-backdrop-z";
    elements.modal.style.zIndex = "old-modal-z";
    elements.modal.style.overflowY = "old-overflow";
    elements.modal.style.maxHeight = "old-height";
    elements.modal.scrollTop = 53;

    elements.backdrop.throwAfterStyleSetOnce("zIndex");
    expect(ui.show(showRequest("cv", "new", "global"))).toEqual({
      status: "invalid-payload",
    });
    expect(elements.root.hidden).toBe(true);
    expect(elements.root.style.pointerEvents).toBe("old-root");
    expect(elements.backdrop.hidden).toBe(false);
    expect(elements.backdrop.style.pointerEvents).toBe("old-backdrop-events");
    expect(elements.backdrop.style.zIndex).toBe("old-backdrop-z");
    expect(elements.modal.style.zIndex).toBe("old-modal-z");
    expect(elements.modal.style.overflowY).toBe("old-overflow");
    expect(elements.modal.style.maxHeight).toBe("old-height");
    expect(elements.modal.scrollTop).toBe(53);
    expect(elements.title.textContent).toBe("Title about");
    expect(elements.body.textContent).toBe("first\n\nsecond");
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "already-visible",
    });

    elements.modal.throwOnStyleSet("maxHeight");
    expect(ui.show(showRequest("cv", "new"))).toEqual({
      status: "invalid-payload",
    });
    expect(elements.title.textContent).toBe("Title about");
    expect(elements.modal.scrollTop).toBe(53);
  });

  it("cleans up partial listener registration when subscription fails", () => {
    const elements: FakeElements = {
      root: new FakeTarget(),
      backdrop: new FakeTarget(),
      modal: new FakeTarget(),
      title: new FakeTarget(),
      body: new FakeTarget(),
      closeButton: new FakeTarget(),
    };
    const viewport = new FakeViewport();
    viewport.throwOnSubscribe = true;

    expect(() => new DomModalGameUi(elements, viewport)).toThrow(
      "subscribe failed",
    );
    expect(elements.closeButton.listeners.get("click")?.size ?? 0).toBe(0);
    expect(elements.backdrop.listeners.get("click")?.size ?? 0).toBe(0);
    expect(viewport.resizeListenerCount()).toBe(0);
    expect(elements.closeButton.removeCount).toBe(1);
    expect(elements.backdrop.removeCount).toBe(1);
    expect(viewport.unsubscribeCount).toBe(0);
  });

  it("cleans up close listeners when a later DOM registration fails", () => {
    const elements: FakeElements = {
      root: new FakeTarget(),
      backdrop: new FakeTarget(),
      modal: new FakeTarget(),
      title: new FakeTarget(),
      body: new FakeTarget(),
      closeButton: new FakeTarget(),
    };
    elements.backdrop.throwOnAdd = true;
    const viewport = new FakeViewport();

    expect(() => new DomModalGameUi(elements, viewport)).toThrow(
      "add failed",
    );
    expect(elements.closeButton.listeners.get("click")?.size ?? 0).toBe(0);
    expect(elements.backdrop.listeners.get("click")?.size ?? 0).toBe(0);
    expect(elements.closeButton.removeCount).toBe(1);
    expect(viewport.subscribeCount).toBe(0);
  });

  it("preserves scroll for same identity and atomically replaces another identity", () => {
    const { ui, elements } = makeUi();
    expect(ui.show(showRequest("about", "same"))).toEqual({
      status: "shown",
    });
    elements.modal.scrollTop = 37;

    expect(ui.show(showRequest("about", "same"))).toEqual({
      status: "already-visible",
    });
    expect(elements.modal.scrollTop).toBe(37);

    expect(ui.show(showRequest("cv", "different"))).toEqual({
      status: "shown",
    });
    expect(elements.title.textContent).toBe("Title cv");
    expect(elements.modal.scrollTop).toBe(0);
  });

  it("keeps old content and scroll when replacement validation fails", () => {
    const { ui, elements } = makeUi();
    expect(ui.show(showRequest("about", "old"))).toEqual({
      status: "shown",
    });
    elements.modal.scrollTop = 49;
    const invalid: GameUiShowRequest = {
      ...showRequest("cv", "new"),
      payload: {
        ...showRequest("cv", "new").payload,
        body: ["ok", 1] as unknown as readonly string[],
      },
    };

    expect(ui.show(invalid)).toEqual({ status: "invalid-payload" });
    expect(elements.title.textContent).toBe("Title about");
    expect(elements.body.textContent).toBe("first\n\nsecond");
    expect(elements.modal.scrollTop).toBe(49);
  });

  it("uses standard and memo backdrop policies with the required layers", () => {
    const { ui, elements } = makeUi();
    expect(ui.show(showRequest("about", "standard", "none"))).toEqual({
      status: "shown",
    });
    expect(elements.root.hidden).toBe(false);
    expect(elements.root.style.pointerEvents).toBe("auto");
    expect(elements.backdrop.hidden).toBe(true);
    expect(elements.backdrop.style.pointerEvents).toBe("none");
    expect(elements.backdrop.style.zIndex).toBe("9998");
    expect(elements.modal.style.zIndex).toBe("9999");
    expect(elements.modal.style.pointerEvents).toBe("auto");
    expect(elements.modal.style.overflowY).toBe("auto");

    expect(ui.show(showRequest("memo1", "memo", "global"))).toEqual({
      status: "shown",
    });
    expect(elements.backdrop.hidden).toBe(false);
    expect(elements.backdrop.style.pointerEvents).toBe("auto");
  });

  it("emits only current close actions and never emits programmatic hide", () => {
    const { ui, elements } = makeUi();
    const events: UserCloseEvent[] = [];
    ui.subscribeUserClose((event) => events.push(event));

    expect(ui.show(showRequest("about", "standard", "none"))).toEqual({
      status: "shown",
    });
    elements.backdrop.dispatch("click");
    elements.closeButton.dispatch("click");
    expect(events).toEqual([
      { menuId: "about", residenceId: "standard", source: "close-button" },
    ]);
    expect(ui.hide(hideRequest("about", "standard"))).toEqual({
      status: "hidden",
    });
    expect(events).toHaveLength(1);

    expect(ui.show(showRequest("memo1", "memo", "global"))).toEqual({
      status: "shown",
    });
    elements.backdrop.dispatch("click");
    expect(events.at(-1)).toEqual({
      menuId: "memo1",
      residenceId: "memo",
      source: "backdrop",
    });
  });

  it("rejects stale hide and hides matching UI without a close event", () => {
    const { ui, elements } = makeUi();
    const events: UserCloseEvent[] = [];
    ui.subscribeUserClose((event) => events.push(event));
    expect(ui.show(showRequest("about", "current"))).toEqual({
      status: "shown",
    });
    expect(ui.show(showRequest("cv", "new"))).toEqual({
      status: "shown",
    });

    expect(ui.hide(hideRequest("about", "stale"))).toEqual({
      status: "target-mismatch",
    });
    expect(elements.root.hidden).toBe(false);
    expect(elements.title.textContent).toBe("Title cv");
    expect(ui.hide(hideRequest("cv", "new"))).toEqual({
      status: "hidden",
    });
    expect(elements.root.hidden).toBe(true);
    expect(elements.root.style.pointerEvents).toBe("none");
    expect(events).toEqual([]);
    expect(ui.hide(hideRequest("about", "current"))).toEqual({
      status: "already-hidden",
    });
  });

  it("updates desktop/mobile max height at the inclusive threshold", () => {
    const { ui, elements, viewport } = makeUi();
    expect(ui.show(showRequest())).toEqual({ status: "shown" });
    expect(elements.modal.style.maxHeight).toBe("540px");

    viewport.resize(767, 600);
    expect(elements.modal.style.maxHeight).toBe("420px");
    viewport.resize(768, 1000);
    expect(elements.modal.style.maxHeight).toBe("900px");
  });

  it("keeps destroy best effort when DOM cleanup setters throw", () => {
    const { ui, elements, viewport } = makeUi();
    expect(ui.show(showRequest())).toEqual({ status: "shown" });
    elements.root.throwOnStyleSet("pointerEvents");
    elements.title.throwOnTextContentSet();

    expect(() => ui.destroy()).not.toThrow();
    expect(viewport.unsubscribeCount).toBe(1);
    expect(elements.closeButton.removeCount).toBe(1);
    expect(elements.backdrop.removeCount).toBe(1);
    expect(ui.show(showRequest())).toEqual({ status: "destroyed" });
  });

  it("unsubscribes safely and destroys all listeners idempotently", () => {
    const { ui, elements, viewport } = makeUi();
    const unsubscribe = ui.subscribeUserClose(() => undefined);
    expect(viewport.subscribeCount).toBe(1);
    expect(elements.closeButton.addCount).toBe(1);
    expect(elements.backdrop.addCount).toBe(1);
    expect(ui.show(showRequest())).toEqual({ status: "shown" });
    unsubscribe();
    unsubscribe();
    ui.destroy();
    ui.destroy();

    expect(elements.closeButton.removeCount).toBe(1);
    expect(elements.backdrop.removeCount).toBe(1);
    expect(viewport.unsubscribeCount).toBe(1);
    expect(elements.root.hidden).toBe(true);
    expect(ui.show(showRequest())).toEqual({ status: "destroyed" });
    expect(ui.hide(hideRequest("about", "residence-1"))).toEqual({
      status: "destroyed",
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  DomModalGameUi,
  type DomModalElements,
  type DomModalKeyboard,
  type DomModalKeyboardEvent,
  type DomModalTarget,
  type DomModalViewport,
} from "../../src/game-ui/index.js";
import type { GameUiShowRequest } from "../../src/content/contract.js";

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

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  focus(): void {
    // FocusPort records focus in this test.
  }
}

class FakeViewport implements DomModalViewport {
  getSize(): { width: number; height: number } {
    return { width: 1024, height: 600 };
  }

  subscribeResize(): () => void {
    return () => undefined;
  }
}

class FakeKeyboard implements DomModalKeyboard {
  private listener: ((event: DomModalKeyboardEvent) => void) | undefined;

  subscribe(listener: (event: DomModalKeyboardEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  emit(key: string, shiftKey = false): { prevented: boolean } {
    let prevented = false;
    this.listener?.({
      key,
      shiftKey,
      preventDefault: () => {
        prevented = true;
      },
    });
    return { prevented };
  }
}

function makeElements(): { elements: DomModalElements; targets: FakeTarget[] } {
  const targets = [
    new FakeTarget(),
    new FakeTarget(),
    new FakeTarget(),
    new FakeTarget(),
    new FakeTarget(),
    new FakeTarget(),
  ];
  const root = targets[0]!;
  const backdrop = targets[1]!;
  const modal = targets[2]!;
  const title = targets[3]!;
  const body = targets[4]!;
  const closeButton = targets[5]!;
  return {
    elements: { root, backdrop, modal, title, body, closeButton },
    targets,
  };
}

function request(): GameUiShowRequest {
  return {
    menuId: "about",
    residenceId: "residence-1",
    payload: { menuId: "about", title: "About", body: ["Body"] },
    presentation: { backdrop: "none" },
  };
}

describe("DomModalGameUi accessibility foundation", () => {
  it("focuses close on show, closes through Escape, and restores the previous focus", () => {
    const { elements } = makeElements();
    const previous = new FakeTarget();
    const keyboard = new FakeKeyboard();
    let active: DomModalTarget | undefined = previous;
    const focused: DomModalTarget[] = [];
    const ui = new DomModalGameUi(elements, new FakeViewport(), {
      keyboard,
      focus: {
        getActiveElement: () => active,
        focus: (target) => {
          active = target;
          focused.push(target);
        },
      },
    });
    const events: string[] = [];
    ui.subscribeUserClose((event) => {
      events.push(event.source);
      ui.hide({
        menuId: event.menuId,
        residenceId: event.residenceId,
        reason: "user-close",
      });
    });

    expect(ui.show(request())).toEqual({ status: "shown" });
    expect(focused).toEqual([elements.closeButton]);
    expect(elements.closeButton.style.outline).toContain("solid");

    expect(keyboard.emit("Escape").prevented).toBe(true);
    expect(events).toEqual(["close-button"]);
    expect(active).toBe(previous);
    expect(elements.root.hidden).toBe(true);
  });

  it("keeps Tab focus inside the modal and removes keyboard cleanup once", () => {
    const { elements } = makeElements();
    const second = new FakeTarget();
    const keyboard = new FakeKeyboard();
    let active: DomModalTarget | undefined = elements.closeButton;
    const focused: DomModalTarget[] = [];
    const ui = new DomModalGameUi(elements, new FakeViewport(), {
      keyboard,
      focus: {
        getActiveElement: () => active,
        focus: (target) => {
          active = target;
          focused.push(target);
        },
        getFocusableElements: () => [elements.closeButton, second],
      },
    });

    ui.show(request());
    active = elements.closeButton;
    expect(keyboard.emit("Tab").prevented).toBe(true);
    expect(active).toBe(second);
    expect(keyboard.emit("Tab", true).prevented).toBe(true);
    expect(active).toBe(elements.closeButton);
    ui.destroy();
    ui.destroy();
    expect(keyboard.emit("Escape").prevented).toBe(false);
    expect(focused).toEqual([
      elements.closeButton,
      second,
      elements.closeButton,
      elements.closeButton,
    ]);
  });
});

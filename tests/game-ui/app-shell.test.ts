import { describe, expect, it } from "vitest";

import {
  DomAppUi,
  type DomAppElements,
  type DomAppImageTarget,
  type DomAppTarget,
  type DomAppViewport,
} from "../../src/game-ui/index.js";

class FakeTarget implements DomAppTarget {
  hidden = true;
  textContent: string | null = null;
  style: Record<string, string> = {};
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  addCount = 0;
  removeCount = 0;

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.addCount += 1;
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

  focus(): void {
    // The focus port records focus in these tests.
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeImage extends FakeTarget implements DomAppImageTarget {
  src = "/image.webp";
  alt = "Original";
}

class FakeViewport implements DomAppViewport {
  size = { width: 1024, height: 600 };
  subscribeCount = 0;
  unsubscribeCount = 0;
  private listener: (() => void) | undefined;

  getSize(): { width: number; height: number } {
    return this.size;
  }

  subscribeResize(listener: () => void): () => void {
    this.subscribeCount += 1;
    this.listener = listener;
    return () => {
      this.unsubscribeCount += 1;
      this.listener = undefined;
    };
  }

  resize(width: number, height: number): void {
    this.size = { width, height };
    this.listener?.();
  }
}

type FakeElements = {
  [Key in keyof DomAppElements]: FakeTarget;
};

function makeElements(): FakeElements {
  return {
    loading: new FakeTarget(),
    progressBar: new FakeTarget(),
    progressText: new FakeTarget(),
    play: new FakeTarget(),
    error: new FakeTarget(),
    errorText: new FakeTarget(),
    retry: new FakeTarget(),
  };
}

describe("DomAppUi", () => {
  it("renders real loader progress and resets only on a new generation", () => {
    const elements = makeElements();
    const viewport = new FakeViewport();
    const ui = new DomAppUi({ elements, viewport });

    expect(ui.currentView).toBe("loading");
    expect(ui.renderLoading(0.25)).toBe(true);
    expect(elements.progressText.textContent).toBe("25%");
    expect(elements.progressBar.style.width).toBe("25%");
    expect(ui.renderLoading(0.2)).toBe(false);

    expect(
      ui.render({ status: "ERROR", generation: 1, progress: 0.25, error: { kind: "required-asset", message: "404" } }),
    ).toBe(true);
    expect(ui.currentView).toBe("error");
    expect(elements.errorText.textContent).toBe("404");
    expect(elements.retry.hidden).toBe(false);
    expect(
      ui.render({ status: "RETRYING", generation: 2, progress: 0 }),
    ).toBe(true);
    expect(ui.currentProgress).toBe(0);
    expect(elements.progressText.textContent).toBe("0%");
  });

  it("connects idempotent Play/Retry actions and applies responsive viewport sizing", () => {
    const elements = makeElements();
    const viewport = new FakeViewport();
    const calls: string[] = [];
    const focused: DomAppTarget[] = [];
    const ui = new DomAppUi({
      elements,
      viewport,
      focus: {
        getActiveElement: () => undefined,
        focus: (target) => focused.push(target),
      },
      onPlay: () => calls.push("play"),
      onRetry: () => calls.push("retry"),
    });

    ui.renderReady();
    elements.play.dispatch("click");
    ui.renderError("Try again");
    elements.retry.dispatch("click");
    expect(calls).toEqual(["play", "retry"]);
    expect(focused).toEqual([elements.play, elements.retry]);
    expect(elements.play.style.outline).toContain("solid");
    expect(elements.retry.style.outline).toContain("solid");

    expect(elements.loading.style.minHeight).toBe("100dvh");
    expect(elements.loading.style.height).toBe("600px");
    viewport.resize(390, 844);
    expect(elements.loading.style.height).toBe("844px");
    expect(elements.loading.style.padding).toBe("16px");
    viewport.resize(1024, 700);
    expect(elements.loading.style.padding).toBe("24px");
  });

  it("keeps optional image layout space and exposes a text fallback", () => {
    const elements = makeElements();
    const image = new FakeImage();
    const fallback = new FakeTarget();
    const viewport = new FakeViewport();
    const ui = new DomAppUi({
      elements,
      viewport,
      optionalImages: [
        {
          image,
          fallback,
          fallbackAlt: "Card image unavailable",
          fallbackText: "Image unavailable",
        },
      ],
    });

    image.dispatch("error");
    expect(image.alt).toBe("Card image unavailable");
    expect(image.hidden).toBe(false);
    expect(image.style.visibility).toBe("hidden");
    expect(fallback.hidden).toBe(false);
    expect(fallback.textContent).toBe("Image unavailable");
    expect(fallback.style.pointerEvents).toBe("none");

    ui.destroy();
    ui.destroy();
    expect(image.removeCount).toBe(1);
    expect(viewport.unsubscribeCount).toBe(1);
    expect(ui.renderReady()).toBe(false);
  });
});

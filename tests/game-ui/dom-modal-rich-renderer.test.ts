import { describe, expect, it } from "vitest";

import {
  DomModalGameUi,
  type DomModalContentElement,
  type DomModalContentNode,
  type DomModalContentPort,
  type DomModalElements,
  type DomModalTarget,
  type DomModalViewport,
} from "../../src/game-ui/index.js";
import type { GameUiShowRequest } from "../../src/content/contract.js";

class FakeNode implements DomModalContentNode {
  readonly children: FakeNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  readonly kind: DomModalContentElement;
  hidden = true;
  scrollTop = 0;
  style: DomModalTarget["style"] = {
    maxHeight: "",
    overflowY: "",
    pointerEvents: "none",
    zIndex: "",
  };
  removeCount = 0;
  private text: string | null = null;

  constructor(kind: DomModalContentElement = "section") {
    this.kind = kind;
  }

  get textContent(): string | null {
    if (this.text !== null) return this.text;
    if (this.children.length === 0) return null;
    return this.children.map((child) => child.textContent ?? "").join("");
  }

  set textContent(value: string | null) {
    this.text = value;
    this.children.length = 0;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
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

  appendChild(child: DomModalContentNode): void {
    this.text = null;
    this.children.push(child as FakeNode);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({});
  }

  replaceChildren(children: readonly DomModalContentNode[]): void {
    this.text = null;
    this.children.length = 0;
    this.children.push(...children.map((child) => child as FakeNode));
  }
}

class FakeContentPort implements DomModalContentPort {
  readonly created: FakeNode[] = [];

  createElement(kind: DomModalContentElement): DomModalContentNode {
    const node = new FakeNode(kind);
    this.created.push(node);
    return node;
  }

  appendChildren(
    parent: DomModalContentNode,
    children: readonly DomModalContentNode[],
  ): void {
    for (const child of children) parent.appendChild(child);
  }

  replaceChildren(
    parent: DomModalTarget,
    children: readonly DomModalContentNode[],
  ): void {
    (parent as FakeNode).replaceChildren(children);
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

type FakeElements = {
  [Key in keyof DomModalElements]: FakeNode;
};

function makeElements(): FakeElements {
  return {
    root: new FakeNode("section"),
    backdrop: new FakeNode("section"),
    modal: new FakeNode("section"),
    title: new FakeNode("h3"),
    body: new FakeNode("section"),
    closeButton: new FakeNode("span"),
  };
}

function request(
  menuId: GameUiShowRequest["menuId"] = "projects",
  residenceId = "rich-residence",
  sections?: GameUiShowRequest["payload"]["sections"],
): GameUiShowRequest {
  return {
    menuId,
    residenceId,
    payload: {
      menuId,
      title: `Title ${menuId}`,
      body: [`Fallback ${menuId}`],
      ...(sections === undefined ? {} : { sections }),
    },
    presentation: { backdrop: "none" },
  };
}

const richSections: NonNullable<
  GameUiShowRequest["payload"]["sections"]
> = [
  {
    heading: "First section",
    paragraphs: ["First paragraph"],
    image: {
      src: "assets/project.webp",
      alt: "Project preview",
      fallbackText: "Project image unavailable",
    },
    links: [{ label: "Project site", href: "https://example.com/project" }],
    tags: ["TypeScript", "DOM"],
  },
  {
    heading: "Second section",
    paragraphs: ["Second paragraph"],
  },
];

describe("DomModalGameUi rich sections renderer", () => {
  it("renders sections in order using text nodes and secure external links", () => {
    const elements = makeElements();
    const content = new FakeContentPort();
    const ui = new DomModalGameUi(elements, new FakeViewport(), undefined, content);

    expect(ui.show(request("projects", "rich-1", richSections))).toEqual({
      status: "shown",
    });
    expect(elements.body.children.map((node) => node.kind)).toEqual([
      "section",
      "section",
    ]);
    expect(elements.body.children[0]?.children.map((node) => node.kind)).toEqual([
      "h3",
      "p",
      "figure",
      "ul",
      "ul",
    ]);
    expect(elements.body.children[1]?.children.map((node) => node.kind)).toEqual([
      "h3",
      "p",
    ]);
    expect(elements.body.textContent).toContain("First section");
    expect(elements.body.textContent).toContain("Second paragraph");
    expect(elements.body.textContent).not.toContain("<");

    const figure = elements.body.children[0]?.children[2];
    const image = figure?.children[0];
    const links = elements.body.children[0]?.children[3];
    const anchor = links?.children[0]?.children[0];
    expect(image?.kind).toBe("img");
    expect(image?.attributes.get("src")).toBe("assets/project.webp");
    expect(image?.attributes.get("alt")).toBe("Project preview");
    expect(anchor?.textContent).toBe("Project site");
    expect(anchor?.attributes.get("href")).toBe(
      "https://example.com/project",
    );
    expect(anchor?.attributes.get("target")).toBe("_blank");
    expect(anchor?.attributes.get("rel")).toBe("noopener noreferrer");
  });

  it("uses body text fallback when sections are absent and rejects unsafe sections atomically", () => {
    const elements = makeElements();
    const content = new FakeContentPort();
    const ui = new DomModalGameUi(elements, new FakeViewport(), undefined, content);

    expect(ui.show(request("about", "plain"))).toEqual({ status: "shown" });
    expect(elements.body.children).toHaveLength(0);
    expect(elements.body.textContent).toBe("Fallback about");

    const invalid = request("projects", "unsafe", [
      {
        paragraphs: ["Should not replace"],
        links: [{ label: "Bad", href: "javascript:alert(1)" }],
      },
    ]);
    expect(ui.show(invalid)).toEqual({ status: "invalid-payload" });
    expect(elements.title.textContent).toBe("Title about");
    expect(elements.body.textContent).toBe("Fallback about");
    expect(elements.body.children).toHaveLength(0);

    const remoteImage = request("projects", "remote", [
      {
        image: {
          src: "https://cdn.example.com/image.webp",
          alt: "Remote",
          fallbackText: "Unavailable",
        },
      },
    ]);
    expect(ui.show(remoteImage)).toEqual({ status: "invalid-payload" });
    expect(elements.title.textContent).toBe("Title about");
  });

  it("keeps layout and正文 when an image fails, and ignores stale image events", () => {
    const elements = makeElements();
    const content = new FakeContentPort();
    const ui = new DomModalGameUi(elements, new FakeViewport(), undefined, content);

    expect(ui.show(request("projects", "rich-1", richSections))).toEqual({
      status: "shown",
    });
    const oldFigure = elements.body.children[0]?.children[2];
    const oldImage = oldFigure?.children[0];
    const oldFallback = oldFigure?.children[1];
    expect(oldImage?.listeners.get("error")?.size).toBe(1);
    oldImage?.dispatch("error");
    expect(oldImage?.hidden).toBe(false);
    expect(oldImage?.style.visibility).toBe("hidden");
    expect(oldFallback?.hidden).toBe(false);
    expect(elements.body.textContent).toContain("First paragraph");
    expect(elements.body.textContent).toContain("Project image unavailable");

    expect(ui.show(request("cv", "rich-2", richSections))).toEqual({
      status: "shown",
    });
    expect(oldImage?.listeners.get("error")?.size).toBe(0);
    oldFallback!.hidden = true;
    oldImage?.dispatch("error");
    expect(oldFallback?.hidden).toBe(true);

    const newFigure = elements.body.children[0]?.children[2];
    const newImage = newFigure?.children[0];
    const newFallback = newFigure?.children[1];
    newImage?.dispatch("error");
    expect(newFallback?.hidden).toBe(false);
    expect(ui.hide({
      menuId: "cv",
      residenceId: "rich-2",
      reason: "user-close",
    })).toEqual({ status: "hidden" });
    expect(newImage?.listeners.get("error")?.size).toBe(0);
    newFallback!.hidden = true;
    newImage?.dispatch("error");
    expect(newFallback?.hidden).toBe(true);

    ui.destroy();
    ui.destroy();
  });
});

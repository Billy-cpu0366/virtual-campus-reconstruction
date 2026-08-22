import { describe, expect, it } from "vitest";

import {
  CAMPUS_CONTENT_PAYLOADS,
  CampusContentResolver,
  createCampusContentResolver,
  type CampusContentPayloadSource,
} from "../../game/CampusContentResolver.js";
import {
  CONTENT_MENU_IDS,
  type GameUiContentPayload,
} from "../../src/content/contract.js";

const about: GameUiContentPayload = {
  menuId: "about",
  title: "About",
  body: ["Evidence-backed text"],
};

function resolverWith(
  source: CampusContentPayloadSource,
): CampusContentResolver {
  return new CampusContentResolver(source);
}

describe("CampusContentResolver", () => {
  it("只提供内容层已确认的 11 个入口和最小标签", () => {
    const resolver = createCampusContentResolver();
    expect(Object.keys(CAMPUS_CONTENT_PAYLOADS)).toEqual(CONTENT_MENU_IDS);
    for (const menuId of CONTENT_MENU_IDS) {
      const result = resolver.resolve(menuId);
      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") continue;
      expect(result.payload.menuId).toBe(menuId);
      expect(result.payload.title.trim()).not.toBe("");
      expect(result.payload.body.length).toBeGreaterThan(0);
      expect(result.payload.body.every((line) => line.trim() !== "")).toBe(true);
    }
    expect(CAMPUS_CONTENT_PAYLOADS.tech.body).toContain("Angular");
    expect(CAMPUS_CONTENT_PAYLOADS.projects.body).toContain("eUTxO.org");
    expect(CAMPUS_CONTENT_PAYLOADS.cv.body).toContain("VUB Bank");
  });

  it("同步解析 readonly record 中的 payload", () => {
    const result = resolverWith({ about }).resolve("about");
    expect(result).toEqual({ status: "resolved", payload: about });
  });

  it("同步解析 readonly Map，不联网也不重试", () => {
    const source = new Map<string, unknown>([["memo1", {
      menuId: "memo1",
      title: "Memo",
      body: ["Memo text"],
      presentation: { backdrop: "global" },
    }]]);
    const resolver = resolverWith(source);

    expect(resolver.resolve("memo1")).toEqual({
      status: "resolved",
      payload: {
        menuId: "memo1",
        title: "Memo",
        body: ["Memo text"],
        presentation: { backdrop: "global" },
      },
    });
    expect(resolver.resolve("about")).toEqual({ status: "missing" });
  });

  it("区分 missing、非法 menuId 和 invalid payload", () => {
    const resolver = resolverWith({
      about,
      cv: { menuId: "about", title: "Wrong menu", body: ["Text"] },
      projects: { menuId: "projects", title: "", body: ["Text"] },
      contact: { menuId: "contact", title: "Contact", body: [] },
      tech: { menuId: "tech", title: "Tech", body: ["Text"],
        presentation: { backdrop: "unknown" } },
    });

    expect(resolver.resolve("memo1")).toEqual({ status: "missing" });
    expect(resolver.resolve("not-a-menu" as "about")).toEqual({
      status: "invalid",
    });
    expect(resolver.resolve("cv")).toEqual({ status: "invalid" });
    expect(resolver.resolve("projects")).toEqual({ status: "invalid" });
    expect(resolver.resolve("contact")).toEqual({ status: "invalid" });
    expect(resolver.resolve("tech")).toEqual({ status: "invalid" });
  });

  it("严格拒绝非文本 body、空 identity 和异常 payload", () => {
    const resolver = resolverWith({
      about: { menuId: "about", title: "About", body: ["ok", 1] },
      cv: { menuId: "cv", title: "CV", body: ["ok"], residenceId: "" },
      projects: null,
      contact: "not-payload",
    });

    expect(resolver.resolve("about")).toEqual({ status: "invalid" });
    expect(resolver.resolve("cv")).toEqual({ status: "invalid" });
    expect(resolver.resolve("projects")).toEqual({ status: "invalid" });
    expect(resolver.resolve("contact")).toEqual({ status: "invalid" });
  });

  it("解析合法 sections 并深冻结所有嵌套数组和对象", () => {
    const source = {
      projects: {
        menuId: "projects",
        title: "Projects",
        body: ["Projects fallback"],
        sections: [
          {
            heading: "Project one",
            paragraphs: ["Evidence-backed paragraph"],
            image: {
              src: "assets/images/portfolio/project.webp",
              alt: "Project preview",
              fallbackText: "Project image unavailable",
            },
            links: [
              { label: "Project site", href: "https://example.com/project" },
            ],
            tags: ["Angular", "TypeScript"],
          },
        ],
      },
    };
    const result = resolverWith(source).resolve("projects");
    if (result.status !== "resolved") throw new Error("expected resolved");

    const sections = result.payload.sections;
    const section = sections?.[0];
    expect(section).toEqual(source.projects.sections[0]);
    expect(Object.isFrozen(result.payload)).toBe(true);
    expect(Object.isFrozen(sections)).toBe(true);
    expect(Object.isFrozen(section)).toBe(true);
    expect(Object.isFrozen(section?.paragraphs)).toBe(true);
    expect(Object.isFrozen(section?.image)).toBe(true);
    expect(Object.isFrozen(section?.links)).toBe(true);
    expect(Object.isFrozen(section?.links?.[0])).toBe(true);
    expect(Object.isFrozen(section?.tags)).toBe(true);
    expect(() => (section?.paragraphs as string[]).push("mutation")).toThrow();
    expect(() => (section?.links as unknown[]).push({})).toThrow();
    expect(() => (section?.tags as string[]).push("mutation")).toThrow();
    expect(source.projects.sections[0]?.paragraphs).toEqual([
      "Evidence-backed paragraph",
    ]);
  });

  it("严格拒绝空文本、错误字段和非法 image/link", () => {
    const invalidSections: readonly unknown[] = [
      [],
      [{}],
      [{ heading: "" }],
      [{ paragraphs: [] }],
      [{ paragraphs: ["ok", " "] }],
      [{ tags: [""] }],
      [{ heading: "Heading", rawHtml: "<b>not allowed</b>" }],
      [{ image: { src: "https://example.com/image.webp", alt: "Image", fallbackText: "Missing" } }],
      [{ image: { src: "assets/image.webp", alt: "", fallbackText: "Missing" } }],
      [{ image: { src: "assets/image.webp", alt: "Image", fallbackText: "Missing", extra: true } }],
      [{ links: [{ label: "Local", href: "/inside" }] }],
      [{ links: [{ label: "Mail", href: "mailto:test@example.com" }] }],
      [{ links: [{ label: "", href: "https://example.com" }] }],
      [{ links: [{ label: "Site", href: "https://example.com", extra: true }] }],
    ];

    for (const sections of invalidSections) {
      const result = resolverWith({
        about: {
          menuId: "about",
          title: "About",
          body: ["Fallback"],
          sections,
        },
      }).resolve("about");
      expect(result).toEqual({ status: "invalid" });
    }
  });

  it("异常 source 或 payload getter 始终返回 invalid", () => {
    const throwingSource = new Proxy<Record<string, unknown>>({}, {
      getOwnPropertyDescriptor: () => {
        throw new Error("source failed");
      },
    });
    const throwingPayload = {
      menuId: "about",
      get title(): string {
        throw new Error("payload failed");
      },
      body: ["Fallback"],
    };

    expect(resolverWith(throwingSource).resolve("about")).toEqual({
      status: "invalid",
    });
    expect(resolverWith({ about: throwingPayload }).resolve("about")).toEqual({
      status: "invalid",
    });
  });

  it("返回 immutable payload 副本，不让调用方修改 resolver 来源", () => {
    const source = {
      about: {
        menuId: "about",
        title: "About",
        body: ["Text"],
      },
    };
    const result = resolverWith(source).resolve("about");
    if (result.status !== "resolved") throw new Error("expected resolved");

    expect(Object.isFrozen(result.payload)).toBe(true);
    expect(Object.isFrozen(result.payload.body)).toBe(true);
    expect(() => (result.payload.body as string[]).push("mutation"))
      .toThrow();
    expect(source.about.body).toEqual(["Text"]);
  });
});

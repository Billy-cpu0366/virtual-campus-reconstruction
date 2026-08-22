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

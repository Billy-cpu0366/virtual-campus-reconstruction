import { describe, expect, it } from "vitest";

import {
  CONTENT_REGISTRY,
  CONTENT_RESOURCE_RECEIPTS,
  MEMO6_DISCOVERY_GUIDE,
  VISIBLE_CONTENT_MENU_IDS,
  getContentResourceReceipt,
  getVisibleContentPayload,
} from "../../src/content/registry.js";

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) {
    expectDeepFrozen(child);
  }
}

function allSections() {
  return VISIBLE_CONTENT_MENU_IDS.flatMap(
    (menuId) => CONTENT_REGISTRY[menuId].sections ?? [],
  );
}

describe("visible content registry", () => {
  it("contains exactly the evidence-backed About, Projects and Memo entries", () => {
    expect(Object.keys(CONTENT_REGISTRY)).toEqual([
      "about",
      "projects",
      "memo1",
      "memo2",
      "memo3",
      "memo4",
      "memo5",
      "memo6",
    ]);
    expect(VISIBLE_CONTENT_MENU_IDS).toEqual(Object.keys(CONTENT_REGISTRY));

    for (const menuId of VISIBLE_CONTENT_MENU_IDS) {
      const payload = CONTENT_REGISTRY[menuId];
      expect(payload.menuId).toBe(menuId);
      expect(payload.title.trim()).not.toBe("");
      expect(payload.body.length).toBeGreaterThan(0);
      expect(payload.body.every((paragraph) => paragraph.trim() !== "")).toBe(
        true,
      );
      expect(payload.sections?.length).toBeGreaterThan(0);
    }
  });

  it("keeps the P1 English About and Projects copy and mappings", () => {
    const about = CONTENT_REGISTRY.about;
    expect(about.body).toContain(
      "I'm Peter Oravec, a creative web developer with over 19 years of experience, currently based in Bratislava, Slovakia.",
    );
    expect(about.body).toContain(
      "My primary focus is on Front-End, JavaScript and Angular, but I also have deep experience as a full-stack developer, especially in the MEAN stack (MongoDB, Express, Angular, Node.js).",
    );
    expect(about.sections?.[0]?.image).toEqual({
      src: "assets/images/peter-oravec.webp",
      alt: "Peter Oravec CV photo",
      fallbackText: "Peter Oravec photo unavailable.",
    });
    expect(about.sections?.[0]?.links).toEqual([
      { label: "LinkedIn", href: "https://www.linkedin.com/in/peteroravec" },
    ]);

    const projects = CONTENT_REGISTRY.projects;
    expect(projects.body).toContain("eUTxO.org");
    expect(projects.body).toContain("Angular.sk");
    expect(projects.body).toContain("Peter Oravec portfolio v1");
    expect(projects.sections?.[1]).toMatchObject({
      heading: "eUTxO.org",
      image: {
        src: "assets/images/portfolio/portfolio-eutxo.webp",
      },
      links: [{ label: "Visit", href: "https://eutxo.org" }],
    });
    expect(projects.sections?.[2]).toMatchObject({
      heading: "Angular.sk",
      image: {
        src: "assets/images/portfolio/portfolio-angularsk.webp",
      },
    });
    expect(projects.sections?.[3]).toMatchObject({
      heading: "Peter Oravec portfolio v1",
      image: {
        src: "assets/images/portfolio/peteroravec-v1.webp",
      },
      links: [{ label: "Visit", href: "https://old.peteroravec.com" }],
    });
  });

  it("keeps every Memo 1–6 title, body and base image", () => {
    const expected: Record<string, string> = {
      memo1: "100% Vibe coding",
      memo2: "Automatic testing",
      memo3: "From Node.js logic to visual art in Canvas",
      memo4: "Technologies I buried",
      memo5: "AI: Competitor or colleague?",
      memo6: "I'm not a game developer",
    };

    for (const [menuId, title] of Object.entries(expected)) {
      const payload = CONTENT_REGISTRY[menuId as keyof typeof CONTENT_REGISTRY];
      expect(payload.title).toBe(title);
      expect(payload.body.length).toBeGreaterThan(1);
      expect(payload.sections?.[0]?.heading).toBe(title);
      expect(payload.sections?.[0]?.image?.src).toBe(
        `/assets/images/cards/card${menuId.slice(-1)}_base.webp`,
      );
      expect(payload.sections?.[0]?.image?.fallbackText).toContain("unavailable");
    }

    expect(CONTENT_REGISTRY.memo6.body).toEqual([
      "Don't be fooled by the visuals – I'm not a game developer. My priority is large, long-term projects that require clean architecture and logical solutions.",
      "At the same time, I can be creative and flexible when the situation calls for it.",
    ]);
  });

  it("records only successful mirrored resources and excludes unavailable foil", () => {
    expect(CONTENT_RESOURCE_RECEIPTS).toHaveLength(10);
    expect(CONTENT_RESOURCE_RECEIPTS.every((receipt) => receipt.status === 200)).toBe(
      true,
    );
    expect(
      CONTENT_RESOURCE_RECEIPTS.every((receipt) => /^[a-f0-9]{64}$/u.test(receipt.sha256)),
    ).toBe(true);

    for (const section of allSections()) {
      const image = section.image;
      if (image === undefined) continue;
      const receipt = getContentResourceReceipt(image.src);
      expect(receipt).toBeDefined();
      expect(image.fallbackText.trim()).not.toBe("");
    }

    expect(getContentResourceReceipt("/assets/images/cards/card5_foil.webp")).toBe(
      undefined,
    );
    expect(
      allSections().some((section) => section.image?.src.includes("card5_foil")),
    ).toBe(false);
  });

  it("deep-freezes registry data and resource receipts", () => {
    expectDeepFrozen(CONTENT_REGISTRY);
    expectDeepFrozen(CONTENT_RESOURCE_RECEIPTS);
    expectDeepFrozen(MEMO6_DISCOVERY_GUIDE);

    expect(() => {
      (CONTENT_REGISTRY.about.body as string[]).push("mutation");
    }).toThrow();
    expect(() => {
      (CONTENT_REGISTRY.projects.sections as unknown as unknown[]).pop();
    }).toThrow();
    expect(() => {
      (CONTENT_REGISTRY.memo6.sections?.[0]?.image as { src: string }).src =
        "assets/other.webp";
    }).toThrow();
  });

  it("exports a read-only Memo 6 candidate guide without side effects", () => {
    expect(MEMO6_DISCOVERY_GUIDE).toMatchObject({
      menuId: "memo6",
      markerId: "memo6",
      start: { x: 1088, y: 304 },
      target: { x: 496, y: 176 },
      candidateEnd: { x: 512, y: 192 },
      interactionDistancePx: 30,
      policy: {
        autoTeleport: false,
        autoOpenModal: false,
        markVisited: false,
      },
    });
    expect(MEMO6_DISCOVERY_GUIDE.candidateRoute).toEqual([
      { direction: "left", tiles: 36 },
      { direction: "up", tiles: 7 },
    ]);
    expect(getVisibleContentPayload("memo6")).toBe(CONTENT_REGISTRY.memo6);
    expect(getVisibleContentPayload("cv")).toBeUndefined();
  });
});

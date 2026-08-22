import { describe, expect, it } from "vitest";
import {
  CONTENT_MENU_IDS,
  type ContentResolveResult,
  type GameUiContentPayload,
  type GameUiContentSection,
  type GameUiHideRequest,
  type GameUiPresentation,
  type GameUiShowRequest,
  type GameplayControlLeaseAcquireResult,
  type GameplayControlLeaseReason,
  type GameplayControlLeaseReleaseResult,
  type GameplayControlLeaseShutdownResult,
  type InteractionVisitReceipt,
  type ShowResult,
  type UserCloseEvent,
  type ZoneResidenceEvent,
} from "../../src/content/contract.js";

describe("内容共享 contract", () => {
  it("冻结 11 个 Zone menuId，且不包含非 Zone 内容", () => {
    expect(CONTENT_MENU_IDS).toEqual([
      "about",
      "cv",
      "projects",
      "contact",
      "tech",
      "memo1",
      "memo2",
      "memo3",
      "memo4",
      "memo5",
      "memo6",
    ]);
    expect(CONTENT_MENU_IDS).toHaveLength(11);
    expect(Object.isFrozen(CONTENT_MENU_IDS)).toBe(true);
  });

  it("保留驻留、访问收据和 UI identity 的必要字段", () => {
    const residence: ZoneResidenceEvent = {
      markerId: "marker-1",
      menuId: "about",
      residenceId: "residence-1",
      phase: "enter",
    };
    const receipt: InteractionVisitReceipt = {
      markerId: residence.markerId,
      menuId: residence.menuId,
      residenceId: residence.residenceId,
    };
    const close: UserCloseEvent = {
      menuId: "about",
      residenceId: "residence-1",
      source: "backdrop",
    };
    expect(residence).toMatchObject({ markerId: "marker-1", phase: "enter" });
    expect(receipt).toMatchObject({ menuId: "about" });
    expect(close).toMatchObject({ residenceId: "residence-1" });
  });

  it("定义只读 payload/presentation 以及带 identity 的 show/hide", () => {
    const payload: GameUiContentPayload = {
      menuId: "memo1",
      title: "Memo",
      body: ["A paragraph"],
    };
    const presentation: GameUiPresentation = { backdrop: "global" };
    const show: GameUiShowRequest = {
      menuId: "memo1",
      residenceId: "residence-2",
      payload,
      presentation,
    };
    const hide: GameUiHideRequest = {
      menuId: show.menuId,
      residenceId: show.residenceId,
      reason: "user-close",
    };
    expect(show.payload.body).toEqual(["A paragraph"]);
    expect(hide).toMatchObject({ menuId: "memo1", reason: "user-close" });
  });

  it("以 optional readonly sections 扩展 payload，body fallback 仍为必需", () => {
    const section: GameUiContentSection = {
      heading: "Project",
      paragraphs: ["Evidence-backed paragraph"],
      image: {
        src: "assets/images/portfolio/project.webp",
        alt: "Project preview",
        fallbackText: "Project image unavailable",
      },
      links: [{ label: "Project site", href: "https://example.com" }],
      tags: ["Angular", "TypeScript"],
    };
    const rich: GameUiContentPayload = {
      menuId: "projects",
      title: "Projects",
      body: ["Projects fallback"],
      sections: [section],
    };
    const legacy: GameUiContentPayload = {
      menuId: "about",
      title: "About",
      body: ["Legacy fallback"],
    };

    expect(rich.sections?.[0]).toEqual(section);
    expect(legacy).not.toHaveProperty("sections");
    expect(legacy.body).toEqual(["Legacy fallback"]);
  });

  it("保留精确的 resolver/UI/lease 结果分支", () => {
    const resolved: ContentResolveResult = {
      status: "resolved",
      payload: { menuId: "about", title: "About", body: ["Text"] },
    };
    const missing: ContentResolveResult = { status: "missing" };
    const invalid: ContentResolveResult = { status: "invalid" };
    const shown: ShowResult = { status: "shown" };
    const hidden: ShowResult = { status: "already-visible" };
    const leaseReasons: readonly GameplayControlLeaseReason[] = [
      "modal-open",
      "camera-tour",
    ];
    const acquired: GameplayControlLeaseAcquireResult = {
      ok: false,
      reason: "disable-failed",
    };
    const released: GameplayControlLeaseReleaseResult = {
      ok: false,
      reason: "stale-token",
    };
    const shutdown: GameplayControlLeaseShutdownResult = {
      ok: false,
      reason: "disable-failed",
    };
    expect([
      resolved.status,
      missing.status,
      invalid.status,
      shown.status,
      hidden.status,
      leaseReasons.join(","),
      acquired.reason,
      released.reason,
      shutdown.reason,
    ]).toEqual([
      "resolved",
      "missing",
      "invalid",
      "shown",
      "already-visible",
      "modal-open,camera-tour",
      "disable-failed",
      "stale-token",
      "disable-failed",
    ]);
  });
});

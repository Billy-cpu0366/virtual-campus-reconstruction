import {
  CONTENT_MENU_IDS,
  type ContentMenuId,
  type ContentPayload,
  type ContentResolveResult,
  type ContentResolverPort,
  type GameUiPresentation,
} from "../src/content/contract.js";

export type CampusContentPayloadSource =
  | Readonly<Record<string, unknown>>
  | Readonly<Record<ContentMenuId, unknown>>
  | ReadonlyMap<string, unknown>
  | ReadonlyMap<ContentMenuId, unknown>;

/**
 * Only labels and item names already confirmed in 04-内容层 are included.
 * Unknown long-form copy, images and Slovak translations stay absent.
 */
export const CAMPUS_CONTENT_PAYLOADS: Readonly<
  Record<ContentMenuId, ContentPayload>
> = Object.freeze({
  about: Object.freeze({
    menuId: "about",
    title: "About Me",
    body: Object.freeze(["Photo", "Name", "Position", "LinkedIn", "Introduction"]),
  }),
  cv: Object.freeze({
    menuId: "cv",
    title: "CV",
    body: Object.freeze([
      "GAMO",
      "SCR",
      "Kremsa Digital",
      "Bethereum",
      "VUB Bank",
    ]),
  }),
  projects: Object.freeze({
    menuId: "projects",
    title: "Projects",
    body: Object.freeze(["eUTxO.org", "Angular.sk", "Previous portfolio"]),
  }),
  contact: Object.freeze({
    menuId: "contact",
    title: "Contact",
    body: Object.freeze(["LinkedIn", "Email"]),
  }),
  tech: Object.freeze({
    menuId: "tech",
    title: "Technologies",
    body: Object.freeze([
      "Angular",
      "Node.js",
      "Express.js",
      "JavaScript",
      "Other technologies",
    ]),
  }),
  memo1: Object.freeze({ menuId: "memo1", title: "Memo #1", body: Object.freeze(["Memo #1"]) }),
  memo2: Object.freeze({ menuId: "memo2", title: "Memo #2", body: Object.freeze(["Memo #2"]) }),
  memo3: Object.freeze({ menuId: "memo3", title: "Memo #3", body: Object.freeze(["Memo #3"]) }),
  memo4: Object.freeze({ menuId: "memo4", title: "Memo #4", body: Object.freeze(["Memo #4"]) }),
  memo5: Object.freeze({ menuId: "memo5", title: "Memo #5", body: Object.freeze(["Memo #5"]) }),
  memo6: Object.freeze({ menuId: "memo6", title: "Memo #6", body: Object.freeze(["Memo #6"]) }),
});

function isContentMenuId(value: unknown): value is ContentMenuId {
  return (
    typeof value === "string" &&
    (CONTENT_MENU_IDS as readonly string[]).includes(value)
  );
}

function isPresentation(value: unknown): value is GameUiPresentation {
  return (
    typeof value === "object" &&
    value !== null &&
    "backdrop" in value &&
    (value.backdrop === "none" || value.backdrop === "global")
  );
}

function validatePayload(
  requestedMenuId: ContentMenuId,
  value: unknown,
): value is ContentPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "menuId")) return false;
  if (
    !isContentMenuId(record.menuId) ||
    record.menuId !== requestedMenuId
  ) {
    return false;
  }
  if (typeof record.title !== "string" || record.title.trim() === "") {
    return false;
  }
  if (
    !Array.isArray(record.body) ||
    record.body.length === 0 ||
    !record.body.every(
      (paragraph: unknown): paragraph is string =>
        typeof paragraph === "string" && paragraph.trim() !== "",
    )
  ) {
    return false;
  }
  if (
    "residenceId" in record &&
    (typeof record.residenceId !== "string" || record.residenceId === "")
  ) {
    return false;
  }
  if ("presentation" in record && !isPresentation(record.presentation)) {
    return false;
  }
  return true;
}

function immutablePayload(payload: ContentPayload): ContentPayload {
  const presentation =
    payload.presentation === undefined
      ? undefined
      : Object.freeze({ ...payload.presentation });
  const copy: ContentPayload = {
    menuId: payload.menuId,
    title: payload.title,
    body: Object.freeze([...payload.body]),
    ...(payload.residenceId === undefined
      ? {}
      : { residenceId: payload.residenceId }),
    ...(presentation === undefined ? {} : { presentation }),
  };
  return Object.freeze(copy);
}

function readSource(
  source: CampusContentPayloadSource,
  menuId: ContentMenuId,
): unknown {
  if (source instanceof Map) return source.get(menuId);
  const record = source as Readonly<Record<string, unknown>>;
  return Object.prototype.hasOwnProperty.call(record, menuId)
    ? record[menuId]
    : undefined;
}

/** A synchronous, evidence-backed resolver; it never fetches or retries. */
export class CampusContentResolver implements ContentResolverPort {
  constructor(private readonly source: CampusContentPayloadSource) {}

  resolve(menuId: ContentMenuId): ContentResolveResult {
    if (!isContentMenuId(menuId)) return { status: "invalid" };

    let value: unknown;
    try {
      value = readSource(this.source, menuId);
    } catch {
      return { status: "invalid" };
    }
    if (value === undefined) return { status: "missing" };
    if (!validatePayload(menuId, value)) return { status: "invalid" };
    return { status: "resolved", payload: immutablePayload(value) };
  }
}

export function createCampusContentResolver(): CampusContentResolver {
  return new CampusContentResolver(CAMPUS_CONTENT_PAYLOADS);
}

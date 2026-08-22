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

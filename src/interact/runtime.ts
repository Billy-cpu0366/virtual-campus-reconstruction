import {
  CONTENT_MENU_IDS,
  type ContentMenuId,
  type ContentResolveResult,
  type ContentResolverPort,
  type GameUiContentPayload,
  type GameUiPort,
  type GameplayControlLeasePort,
  type GameplayControlLeaseToken,
  type InteractionVisitReceipt,
  type UserCloseEvent,
  type ZoneResidenceEvent,
} from "../content/contract.js";

export interface InteractRuntimeOptions {
  readonly resolver: ContentResolverPort;
  readonly ui: GameUiPort;
  readonly lease: GameplayControlLeasePort;
  readonly onVisitReceipt?: (receipt: InteractionVisitReceipt) => void;
}

export interface InteractActiveResidence {
  readonly markerId: string;
  readonly menuId: ContentMenuId;
  readonly residenceId: string;
}

export type InteractEventResult =
  | "ignored"
  | "suppressed"
  | "resolved"
  | "missing"
  | "invalid"
  | "lease-failed"
  | "shown"
  | "already-visible"
  | "show-failed"
  | "destroyed";

function isMenuId(value: unknown): value is ContentMenuId {
  return (
    typeof value === "string" &&
    (CONTENT_MENU_IDS as readonly string[]).includes(value)
  );
}

function isPayloadFor(
  value: unknown,
  menuId: ContentMenuId,
  residenceId: string,
): value is GameUiContentPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (payload.menuId !== menuId) return false;
  if (typeof payload.title !== "string" || payload.title.trim() === "") {
    return false;
  }
  if (
    !Array.isArray(payload.body) ||
    payload.body.length === 0 ||
    !payload.body.every(
      (paragraph: unknown) =>
        typeof paragraph === "string" && paragraph.trim() !== "",
    )
  ) {
    return false;
  }
  if (
    "residenceId" in payload &&
    (typeof payload.residenceId !== "string" ||
      payload.residenceId !== residenceId)
  ) {
    return false;
  }
  if (
    "presentation" in payload &&
    (typeof payload.presentation !== "object" ||
      payload.presentation === null ||
      !("backdrop" in payload.presentation) ||
      (payload.presentation.backdrop !== "none" &&
        payload.presentation.backdrop !== "global"))
  ) {
    return false;
  }
  return true;
}

function isResidenceEvent(value: ZoneResidenceEvent): boolean {
  return (
    typeof value.markerId === "string" &&
    value.markerId.length > 0 &&
    isMenuId(value.menuId) &&
    typeof value.residenceId === "string" &&
    value.residenceId.length > 0 &&
    (value.phase === "enter" || value.phase === "leave")
  );
}

function isUserCloseEvent(value: UserCloseEvent): boolean {
  return (
    typeof value.menuId === "string" &&
    isMenuId(value.menuId) &&
    typeof value.residenceId === "string" &&
    value.residenceId.length > 0 &&
    (value.source === "close-button" || value.source === "backdrop")
  );
}

function backdropFor(menuId: ContentMenuId): "none" | "global" {
  return menuId.startsWith("memo") ? "global" : "none";
}

/** Single-active content interaction state machine. */
export class InteractRuntime {
  private readonly resolver: ContentResolverPort;
  private readonly ui: GameUiPort;
  private readonly lease: GameplayControlLeasePort;
  private readonly onVisitReceipt: (receipt: InteractionVisitReceipt) => void;
  private readonly suppressedResidences = new Set<string>();
  private readonly committedResidences = new Set<string>();
  private readonly pendingReleaseTokens = new Set<GameplayControlLeaseToken>();
  private activeState: InteractActiveResidence | undefined;
  private activeToken: GameplayControlLeaseToken | undefined;
  private unsubscribeUserClose: (() => void) | undefined;
  private destroyed = false;

  constructor(options: InteractRuntimeOptions) {
    this.resolver = options.resolver;
    this.ui = options.ui;
    this.lease = options.lease;
    this.onVisitReceipt = options.onVisitReceipt ?? (() => undefined);
    try {
      this.unsubscribeUserClose = this.ui.subscribeUserClose((event) => {
        this.handleUserClose(event);
      });
    } catch {
      this.unsubscribeUserClose = undefined;
    }
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get active(): InteractActiveResidence | undefined {
    if (this.activeState === undefined) return undefined;
    const { markerId, menuId, residenceId } = this.activeState;
    return { markerId, menuId, residenceId };
  }

  get suppressedResidenceIds(): readonly string[] {
    return [...this.suppressedResidences].map((identity) =>
      identity.slice(identity.indexOf("\u0000") + 1),
    );
  }

  get pendingReleaseCount(): number {
    return this.pendingReleaseTokens.size;
  }

  handleResidenceEvent(event: ZoneResidenceEvent): InteractEventResult {
    if (this.destroyed || !isResidenceEvent(event)) return "ignored";
    if (event.phase === "leave") {
      this.handleLeave(event);
      return "ignored";
    }
    const identity = identityKey(event);
    if (this.suppressedResidences.has(identity)) {
      return "suppressed";
    }
    if (this.committedResidences.has(identity)) {
      return "ignored";
    }

    // A failed final release must not leave a second lease behind.
    if (!this.retryPendingReleases()) return "lease-failed";

    let resolved: ContentResolveResult;
    try {
      resolved = this.resolver.resolve(event.menuId);
    } catch {
      return "invalid";
    }
    if (resolved.status !== "resolved") return resolved.status;
    if (!isPayloadFor(resolved.payload, event.menuId, event.residenceId)) {
      return "invalid";
    }

    let token: GameplayControlLeaseToken;
    if (this.activeState === undefined) {
      let acquired;
      try {
        acquired = this.lease.acquire("modal-open");
      } catch {
        return "lease-failed";
      }
      if (!acquired.ok) return "lease-failed";
      token = acquired.token;
    } else {
      if (this.activeToken === undefined) return "lease-failed";
      token = this.activeToken;
    }

    let showResult: ReturnType<GameUiPort["show"]>;
    try {
      showResult = this.ui.show({
        menuId: event.menuId,
        residenceId: event.residenceId,
        payload: resolved.payload,
        presentation: { backdrop: backdropFor(event.menuId) },
      });
    } catch {
      showResult = { status: "invalid-payload" };
    }

    if (showResult.status !== "shown" && showResult.status !== "already-visible") {
      if (this.activeState === undefined) {
        this.retainIfReleaseFailed(token);
      }
      return "show-failed";
    }

    // Commit only after UI success. Replacement therefore preserves the old
    // state for every failure result.
    this.activeState = {
      markerId: event.markerId,
      menuId: event.menuId,
      residenceId: event.residenceId,
    };
    this.activeToken = token;
    this.committedResidences.add(identity);
    this.emitVisitReceipt(event);
    return showResult.status;
  }

  onResidenceEvent(event: ZoneResidenceEvent): InteractEventResult {
    return this.handleResidenceEvent(event);
  }

  handleUserClose(event: UserCloseEvent): void {
    if (this.destroyed || !isUserCloseEvent(event)) return;
    const active = this.activeState;
    if (active === undefined || !sameIdentity(active, event)) return;

    let hideResult;
    try {
      hideResult = this.ui.hide({
        menuId: event.menuId,
        residenceId: event.residenceId,
        reason: "user-close",
      });
    } catch {
      return;
    }
    if (hideResult.status !== "hidden" && hideResult.status !== "already-hidden") {
      return;
    }
    const token = this.activeToken;
    this.suppressedResidences.add(identityKey(event));
    this.activeState = undefined;
    this.activeToken = undefined;
    if (token !== undefined) this.retainIfReleaseFailed(token);
  }

  onUserClose(event: UserCloseEvent): void {
    this.handleUserClose(event);
  }

  retryPendingReleases(): boolean {
    // Cleanup retries are safe after destroy; this method cannot revive UI or
    // accept events, it only attempts to release an already-issued token.
    let allReleased = true;
    for (const token of [...this.pendingReleaseTokens]) {
      let result;
      try {
        result = this.lease.release(token);
      } catch {
        allReleased = false;
        continue;
      }
      if (result.ok || result.reason === "unknown-token" || result.reason === "stale-token") {
        this.pendingReleaseTokens.delete(token);
      } else if (result.reason === "enable-failed") {
        allReleased = false;
      } else {
        this.pendingReleaseTokens.delete(token);
      }
    }
    return allReleased && this.pendingReleaseTokens.size === 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const active = this.activeState;
    const activeToken = this.activeToken;
    try {
      this.unsubscribeUserClose?.();
    } catch {
      // Continue teardown even if an adapter reports an unsubscribe failure.
    } finally {
      this.unsubscribeUserClose = undefined;
    }

    try {
      if (active !== undefined) {
        this.ui.hide({
          menuId: active.menuId,
          residenceId: active.residenceId,
          reason: "shutdown",
        });
      }
    } catch {
      // Continue to UI destroy and lease release after hide failure.
    }
    try {
      this.ui.destroy();
    } catch {
      // Adapter teardown failure must not prevent lease cleanup.
    } finally {
      const tokens = new Set(this.pendingReleaseTokens);
      if (activeToken !== undefined) tokens.add(activeToken);
      for (const token of tokens) {
        this.retainIfReleaseFailed(token);
      }
      this.activeState = undefined;
      this.activeToken = undefined;
      this.suppressedResidences.clear();
      this.committedResidences.clear();
    }
  }

  private handleLeave(event: ZoneResidenceEvent): void {
    const identity = identityKey(event);
    this.suppressedResidences.delete(identity);
    const active = this.activeState;
    if (active === undefined || !sameIdentity(active, event)) return;
    let hideResult;
    try {
      hideResult = this.ui.hide({
        menuId: event.menuId,
        residenceId: event.residenceId,
        reason: "leave",
      });
    } catch {
      return;
    }
    if (hideResult.status !== "hidden" && hideResult.status !== "already-hidden") {
      return;
    }
    const token = this.activeToken;
    this.activeState = undefined;
    this.activeToken = undefined;
    if (token !== undefined) this.retainIfReleaseFailed(token);
  }

  private retainIfReleaseFailed(token: GameplayControlLeaseToken): void {
    let result;
    try {
      result = this.lease.release(token);
    } catch {
      this.pendingReleaseTokens.add(token);
      return;
    }
    if (result.ok || result.reason === "unknown-token" || result.reason === "stale-token") {
      this.pendingReleaseTokens.delete(token);
    } else if (result.reason === "enable-failed") {
      this.pendingReleaseTokens.add(token);
    }
  }

  private emitVisitReceipt(event: ZoneResidenceEvent): void {
    try {
      this.onVisitReceipt({
        markerId: event.markerId,
        residenceId: event.residenceId,
        menuId: event.menuId,
      });
    } catch {
      // A receipt observer cannot undo a committed UI state.
    }
  }
}

function identityKey(
  value: Pick<ZoneResidenceEvent, "menuId" | "residenceId">,
): string {
  return `${value.menuId}\u0000${value.residenceId}`;
}

function sameIdentity(
  left: Pick<ZoneResidenceEvent, "menuId" | "residenceId">,
  right: Pick<ZoneResidenceEvent, "menuId" | "residenceId">,
): boolean {
  return left.menuId === right.menuId && left.residenceId === right.residenceId;
}

export const ContentInteractRuntime = InteractRuntime;
export function createInteractRuntime(
  options: InteractRuntimeOptions,
): InteractRuntime {
  return new InteractRuntime(options);
}

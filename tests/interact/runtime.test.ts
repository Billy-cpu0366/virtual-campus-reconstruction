import { describe, expect, it } from "vitest";

import { GameplayControlLeaseRuntime } from "../../game/GameplayControlLeaseRuntime.js";
import { InteractRuntime } from "../../src/interact/index.js";
import type {
  ContentResolverPort,
  GameUiContentPayload,
  GameUiPort,
  GameUiHideRequest,
  GameUiShowRequest,
  HideResult,
  GameplayControlLeasePort,
  GameplayControlLeaseReleaseResult,
  GameplayControlLeaseShutdownResult,
  GameplayControlLeaseToken,
  ShowResult,
  UserCloseEvent,
  ZoneResidenceEvent,
} from "../../src/content/contract.js";

const payload: GameUiContentPayload = {
  menuId: "about",
  title: "About",
  body: ["Evidence-backed content"],
};

function event(
  menuId: ZoneResidenceEvent["menuId"],
  residenceId: string,
  phase: ZoneResidenceEvent["phase"] = "enter",
  markerId = `${menuId}-marker`,
): ZoneResidenceEvent {
  return { markerId, menuId, residenceId, phase };
}

class FakeUi implements GameUiPort {
  readonly shows: GameUiShowRequest[] = [];
  readonly hides: GameUiHideRequest[] = [];
  readonly calls: string[] = [];
  private closeHandler: ((event: UserCloseEvent) => void) | undefined;
  readonly showResults: ShowResult[] = [];
  readonly hideResults: HideResult[] = [];
  currentContent: GameUiShowRequest | undefined;
  hideThrows = false;
  private readonly trace: string[];

  constructor(trace: string[] = []) {
    this.trace = trace;
  }

  show(request: GameUiShowRequest): ShowResult {
    this.shows.push(request);
    const result = this.showResults.shift() ?? { status: "shown" };
    if (result.status === "shown" || result.status === "already-visible") {
      this.currentContent = request;
    }
    return result;
  }

  hide(request: GameUiHideRequest): HideResult {
    this.hides.push(request);
    this.calls.push(`hide:${request.reason}`);
    this.trace.push(`hide:${request.reason}`);
    if (this.hideThrows) throw new Error("hide failed");
    const result = this.hideResults.shift() ?? { status: "hidden" };
    if (result.status === "hidden" || result.status === "already-hidden") {
      this.currentContent = undefined;
    }
    return result;
  }

  destroy(): void {
    this.calls.push("destroy");
    this.trace.push("destroy");
  }

  subscribeUserClose(handler: (event: UserCloseEvent) => void): () => void {
    this.closeHandler = handler;
    return () => {
      this.calls.push("unsubscribe");
      this.trace.push("unsubscribe");
      this.closeHandler = undefined;
    };
  }

  emitClose(close: UserCloseEvent): void {
    this.closeHandler?.(close);
  }
}

class RecordingLease implements GameplayControlLeasePort {
  readonly calls: string[] = [];
  readonly acquiredTokens: GameplayControlLeaseToken[] = [];
  readonly releasedTokens: GameplayControlLeaseToken[] = [];
  private readonly activeTokens = new Set<GameplayControlLeaseToken>();
  private readonly trace: string[];

  constructor(trace: string[] = []) {
    this.trace = trace;
  }

  acquire() {
    this.calls.push("acquire");
    const token = Object.freeze({}) as unknown as GameplayControlLeaseToken;
    this.acquiredTokens.push(token);
    this.activeTokens.add(token);
    return { ok: true as const, token };
  }

  release(token: GameplayControlLeaseToken): GameplayControlLeaseReleaseResult {
    this.calls.push("release");
    this.trace.push("release");
    this.releasedTokens.push(token);
    this.activeTokens.delete(token);
    return { ok: true };
  }

  shutdown(): GameplayControlLeaseShutdownResult {
    this.calls.push("shutdown");
    return { ok: true };
  }

  get isAcquired(): boolean {
    return this.activeTokens.size > 0;
  }
}

function resolverFor(
  value: GameUiContentPayload | { status: "missing" } | { status: "invalid" } = payload,
): ContentResolverPort {
  return {
    resolve() {
      return "status" in value
        ? value
        : { status: "resolved", payload: value };
    },
  };
}

function runtime(
  ui: FakeUi,
  lease: GameplayControlLeasePort = new GameplayControlLeaseRuntime({
    disableControls: () => undefined,
    enableControls: () => undefined,
  }),
  resolver: ContentResolverPort = resolverFor(),
  receipts: Array<unknown> = [],
): InteractRuntime {
  return new InteractRuntime({
    resolver,
    ui,
    lease,
    onVisitReceipt: (receipt) => receipts.push(receipt),
  });
}

describe("InteractRuntime", () => {
  it("validates the resolver before acquiring or showing", () => {
    const ui = new FakeUi();
    const lease = new RecordingLease();
    const interact = runtime(ui, lease, resolverFor({ status: "invalid" }));

    expect(interact.handleResidenceEvent(event("about", "r1"))).toBe("invalid");
    expect(lease.calls).toEqual([]);
    expect(ui.shows).toEqual([]);

    const missing = runtime(new FakeUi(), new RecordingLease(),
      resolverFor({ status: "missing" }));
    expect(missing.handleResidenceEvent(event("about", "r2"))).toBe("missing");
  });

  it("acquires once, commits successful show, emits receipt, and sets backdrop policy", () => {
    const ui = new FakeUi();
    const lease = new RecordingLease();
    const receipts: unknown[] = [];
    const interact = runtime(ui, lease, resolverFor(), receipts);

    expect(interact.handleResidenceEvent(event("about", "r1"))).toBe("shown");
    expect(interact.handleResidenceEvent(event("about", "r1"))).toBe("ignored");
    expect(lease.calls).toEqual(["acquire"]);
    expect(receipts).toEqual([{
      markerId: "about-marker",
      menuId: "about",
      residenceId: "r1",
    }]);
    expect(ui.shows[0]?.presentation).toEqual({ backdrop: "none" });

    const memoPayload: GameUiContentPayload = {
      menuId: "memo1",
      title: "Memo",
      body: ["Memo content"],
      presentation: { backdrop: "none" },
    };
    const memo = runtime(ui, lease, resolverFor(memoPayload));
    expect(memo.handleResidenceEvent(event("memo1", "m1"))).toBe("shown");
    expect(ui.shows[1]?.presentation).toEqual({ backdrop: "global" });
  });

  it("replaces successfully without acquiring a second lease", () => {
    const ui = new FakeUi();
    const lease = new RecordingLease();
    const receipts: unknown[] = [];
    const interact = runtime(ui, lease, {
      resolve(menuId) {
        return {
          status: "resolved",
          payload: {
            menuId,
            title: menuId,
            body: ["content"],
          },
        };
      },
    }, receipts);

    expect(interact.handleResidenceEvent(event("about", "old"))).toBe("shown");
    expect(interact.handleResidenceEvent(event("cv", "new"))).toBe("shown");
    expect(interact.active).toEqual({
      markerId: "cv-marker",
      menuId: "cv",
      residenceId: "new",
    });
    expect(ui.currentContent).toMatchObject({
      menuId: "cv",
      residenceId: "new",
      payload: { menuId: "cv", title: "cv" },
    });
    expect(lease.calls).toEqual(["acquire"]);
    expect(receipts).toHaveLength(2);

    expect(interact.handleResidenceEvent(event("about", "old"))).toBe("ignored");
    expect(interact.active?.residenceId).toBe("new");
    expect(ui.shows).toHaveLength(2);
  });

  it("replaces with the existing lease and preserves old state on failure", () => {
    const ui = new FakeUi();
    const lease = new RecordingLease();
    const interact = runtime(ui, lease, {
      resolve(menuId) {
        return {
          status: "resolved",
          payload: {
            menuId,
            title: menuId,
            body: ["content"],
          },
        };
      },
    });

    expect(interact.handleResidenceEvent(event("about", "old"))).toBe("shown");
    expect(ui.currentContent).toMatchObject({
      menuId: "about",
      residenceId: "old",
      payload: { menuId: "about", title: "about" },
    });
    ui.showResults.push({ status: "missing-target" });
    expect(interact.handleResidenceEvent(event("cv", "new"))).toBe("show-failed");
    expect(interact.active).toEqual({
      markerId: "about-marker",
      menuId: "about",
      residenceId: "old",
    });
    expect(ui.currentContent).toMatchObject({
      menuId: "about",
      residenceId: "old",
      payload: { menuId: "about", title: "about" },
    });
    expect(lease.calls).toEqual(["acquire"]);

    expect(interact.handleResidenceEvent(event("about", "old", "leave"))).toBe("ignored");
    expect(ui.hides).toHaveLength(1);
    expect(lease.calls).toEqual(["acquire", "release"]);
  });

  it("ignores old menu identity on leave/close and does not suppress programmatic leave", () => {
    const ui = new FakeUi();
    const lease = new RecordingLease();
    const interact = runtime(ui, lease, {
      resolve(menuId) {
        return {
          status: "resolved",
          payload: { menuId, title: menuId, body: ["content"] },
        };
      },
    });

    interact.handleResidenceEvent(event("about", "r1"));
    interact.handleResidenceEvent(event("cv", "r2"));
    ui.emitClose({ menuId: "about", residenceId: "r1", source: "backdrop" });
    expect(interact.active?.menuId).toBe("cv");
    expect(interact.suppressedResidenceIds).toEqual([]);
    interact.handleResidenceEvent(event("about", "r1", "leave"));
    expect(interact.active?.menuId).toBe("cv");

    interact.handleResidenceEvent(event("cv", "r2", "leave"));
    expect(interact.active).toBeUndefined();
    expect(interact.suppressedResidenceIds).toEqual([]);
    expect(interact.handleResidenceEvent(event("cv", "r3"))).toBe("shown");
  });

  it("uses menuId and residenceId for stale close/leave and suppresses only one residence", () => {
    const ui = new FakeUi();
    const lease = new RecordingLease();
    const interact = runtime(ui, lease);

    interact.handleResidenceEvent(event("about", "r1"));
    ui.emitClose({ menuId: "cv", residenceId: "r1", source: "close-button" });
    expect(interact.active).toBeDefined();
    ui.emitClose({ menuId: "about", residenceId: "r1", source: "backdrop" });
    expect(interact.active).toBeUndefined();
    expect(interact.suppressedResidenceIds).toEqual(["r1"]);
    expect(interact.handleResidenceEvent(event("about", "r1"))).toBe("suppressed");

    expect(interact.handleResidenceEvent(event("about", "r1", "leave"))).toBe("ignored");
    expect(interact.suppressedResidenceIds).toEqual([]);
    expect(interact.handleResidenceEvent(event("about", "r2"))).toBe("shown");

    interact.handleResidenceEvent(event("about", "r1", "leave"));
    expect(ui.hides).toHaveLength(1);
    expect(interact.active?.residenceId).toBe("r2");
  });

  it("keeps active state recoverable for every user-close hide failure", () => {
    const failures: HideResult[] = [
      { status: "target-mismatch" },
      { status: "destroyed" },
    ];

    for (const failure of failures) {
      const ui = new FakeUi();
      ui.hideResults.push(failure);
      const lease = new RecordingLease();
      const interact = runtime(ui, lease);
      interact.handleResidenceEvent(event("about", "r1"));

      ui.emitClose({
        menuId: "about",
        residenceId: "r1",
        source: "close-button",
      });

      expect(interact.active?.residenceId).toBe("r1");
      expect(interact.suppressedResidenceIds).toEqual([]);
      expect(lease.calls).toEqual(["acquire"]);
    }

    const throwingUi = new FakeUi();
    throwingUi.hideThrows = true;
    const throwingLease = new RecordingLease();
    const throwing = runtime(throwingUi, throwingLease);
    throwing.handleResidenceEvent(event("about", "r2"));
    throwing.onUserClose({
      menuId: "about",
      residenceId: "r2",
      source: "backdrop",
    });
    expect(throwing.active?.residenceId).toBe("r2");
    expect(throwing.suppressedResidenceIds).toEqual([]);
    expect(throwingLease.calls).toEqual(["acquire"]);
  });

  it("accepts already-hidden user close before suppression and release", () => {
    const ui = new FakeUi();
    ui.hideResults.push({ status: "already-hidden" });
    const lease = new RecordingLease();
    const interact = runtime(ui, lease);
    interact.handleResidenceEvent(event("about", "r1"));

    ui.emitClose({
      menuId: "about",
      residenceId: "r1",
      source: "close-button",
    });

    expect(interact.active).toBeUndefined();
    expect(interact.suppressedResidenceIds).toEqual(["r1"]);
    expect(lease.calls).toEqual(["acquire", "release"]);
  });

  it("shared leases release each caller's own token", () => {
    const lease = new RecordingLease();
    const firstUi = new FakeUi();
    const secondUi = new FakeUi();
    const resolver: ContentResolverPort = {
      resolve(menuId) {
        return {
          status: "resolved",
          payload: { menuId, title: menuId, body: ["content"] },
        };
      },
    };
    const first = runtime(firstUi, lease, resolver);
    const second = runtime(secondUi, lease, resolver);

    first.handleResidenceEvent(event("about", "r1"));
    second.handleResidenceEvent(event("cv", "r2"));
    firstUi.emitClose({
      menuId: "about",
      residenceId: "r1",
      source: "backdrop",
    });
    secondUi.emitClose({
      menuId: "cv",
      residenceId: "r2",
      source: "backdrop",
    });

    expect(lease.acquiredTokens).toHaveLength(2);
    expect(lease.releasedTokens).toEqual(lease.acquiredTokens);
  });

  it("commits already-visible and never shows when acquire fails", () => {
    const ui = new FakeUi();
    ui.showResults.push({ status: "already-visible" });
    const receipts: unknown[] = [];
    const lease = new RecordingLease();
    const interact = runtime(ui, lease, resolverFor(), receipts);

    expect(interact.handleResidenceEvent(event("about", "r1"))).toBe("already-visible");
    expect(interact.active?.residenceId).toBe("r1");
    expect(receipts).toHaveLength(1);

    const failedLease: GameplayControlLeasePort = {
      acquire: () => ({ ok: false, reason: "disable-failed" }),
      release: () => ({ ok: true }),
      shutdown: () => ({ ok: true }),
    };
    const failedUi = new FakeUi();
    const failed = runtime(failedUi, failedLease);
    expect(failed.handleResidenceEvent(event("about", "r2"))).toBe("lease-failed");
    expect(failedUi.shows).toEqual([]);
  });

  it("does not leak an initial lease when show fails", () => {
    const ui = new FakeUi();
    const lease = new GameplayControlLeaseRuntime({
      disableControls: () => undefined,
      enableControls: () => undefined,
    });
    ui.showResults.push({ status: "invalid-payload" });
    const interact = runtime(ui, lease);

    expect(interact.handleResidenceEvent(event("about", "r1"))).toBe("show-failed");
    expect(lease.activeLeaseCount).toBe(0);
    expect(interact.active).toBeUndefined();
  });

  it("retains an enable-failed token and retries its release", () => {
    let enableAttempts = 0;
    const lease = new GameplayControlLeaseRuntime({
      disableControls: () => undefined,
      enableControls: () => {
        enableAttempts += 1;
        return enableAttempts > 1;
      },
    });
    const ui = new FakeUi();
    const interact = runtime(ui, lease);

    interact.handleResidenceEvent(event("about", "r1"));
    ui.emitClose({ menuId: "about", residenceId: "r1", source: "close-button" });
    expect(interact.pendingReleaseCount).toBe(1);
    expect(lease.activeLeaseCount).toBe(1);
    expect(interact.retryPendingReleases()).toBe(true);
    expect(interact.pendingReleaseCount).toBe(0);
    expect(lease.activeLeaseCount).toBe(0);
  });

  it("retries a leave release after enable-failed", () => {
    let enableAttempts = 0;
    const lease = new GameplayControlLeaseRuntime({
      disableControls: () => undefined,
      enableControls: () => {
        enableAttempts += 1;
        return enableAttempts > 1;
      },
    });
    const ui = new FakeUi();
    const interact = runtime(ui, lease);

    interact.handleResidenceEvent(event("about", "r1"));
    interact.handleResidenceEvent(event("about", "r1", "leave"));

    expect(interact.active).toBeUndefined();
    expect(interact.pendingReleaseCount).toBe(1);
    expect(lease.activeLeaseCount).toBe(1);
    expect(interact.retryPendingReleases()).toBe(true);
    expect(interact.pendingReleaseCount).toBe(0);
    expect(lease.activeLeaseCount).toBe(0);
  });

  it("retries a destroy release after enable-failed", () => {
    let enableAttempts = 0;
    const lease = new GameplayControlLeaseRuntime({
      disableControls: () => undefined,
      enableControls: () => {
        enableAttempts += 1;
        return enableAttempts > 1;
      },
    });
    const ui = new FakeUi();
    const interact = runtime(ui, lease);

    interact.handleResidenceEvent(event("about", "r1"));
    interact.destroy();

    expect(interact.active).toBeUndefined();
    expect(interact.pendingReleaseCount).toBe(1);
    expect(lease.activeLeaseCount).toBe(1);
    expect(interact.retryPendingReleases()).toBe(true);
    expect(interact.pendingReleaseCount).toBe(0);
    expect(lease.activeLeaseCount).toBe(0);
  });

  it("destroy unsubscribes, hides, destroys, releases, and never shuts down provider", () => {
    const trace: string[] = [];
    const ui = new FakeUi(trace);
    const lease = new RecordingLease(trace);
    const interact = runtime(ui, lease);
    interact.handleResidenceEvent(event("about", "r1"));

    interact.destroy();
    interact.destroy();
    ui.emitClose({ menuId: "about", residenceId: "r1", source: "backdrop" });

    expect(ui.calls).toEqual(["unsubscribe", "hide:shutdown", "destroy"]);
    expect(trace).toEqual([
      "unsubscribe",
      "hide:shutdown",
      "destroy",
      "release",
    ]);
    expect(lease.calls).toEqual(["acquire", "release"]);
    expect(lease.calls).not.toContain("shutdown");
    expect(interact.isDestroyed).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { GameplayControlLeaseRuntime } from "../../game/GameplayControlLeaseRuntime.js";
import type { GameplayControlLeaseToken } from "../../src/content/contract.js";

function tokenFrom(
  result: ReturnType<GameplayControlLeaseRuntime["acquire"]>,
): GameplayControlLeaseToken {
  if (!result.ok) throw new Error(`acquire failed: ${result.reason}`);
  return result.token;
}

describe("GameplayControlLeaseRuntime", () => {
  it("首个 token disable，后续 acquire 不重复 disable", () => {
    const calls: string[] = [];
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => {
        calls.push("disable");
      },
      enableControls: () => {
        calls.push("enable");
      },
    });

    const first = runtime.acquire("modal-open");
    const second = runtime.acquire("camera-tour");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls).toEqual(["disable"]);
    expect(runtime.activeLeaseCount).toBe(2);
  });

  it("非末 token release 不 enable，末 token 才恢复", () => {
    const calls: string[] = [];
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => {
        calls.push("disable");
      },
      enableControls: () => {
        calls.push("enable");
      },
    });
    const first = tokenFrom(runtime.acquire());
    const second = tokenFrom(runtime.acquire());

    expect(runtime.release(first)).toEqual({ ok: true });
    expect(calls).toEqual(["disable"]);
    expect(runtime.release(second)).toEqual({ ok: true });
    expect(calls).toEqual(["disable", "enable"]);
    expect(runtime.isDisabled).toBe(false);
  });

  it("disable 失败时不发布 token，且不向外抛 effect 异常", () => {
    let attempts = 0;
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => {
        attempts += 1;
        throw new Error("disable failed");
      },
      enableControls: () => undefined,
    });

    expect(() => runtime.acquire()).not.toThrow();
    expect(runtime.acquire()).toEqual({ ok: false, reason: "disable-failed" });
    expect(runtime.activeLeaseCount).toBe(0);
    expect(attempts).toBe(2);
  });

  it("unknown token 和已 release token 都是安全结果", () => {
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => undefined,
      enableControls: () => undefined,
    });
    const issued = tokenFrom(runtime.acquire());
    const unknown = Object.freeze({}) as unknown as GameplayControlLeaseToken;

    expect(runtime.release(unknown)).toEqual({
      ok: false,
      reason: "unknown-token",
    });
    expect(runtime.release(issued)).toEqual({ ok: true });
    expect(runtime.release(issued)).toEqual({
      ok: false,
      reason: "stale-token",
    });
  });

  it("末 token enable 失败时保留 token，允许重试", () => {
    let enableAttempts = 0;
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => undefined,
      enableControls: () => {
        enableAttempts += 1;
        if (enableAttempts === 1) throw new Error("enable failed");
      },
    });
    const issued = tokenFrom(runtime.acquire());

    expect(runtime.release(issued)).toEqual({
      ok: false,
      reason: "enable-failed",
    });
    expect(runtime.activeLeaseCount).toBe(1);
    expect(runtime.release(issued)).toEqual({ ok: true });
    expect(runtime.activeLeaseCount).toBe(0);
  });

  it("shutdown 幂等、拒绝新 token，并使所有旧 token 失效", () => {
    const calls: string[] = [];
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => {
        calls.push("disable");
      },
      enableControls: () => {
        calls.push("enable");
      },
    });
    const first = tokenFrom(runtime.acquire());
    const second = tokenFrom(runtime.acquire());

    expect(runtime.shutdown()).toEqual({ ok: true });
    expect(runtime.shutdown()).toEqual({ ok: true });
    expect(runtime.acquire()).toEqual({ ok: false, reason: "shutdown" });
    expect(runtime.release(first)).toEqual({ ok: false, reason: "shutdown" });
    expect(runtime.release(second)).toEqual({ ok: false, reason: "shutdown" });
    expect(calls).toEqual(["disable"]);
    expect(runtime.isDisabled).toBe(true);
  });

  it("没有 token 时 shutdown 也确保禁用，失败仍保持终态", () => {
    let attempts = 0;
    const runtime = new GameplayControlLeaseRuntime({
      disableControls: () => {
        attempts += 1;
        return false;
      },
      enableControls: () => undefined,
    });

    expect(runtime.shutdown()).toEqual({ ok: false, reason: "disable-failed" });
    expect(runtime.shutdown()).toEqual({ ok: false, reason: "disable-failed" });
    expect(runtime.acquire()).toEqual({ ok: false, reason: "shutdown" });
    expect(runtime.isDisabled).toBe(true);
    expect(attempts).toBe(1);
  });
});

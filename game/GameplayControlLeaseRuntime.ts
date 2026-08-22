import {
  type GameplayControlLeaseAcquireResult,
  type GameplayControlLeaseEffects,
  type GameplayControlLeasePort,
  type GameplayControlLeaseReason,
  type GameplayControlLeaseReleaseResult,
  type GameplayControlLeaseShutdownResult,
  type GameplayControlLeaseToken,
} from "../src/content/contract.js";

export interface GameplayControlLeaseRuntimeOptions
  extends Partial<GameplayControlLeaseEffects> {
  readonly disable?: () => void | boolean;
  readonly enable?: () => void | boolean;
}

type Effect = () => void | boolean;

function effectFrom(
  options: GameplayControlLeaseRuntimeOptions,
  primary: "disableControls" | "enableControls",
  alias: "disable" | "enable",
): Effect {
  const effect = options[primary] ?? options[alias];
  return effect ?? (() => undefined);
}

/** Main-owned reference-counted control gate with opaque identity tokens. */
export class GameplayControlLeaseRuntime
  implements GameplayControlLeasePort
{
  private readonly disableControls: Effect;
  private readonly enableControls: Effect;
  private readonly activeTokens = new Set<GameplayControlLeaseToken>();
  private readonly issuedTokens = new Set<GameplayControlLeaseToken>();
  private shutdownResult: GameplayControlLeaseShutdownResult | undefined;
  private controlsDisabled = false;

  constructor(options: GameplayControlLeaseRuntimeOptions) {
    this.disableControls = effectFrom(options, "disableControls", "disable");
    this.enableControls = effectFrom(options, "enableControls", "enable");
  }

  get activeLeaseCount(): number {
    return this.activeTokens.size;
  }

  get isDisabled(): boolean {
    return this.controlsDisabled;
  }

  get isShutdown(): boolean {
    return this.shutdownResult !== undefined;
  }

  acquire(
    _reason: GameplayControlLeaseReason = "modal-open",
  ): GameplayControlLeaseAcquireResult {
    if (this.shutdownResult !== undefined) {
      return { ok: false, reason: "shutdown" };
    }

    if (this.activeTokens.size === 0) {
      if (!this.runEffect(this.disableControls)) {
        return { ok: false, reason: "disable-failed" };
      }
      this.controlsDisabled = true;
    }

    const token = Object.freeze({}) as unknown as GameplayControlLeaseToken;
    this.activeTokens.add(token);
    this.issuedTokens.add(token);
    return { ok: true, token };
  }

  release(
    token: GameplayControlLeaseToken,
  ): GameplayControlLeaseReleaseResult {
    if (this.shutdownResult !== undefined) {
      return { ok: false, reason: "shutdown" };
    }
    if (!this.activeTokens.has(token)) {
      return {
        ok: false,
        reason: this.issuedTokens.has(token) ? "stale-token" : "unknown-token",
      };
    }

    if (this.activeTokens.size > 1) {
      this.activeTokens.delete(token);
      return { ok: true };
    }

    if (!this.runEffect(this.enableControls)) {
      return { ok: false, reason: "enable-failed" };
    }
    this.activeTokens.delete(token);
    this.controlsDisabled = false;
    return { ok: true };
  }

  shutdown(): GameplayControlLeaseShutdownResult {
    if (this.shutdownResult !== undefined) return this.shutdownResult;

    this.shutdownResult = { ok: true };
    this.activeTokens.clear();
    if (!this.controlsDisabled && !this.runEffect(this.disableControls)) {
      this.shutdownResult = { ok: false, reason: "disable-failed" };
    }
    // Shutdown is terminal: callers must observe the scene as disabled even
    // when the injected effect rejected. No token can be reacquired after it.
    this.controlsDisabled = true;
    return this.shutdownResult;
  }

  private runEffect(effect: Effect): boolean {
    try {
      return effect() !== false;
    } catch {
      return false;
    }
  }
}

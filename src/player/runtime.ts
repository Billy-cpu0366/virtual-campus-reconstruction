import type { Direction } from "../input/index.js";
import type { IdleAnimation } from "./contract.js";
import {
  IDLE_ANIMATIONS,
  IDLE_TIME_FOR_EATING,
  IDLE_TIME_FOR_SITTING,
} from "./idle.js";
import { DEFAULT_FACING } from "./facing.js";

export type PlayerStatus =
  | "disabled"
  | "normal-idle"
  | "walking"
  | "idle-action"
  | "sitting-down"
  | "sitting"
  | "standing-up"
  | "shutdown";

export interface PlayerPositionSnapshot {
  readonly x: number;
  readonly y: number;
}

export interface PlayerControlSnapshot {
  readonly enabled: boolean;
  readonly shutdown: boolean;
  readonly status: PlayerStatus;
  readonly visualLocked: boolean;
}

export interface PlayerUpdateResult {
  readonly movementDirection: Direction | null;
  readonly visualLocked: boolean;
  readonly status: PlayerStatus;
  readonly facing: Direction;
  readonly idleAnimation: IdleAnimation | null;
  readonly pendingDirection: Direction | null;
}

export interface PlayerControlEffects {
  readonly resetKeyboard: () => void;
  readonly resetJoystick: () => void;
  readonly stopMovement: () => void;
}

export interface PlayerRuntimeAvailability {
  readonly idleAnimations: readonly IdleAnimation[];
  readonly sitting: boolean;
}

export interface PlayerRuntimeOptions {
  readonly initialPosition?: PlayerPositionSnapshot;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly effects?: PlayerControlEffects;
}

const NOOP_EFFECTS: PlayerControlEffects = {
  resetKeyboard: () => undefined,
  resetJoystick: () => undefined,
  stopMovement: () => undefined,
};

const ALL_AVAILABLE: PlayerRuntimeAvailability = {
  idleAnimations: IDLE_ANIMATIONS,
  sitting: true,
};

function isVisualLocked(status: PlayerStatus): boolean {
  return (
    status === "disabled" ||
    status === "idle-action" ||
    status === "sitting-down" ||
    status === "sitting" ||
    status === "standing-up" ||
    status === "shutdown"
  );
}

export class PlayerRuntimeStateMachine {
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly effects: PlayerControlEffects;
  private positionState: PlayerPositionSnapshot;
  private controlEnabled = false;
  private shutdownState = false;
  private statusState: PlayerStatus = "disabled";
  private facingState: Direction = DEFAULT_FACING;
  private activeIdleState: IdleAnimation | undefined;
  private previousIdleState: IdleAnimation | undefined;
  private pendingDirectionState: Direction | undefined;
  private lastMovementAt: number;
  private lastIdleAnimationAt: number;

  constructor(options: PlayerRuntimeOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
    this.effects = options.effects ?? NOOP_EFFECTS;
    this.positionState = Object.freeze({
      x: options.initialPosition?.x ?? 0,
      y: options.initialPosition?.y ?? 0,
    });
    const createdAt = this.now();
    this.lastMovementAt = createdAt;
    this.lastIdleAnimationAt = createdAt;
  }

  get position(): PlayerPositionSnapshot {
    return Object.freeze({ ...this.positionState });
  }

  get control(): PlayerControlSnapshot {
    return Object.freeze({
      enabled: this.controlEnabled,
      shutdown: this.shutdownState,
      status: this.statusState,
      visualLocked: isVisualLocked(this.statusState),
    });
  }

  get status(): PlayerStatus {
    return this.statusState;
  }

  get facing(): Direction {
    return this.facingState;
  }

  get activeIdleAnimation(): IdleAnimation | null {
    return this.activeIdleState ?? null;
  }

  get previousIdleAnimation(): IdleAnimation | undefined {
    return this.previousIdleState;
  }

  get pendingDirection(): Direction | null {
    return this.pendingDirectionState ?? null;
  }

  setPosition(x: number, y: number): void {
    if (this.shutdownState) return;
    this.positionState = Object.freeze({ x, y });
  }

  enableControls(nowMs: number = this.now()): boolean {
    if (this.shutdownState) return false;
    this.controlEnabled = true;
    this.resetState(nowMs, "normal-idle");
    return true;
  }

  disableControls(nowMs: number = this.now()): boolean {
    if (this.shutdownState) return false;
    this.controlEnabled = false;
    this.resetState(nowMs, "disabled");
    this.invokeControlEffects();
    return true;
  }

  reset(nowMs: number = this.now()): boolean {
    if (this.shutdownState) return false;
    this.resetState(
      nowMs,
      this.controlEnabled ? "normal-idle" : "disabled",
    );
    this.invokeControlEffects();
    return true;
  }

  blur(nowMs: number = this.now()): boolean {
    return this.reset(nowMs);
  }

  shutdown(): boolean {
    if (this.shutdownState) return false;
    this.shutdownState = true;
    this.controlEnabled = false;
    this.activeIdleState = undefined;
    this.pendingDirectionState = undefined;
    this.statusState = "shutdown";
    this.invokeControlEffects();
    return true;
  }

  update(
    direction: Direction | null,
    nowMs: number = this.now(),
    availability: PlayerRuntimeAvailability = ALL_AVAILABLE,
  ): PlayerUpdateResult {
    this.assertActive();
    if (!this.controlEnabled) {
      return this.result(null);
    }

    if (direction !== null) {
      this.facingState = direction;
      this.lastMovementAt = nowMs;
      if (
        this.statusState === "sitting-down" ||
        this.statusState === "sitting" ||
        this.statusState === "standing-up"
      ) {
        this.statusState = "standing-up";
        this.activeIdleState = undefined;
        this.pendingDirectionState = direction;
        return this.result(null);
      }

      this.statusState = "walking";
      this.activeIdleState = undefined;
      this.pendingDirectionState = undefined;
      return this.result(direction);
    }

    if (this.statusState === "walking") {
      this.statusState = "normal-idle";
      this.lastMovementAt = nowMs;
    }
    if (isVisualLocked(this.statusState)) {
      return this.result(null);
    }

    const idleMs = nowMs - this.lastMovementAt;
    if (idleMs >= IDLE_TIME_FOR_SITTING) {
      if (availability.sitting) {
        this.statusState = "sitting-down";
        return this.result(null);
      }
      this.resetState(nowMs, "normal-idle");
      return this.result(null);
    }

    const sinceLastIdleAnimation = nowMs - this.lastIdleAnimationAt;
    if (
      idleMs >= IDLE_TIME_FOR_EATING &&
      sinceLastIdleAnimation >= IDLE_TIME_FOR_EATING
    ) {
      const candidates = availability.idleAnimations.filter(
        (animation) =>
          IDLE_ANIMATIONS.includes(animation) &&
          animation !== this.previousIdleState,
      );
      const selected = this.selectIdleAnimation(candidates);
      if (selected !== undefined) {
        this.activeIdleState = selected;
        this.previousIdleState = selected;
        this.statusState = "idle-action";
        return this.result(null);
      }
    }

    this.statusState = "normal-idle";
    return this.result(null);
  }

  completeIdleAnimation(nowMs: number = this.now()): boolean {
    if (this.shutdownState || this.statusState !== "idle-action") {
      return false;
    }
    this.activeIdleState = undefined;
    this.statusState = "normal-idle";
    this.lastIdleAnimationAt = nowMs;
    return true;
  }

  completeSittingDown(): boolean {
    if (this.shutdownState || this.statusState !== "sitting-down") {
      return false;
    }
    this.statusState = "sitting";
    return true;
  }

  completeStandingUp(nowMs: number = this.now()): Direction | null {
    if (this.shutdownState || this.statusState !== "standing-up") {
      return null;
    }
    const pending = this.pendingDirectionState ?? null;
    this.pendingDirectionState = undefined;
    this.statusState = "normal-idle";
    this.lastMovementAt = nowMs;
    this.lastIdleAnimationAt = nowMs;
    return pending;
  }

  recoverToNormalIdle(nowMs: number = this.now()): boolean {
    if (this.shutdownState) return false;
    this.resetState(
      nowMs,
      this.controlEnabled ? "normal-idle" : "disabled",
    );
    return true;
  }

  private resetState(nowMs: number, status: PlayerStatus): void {
    this.statusState = status;
    this.activeIdleState = undefined;
    this.pendingDirectionState = undefined;
    this.lastMovementAt = nowMs;
    this.lastIdleAnimationAt = nowMs;
  }

  private selectIdleAnimation(
    candidates: readonly IdleAnimation[],
  ): IdleAnimation | undefined {
    if (candidates.length === 0) return undefined;
    const random = this.random();
    const normalized = Number.isFinite(random)
      ? Math.min(Math.max(random, 0), 0.999999999999)
      : 0;
    return candidates[Math.floor(normalized * candidates.length)];
  }

  private invokeControlEffects(): void {
    this.effects.resetKeyboard();
    this.effects.resetJoystick();
    this.effects.stopMovement();
  }

  private assertActive(): void {
    if (this.shutdownState) {
      throw new Error("玩家运行时已关闭");
    }
  }

  private result(movementDirection: Direction | null): PlayerUpdateResult {
    return Object.freeze({
      movementDirection,
      visualLocked: isVisualLocked(this.statusState),
      status: this.statusState,
      facing: this.facingState,
      idleAnimation: this.activeIdleState ?? null,
      pendingDirection: this.pendingDirectionState ?? null,
    });
  }
}

export const PLAYER_IDLE_ACTIONS = IDLE_ANIMATIONS;

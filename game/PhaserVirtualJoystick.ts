import {
  joystickDirection,
  joystickParams,
  type DeviceKind,
  type Direction,
} from "../src/input/index.js";
import type { InputConfigs } from "../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js";

type Listener = (...args: any[]) => void;

interface EventEmitterLike {
  on(event: string, listener: Listener, context?: unknown): this;
  off(event: string, listener: Listener, context?: unknown): this;
}

interface GraphicsLike {
  clear(): this;
  fillStyle(color: number, alpha?: number): this;
  fillCircle(x: number, y: number, radius: number): this;
  lineStyle(lineWidth: number, color: number, alpha?: number): this;
  strokeCircle(x: number, y: number, radius: number): this;
  setPosition(x: number, y: number): this;
  setScrollFactor(x: number, y?: number): this;
  setDepth(value: number): this;
  setVisible(value: boolean): this;
  destroy(): void;
}

export interface JoystickSceneLike {
  add: { graphics(): GraphicsLike };
  input: EventEmitterLike;
  scale: EventEmitterLike & {
    width: number;
    height: number;
    getViewPort?(): { x: number; y: number; width: number; height: number };
  };
}

interface PointerLike {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

interface ViewportEnvironment {
  readonly innerWidth?: number;
  readonly navigator?: {
    readonly maxTouchPoints?: number;
    readonly userAgent?: string;
  };
  readonly matchMedia?: (query: string) => { matches: boolean };
  readonly ontouchstart?: unknown;
}

export interface VirtualJoystickState {
  readonly active: boolean;
  readonly direction: Direction | null;
  readonly forceX: number;
  readonly forceY: number;
  readonly device: DeviceKind;
  readonly pointerId: number | null;
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
}

export function deviceKindForViewport(
  tabletBreakpoint: number,
  environment: ViewportEnvironment = globalThis as ViewportEnvironment,
): DeviceKind {
  const width = environment.innerWidth ?? 0;
  const maxTouchPoints = environment.navigator?.maxTouchPoints ?? 0;
  const userAgent = environment.navigator?.userAgent ?? "";
  const coarsePointer = environment.matchMedia?.("(pointer: coarse)").matches;
  const hasTouch =
    maxTouchPoints > 0 ||
    coarsePointer === true ||
    environment.ontouchstart !== undefined ||
    /Android|iPhone|iPad|Mobile/i.test(userAgent);

  if (!hasTouch) {
    return "desktop";
  }
  return width >= tabletBreakpoint ? "tablet" : "mobile";
}

export function deviceKindForPhaserScene(scene: unknown, tabletBreakpoint: number): DeviceKind {
  const os = (scene as { readonly sys?: any }).sys?.game?.device?.os;
  if (os?.desktop === true) {
    return "desktop";
  }
  if (os?.tablet === true) {
    return "tablet";
  }
  return deviceKindForViewport(tabletBreakpoint);
}

export class PhaserVirtualJoystick {
  readonly device: DeviceKind;
  readonly params: ReturnType<typeof joystickParams>;

  private readonly base: GraphicsLike;
  private readonly thumb: GraphicsLike;
  private pointerId: number | undefined;
  private directionState: Direction | null = null;
  private forceX = 0;
  private forceY = 0;
  private activeState = false;
  private visible = false;
  private x = 0;
  private y = 0;
  private destroyed = false;

  private readonly handlePointerDown = (pointer: PointerLike): void => {
    if (
      this.destroyed ||
      !this.visible ||
      this.activeState ||
      !this.isInBase(pointer.x, pointer.y)
    ) {
      return;
    }
    this.pointerId = pointer.id;
    this.activeState = true;
    this.updateFromPointer(pointer);
  };

  private readonly handlePointerMove = (pointer: PointerLike): void => {
    if (!this.owns(pointer)) {
      return;
    }
    this.updateFromPointer(pointer);
  };

  private readonly handlePointerUp = (pointer: PointerLike): void => {
    if (this.owns(pointer)) {
      this.reset();
    }
  };

  private readonly handleResize = (): void => {
    if (!this.destroyed) {
      this.reposition();
    }
  };

  constructor(
    private readonly scene: JoystickSceneLike,
    device: DeviceKind,
    private readonly config: InputConfigs,
  ) {
    this.device = device;
    this.params = joystickParams(device, config.joystick.device, config.joystick.forceMin);
    this.base = scene.add.graphics();
    this.thumb = scene.add.graphics();
    this.base.setScrollFactor(0, 0).setDepth(config.joystick.depth);
    this.thumb.setScrollFactor(0, 0).setDepth(config.joystick.depth + 1);
    this.visible = device !== "desktop" || config.desktop.joystickVisible;
    this.drawBase();
    this.drawThumb();
    this.reposition();

    scene.input.on("pointerdown", this.handlePointerDown, this);
    scene.input.on("pointermove", this.handlePointerMove, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
    scene.scale.on("resize", this.handleResize, this);
  }

  get active(): boolean {
    return this.activeState;
  }

  get direction(): Direction | null {
    return this.directionState;
  }

  get isActive(): boolean {
    return this.active;
  }

  get currentDirection(): Direction | null {
    return this.direction;
  }

  reset(): void {
    if (this.destroyed) {
      return;
    }
    this.pointerId = undefined;
    this.activeState = false;
    this.directionState = null;
    this.forceX = 0;
    this.forceY = 0;
    this.thumb.setPosition(this.x, this.y);
  }

  debugState(): VirtualJoystickState {
    return {
      active: this.active,
      direction: this.direction,
      forceX: this.forceX,
      forceY: this.forceY,
      device: this.device,
      pointerId: this.pointerId ?? null,
      visible: this.visible,
      x: this.x,
      y: this.y,
    };
  }

  shutdown(): void {
    if (this.destroyed) {
      return;
    }
    this.reset();
    this.destroyed = true;
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
    this.scene.scale.off("resize", this.handleResize, this);
    this.base.destroy();
    this.thumb.destroy();
  }

  destroy(): void {
    this.shutdown();
  }

  private owns(pointer: PointerLike): boolean {
    return this.visible && this.activeState && pointer.id === this.pointerId;
  }

  private isInBase(pointerX: number, pointerY: number): boolean {
    const dx = pointerX - this.x;
    const dy = pointerY - this.y;
    const baseRadius = this.params.baseDiameter / 2;
    return dx * dx + dy * dy <= baseRadius * baseRadius;
  }

  private updateFromPointer(pointer: PointerLike): void {
    const forceX = pointer.x - this.x;
    const forceY = pointer.y - this.y;
    this.forceX = forceX;
    this.forceY = forceY;
    const distance = Math.hypot(forceX, forceY);
    this.directionState =
      distance >= this.params.forceMin
        ? joystickDirection(forceX, forceY, this.config.joystick.mainAxisRatio, this.config.vectors)
        : null;

    const thumbDistance = Math.min(distance, this.params.radius);
    const scale = distance === 0 ? 0 : thumbDistance / distance;
    this.thumb.setPosition(
      this.x + forceX * scale,
      this.y + forceY * scale,
    );
  }

  private reposition(): void {
    const viewport = this.scene.scale.getViewPort?.() ?? {
      x: 0, y: 0, width: this.scene.scale.width, height: this.scene.scale.height,
    };
    const baseRadius = this.params.baseDiameter / 2;
    const insetX = Math.min(Math.max(baseRadius, this.config.joystick.positionOffset), viewport.width / 2);
    const insetY = Math.min(Math.max(baseRadius, this.config.joystick.positionOffset), viewport.height / 2);
    this.x = viewport.x + viewport.width - insetX;
    this.y = viewport.y + viewport.height - insetY;
    this.base.setPosition(this.x, this.y).setVisible(this.visible);
    this.thumb.setPosition(this.x, this.y).setVisible(this.visible);
    if (this.activeState) {
      this.reset();
    }
  }

  private drawBase(): void {
    const radius = this.params.baseDiameter / 2;
    const { baseFill, baseStroke } = this.config.joystick.style;
    this.base
      .clear()
      .fillStyle(baseFill.color, baseFill.alpha)
      .fillCircle(0, 0, radius)
      .lineStyle(baseStroke.width, baseStroke.color, baseStroke.alpha)
      .strokeCircle(0, 0, radius);
  }

  private drawThumb(): void {
    const radius = this.params.thumbDiameter / 2;
    const { thumbFill, thumbStroke } = this.config.joystick.style;
    this.thumb
      .clear()
      .fillStyle(thumbFill.color, thumbFill.alpha)
      .fillCircle(0, 0, radius)
      .lineStyle(thumbStroke.width, thumbStroke.color, thumbStroke.alpha)
      .strokeCircle(0, 0, radius);
  }
}

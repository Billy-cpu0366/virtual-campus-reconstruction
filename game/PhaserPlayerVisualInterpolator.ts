const DEFAULT_STEP_MS = 1000 / 30;
const DEFAULT_SNAP_DISTANCE = 96;

export interface PhaserPlayerVisualFrameLike {
  readonly name: string | number;
}

export interface PhaserPlayerVisualTextureLike {
  readonly key: string;
}

export interface PhaserPlayerVisualSourceLike {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  readonly active: boolean;
  readonly alpha: number;
  readonly depth: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly originX: number;
  readonly originY: number;
  readonly texture: PhaserPlayerVisualTextureLike;
  readonly frame: PhaserPlayerVisualFrameLike;
}

export interface PhaserPlayerVisualSpriteLike {
  x: number;
  y: number;
  setPosition(x: number, y: number): this;
  setTexture(key: string, frame?: string | number): this;
  setDisplaySize(width: number, height: number): this;
  setOrigin(x: number, y: number): this;
  setFlip(x: boolean, y: boolean): this;
  setAlpha(alpha: number): this;
  setDepth(depth: number): this;
  setVisible(visible: boolean): this;
  destroy(): void;
}

export interface PhaserPlayerVisualSceneLike {
  readonly add: {
    sprite(
      x: number,
      y: number,
      texture: string,
      frame?: string | number,
    ): PhaserPlayerVisualSpriteLike;
  };
  readonly cameras: {
    readonly main: {
      ignore(target: unknown): unknown;
    };
  };
}

export interface PhaserPlayerVisualInterpolatorOptions {
  readonly stepMs?: number;
  readonly snapDistance?: number;
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`);
  }
  return value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Render-only mirror for a 30 Hz Arcade body. The source keeps all physics,
 * collision and state ownership; only this mirror is visible to the main
 * camera and it interpolates between committed physics positions.
 */
export class PhaserPlayerVisualInterpolator {
  readonly sprite: PhaserPlayerVisualSpriteLike;
  private readonly stepMs: number;
  private readonly snapDistance: number;
  private fromX: number;
  private fromY: number;
  private targetX: number;
  private targetY: number;
  private startedAt = 0;
  private shutdownState = false;

  constructor(
    scene: PhaserPlayerVisualSceneLike,
    private readonly source: PhaserPlayerVisualSourceLike,
    options: PhaserPlayerVisualInterpolatorOptions = {},
  ) {
    this.stepMs = finitePositive(options.stepMs ?? DEFAULT_STEP_MS, "stepMs");
    this.snapDistance = finitePositive(
      options.snapDistance ?? DEFAULT_SNAP_DISTANCE,
      "snapDistance",
    );
    this.fromX = source.x;
    this.fromY = source.y;
    this.targetX = source.x;
    this.targetY = source.y;
    this.sprite = scene.add.sprite(
      source.x,
      source.y,
      source.texture.key,
      source.frame.name,
    );
    scene.cameras.main.ignore(source);
    this.syncAppearance();
  }

  get position(): Readonly<{ x: number; y: number }> {
    return Object.freeze({ x: this.sprite.x, y: this.sprite.y });
  }

  update(nowMs: number): void {
    if (this.shutdownState || !Number.isFinite(nowMs)) return;
    this.advance(nowMs);

    if (this.source.x !== this.targetX || this.source.y !== this.targetY) {
      const distance = Math.hypot(
        this.source.x - this.targetX,
        this.source.y - this.targetY,
      );
      if (distance > this.snapDistance) {
        this.snapToSource(nowMs);
      } else {
        this.fromX = this.sprite.x;
        this.fromY = this.sprite.y;
        this.targetX = this.source.x;
        this.targetY = this.source.y;
        this.startedAt = nowMs;
      }
    }

    this.syncAppearance();
  }

  snap(nowMs: number): void {
    if (this.shutdownState || !Number.isFinite(nowMs)) return;
    this.snapToSource(nowMs);
    this.syncAppearance();
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.sprite.destroy();
  }

  private advance(nowMs: number): void {
    const ratio = clamp01((nowMs - this.startedAt) / this.stepMs);
    this.sprite.setPosition(
      this.fromX + (this.targetX - this.fromX) * ratio,
      this.fromY + (this.targetY - this.fromY) * ratio,
    );
  }

  private snapToSource(nowMs: number): void {
    this.fromX = this.source.x;
    this.fromY = this.source.y;
    this.targetX = this.source.x;
    this.targetY = this.source.y;
    this.startedAt = nowMs;
    this.sprite.setPosition(this.source.x, this.source.y);
  }

  private syncAppearance(): void {
    this.sprite
      .setTexture(this.source.texture.key, this.source.frame.name)
      .setDisplaySize(this.source.displayWidth, this.source.displayHeight)
      .setOrigin(this.source.originX, this.source.originY)
      .setFlip(this.source.flipX, this.source.flipY)
      .setAlpha(this.source.alpha)
      .setDepth(this.source.depth)
      .setVisible(this.source.visible && this.source.active);
  }
}

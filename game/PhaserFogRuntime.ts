import Phaser from "./phaser.js";

import {
  FOG_ORANGE_SMOKE_ASSET_KEY,
  FOG_ORANGE_SMOKE_CONFIG,
  FOG_ORANGE_SMOKE_ID,
  FOG_ORANGE_SMOKE_PRESENTATION_QUANTITY,
  FogRuntime,
  type FogPlayerInput,
  type FogPoint,
  type FogSnapshot,
  type FogViewport,
} from "../src/fx/index.js";

type FogListener = (...args: unknown[]) => void;

export interface PhaserFogTimerLike {
  remove?(): void;
  destroy?(): void;
}

export interface PhaserFogEmitterLike {
  emitting?: boolean;
  start(): void;
  stop(): void;
  setVisible?(value: boolean): this;
  setDepth(value: number): this;
  destroy(): void;
}

export interface PhaserFogEventsLike {
  on(event: string, listener: FogListener, context?: unknown): this;
  off(event: string, listener: FogListener, context?: unknown): this;
}

export interface PhaserFogSceneLike {
  readonly load: { image(key: string, url: string): unknown };
  readonly textures: { exists(key: string): boolean };
  readonly add: {
    particles(
      x: number,
      y: number,
      texture: string,
      config: Record<string, unknown>,
    ): PhaserFogEmitterLike;
  };
  readonly time?: {
    delayedCall(delay: number, callback: () => void): PhaserFogTimerLike;
    readonly now?: number;
  };
  readonly cameras?: {
    readonly main?: {
      readonly worldView?: FogViewport;
      readonly scrollX?: number;
      readonly scrollY?: number;
      readonly width?: number;
      readonly height?: number;
    };
  };
  readonly events: PhaserFogEventsLike;
}

export interface PhaserFogRuntimeOptions {
  readonly viewport?: () => FogViewport;
  readonly player?: () => FogPlayerInput | undefined;
  readonly cars?: () => readonly FogPoint[] | undefined;
  readonly onError?: (reason: string) => void;
}

export type PhaserFogStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "shutdown" | "missing-texture" | "emitter-create-failed";
    };

function viewportFromScene(scene: PhaserFogSceneLike): FogViewport | undefined {
  const main = scene.cameras?.main;
  if (main?.worldView !== undefined) return main.worldView;
  if (
    main?.scrollX === undefined ||
    main.scrollY === undefined ||
    main.width === undefined ||
    main.height === undefined
  ) {
    return undefined;
  }
  return {
    left: main.scrollX,
    top: main.scrollY,
    width: main.width,
    height: main.height,
  };
}

function timerRemove(timer: PhaserFogTimerLike | undefined): void {
  timer?.remove?.();
  timer?.destroy?.();
}

function circleSource(radius: number): unknown {
  const phaser = Phaser as any;
  return phaser?.Geom?.Circle === undefined
    ? { x: 0, y: 0, radius }
    : new phaser.Geom.Circle(0, 0, radius);
}

/** Phaser adapter for the S1 orange_smoke trajectory region. */
export class PhaserFogRuntime {
  private readonly runtime: FogRuntime;
  private readonly viewportProvider: (() => FogViewport) | undefined;
  private readonly playerProvider: (() => FogPlayerInput | undefined) | undefined;
  private readonly carsProvider: (() => readonly FogPoint[] | undefined) | undefined;
  private readonly onError: ((reason: string) => void) | undefined;
  private readonly emitters = new Map<string, PhaserFogEmitterLike>();
  private readonly respawnTimers = new Map<string, PhaserFogTimerLike>();
  private updateAttached = false;
  private shutdownState = false;

  private readonly handleUpdate: FogListener = (): void => this.update();
  private readonly handleShutdown: FogListener = (): void => this.shutdown();

  constructor(
    private readonly scene: PhaserFogSceneLike,
    options: PhaserFogRuntimeOptions = {},
  ) {
    this.runtime = new FogRuntime(options.cars !== undefined);
    this.viewportProvider = options.viewport;
    this.playerProvider = options.player;
    this.carsProvider = options.cars;
    this.onError = options.onError;
  }

  /** The smoke-white asset is already loaded by the existing factory owner. */
  preload(): void {}

  start(): PhaserFogStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    if (!this.scene.textures.exists(FOG_ORANGE_SMOKE_ASSET_KEY)) {
      this.report("missing-texture");
      return { ok: false, reason: "missing-texture" };
    }
    this.runtime.start();
    this.attachUpdate();
    try {
      this.createAllEmitters();
    } catch {
      this.report("emitter-create-failed");
      this.shutdown();
      return { ok: false, reason: "emitter-create-failed" };
    }
    this.update();
    return { ok: true };
  }

  update(viewport = this.viewportProvider?.() ?? viewportFromScene(this.scene)): void {
    if (this.shutdownState || viewport === undefined) return;
    const now = this.scene.time?.now ?? Date.now();
    const before = this.runtime.snapshot;
    this.runtime.updateViewport(viewport);
    this.runtime.updateInteractions(
      this.playerProvider?.(),
      this.carsProvider?.(),
      now,
    );
    this.syncSnapshot(before, now);
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.runtime.shutdown();
    this.detachUpdate();
    for (const timer of this.respawnTimers.values()) timerRemove(timer);
    this.respawnTimers.clear();
    for (const emitter of this.emitters.values()) {
      emitter.stop();
      emitter.destroy();
    }
    this.emitters.clear();
  }

  get snapshot(): FogSnapshot {
    return this.runtime.snapshot;
  }

  get emitterCount(): number {
    return this.emitters.size;
  }

  private createAllEmitters(): void {
    for (const cell of this.runtime.snapshot.cells) {
      if (this.emitters.has(cell.id)) continue;
      const emitter = this.scene.add.particles(
        cell.x,
        cell.y,
        FOG_ORANGE_SMOKE_ASSET_KEY,
        {
          speed: {
            min: FOG_ORANGE_SMOKE_CONFIG.speed * 0.3,
            max: FOG_ORANGE_SMOKE_CONFIG.speed,
          },
          angle: { min: 0, max: 360 },
          scale: { start: 0, end: FOG_ORANGE_SMOKE_CONFIG.scale },
          alpha: { start: FOG_ORANGE_SMOKE_CONFIG.alpha, end: 0 },
          lifespan: FOG_ORANGE_SMOKE_CONFIG.lifespan,
          quantity: FOG_ORANGE_SMOKE_PRESENTATION_QUANTITY,
          frequency: FOG_ORANGE_SMOKE_CONFIG.frequency,
          blendMode: FOG_ORANGE_SMOKE_CONFIG.blendMode,
          tint: FOG_ORANGE_SMOKE_CONFIG.tint,
          rotate: { min: 0, max: 360 },
          emitting: false,
          emitZone: {
            type: "random",
            source: circleSource(FOG_ORANGE_SMOKE_CONFIG.cellSize * 1.5 / 2),
          },
        },
      );
      emitter.setDepth(FOG_ORANGE_SMOKE_CONFIG.depth).setVisible?.(false);
      this.emitters.set(cell.id, emitter);
    }
  }

  private syncSnapshot(before: FogSnapshot, now: number): void {
    const snapshot = this.runtime.snapshot;
    for (const cell of snapshot.cells) {
      const emitter = this.emitters.get(cell.id);
      if (emitter === undefined) continue;
      const wasCleared = before.cells.find(
        (item) => item.id === cell.id,
      )?.cleared ?? false;
      if (cell.cleared && !wasCleared) {
        this.scheduleRespawn(cell.id, cell.respawnAt, now);
      }
      if (cell.cleared) {
        emitter.stop();
      } else if (cell.active) {
        emitter.setVisible?.(true);
        if (emitter.emitting !== true) emitter.start();
      } else {
        emitter.stop();
        emitter.setVisible?.(false);
      }
    }
  }

  private scheduleRespawn(id: string, respawnAt: number | null, now: number): void {
    if (respawnAt === null || this.scene.time === undefined) return;
    timerRemove(this.respawnTimers.get(id));
    const delay = Math.max(0, respawnAt - now);
    this.respawnTimers.set(id, this.scene.time.delayedCall(delay, () => {
      this.respawnTimers.delete(id);
      this.runtime.tick(this.scene.time?.now ?? respawnAt);
      const cell = this.runtime.cellState(id);
      const emitter = this.emitters.get(id);
      if (cell?.active && emitter !== undefined) {
        emitter.setVisible?.(true);
        emitter.start();
      }
    }));
  }

  private attachUpdate(): void {
    if (this.updateAttached) return;
    this.scene.events.on("update", this.handleUpdate, this);
    this.scene.events.on("shutdown", this.handleShutdown, this);
    this.updateAttached = true;
  }

  private detachUpdate(): void {
    if (!this.updateAttached) return;
    this.scene.events.off("update", this.handleUpdate, this);
    this.scene.events.off("shutdown", this.handleShutdown, this);
    this.updateAttached = false;
  }

  private report(reason: string): void {
    this.onError?.(reason);
  }
}
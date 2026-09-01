import Phaser from "./phaser.js";

import {
  STOP_AI_SMOKE_ASSET_KEY,
  STOP_AI_SMOKE_CONFIG,
  STOP_AI_SMOKE_SITES,
  STOP_AI_SMOKE_WIND_MAX_DELAY_MS,
  STOP_AI_SMOKE_WIND_MAX_DURATION_MS,
  STOP_AI_SMOKE_WIND_MIN_DELAY_MS,
  STOP_AI_SMOKE_WIND_MIN_DURATION_MS,
  STOP_AI_SMOKE_WIND_START_DELAY_MS,
  STOP_AI_SMOKE_VISIBILITY_CHECK_MS,
  StopAiSmokeRuntime,
  stopAiSmokeEmitterConfig,
  stopAiSmokeSiteInViewport,
  type StopAiSmokeLayer,
  type StopAiSmokePlayerPosition,
  type StopAiSmokeSite,
  type StopAiSmokeViewport,
} from "../src/fx/index.js";

export const STOP_AI_SMOKE_RUNTIME_ASSET = Object.freeze({
  key: STOP_AI_SMOKE_ASSET_KEY,
});

type SmokeListener = (...args: unknown[]) => void;

export interface PhaserStopAiSmokeTimerLike {
  remove?(): void;
  destroy?(): void;
}

export interface PhaserStopAiSmokeEmitterLike {
  emitting?: boolean;
  gravityX?: number;
  start(): void;
  stop(): void;
  setVisible(value: boolean): this;
  setDepth(value: number): this;
  destroy(): void;
}

export interface PhaserStopAiSmokeGraphicsLike {
  setPosition?(x: number, y: number): this;
  setRotation?(value: number): this;
  setDepth(value: number): this;
  setVisible?(value: boolean): this;
  fillStyle?(color: number, alpha: number): this;
  fillRect?(x: number, y: number, width: number, height: number): this;
  fillEllipse?(x: number, y: number, width: number, height: number): this;
  clear(): this;
  destroy(): void;
}

export interface PhaserStopAiSmokeEventsLike {
  on(event: string, listener: SmokeListener, context?: unknown): this;
  off(event: string, listener: SmokeListener, context?: unknown): this;
}

export interface PhaserStopAiSmokeSceneLike {
  readonly load: { image(key: string, url: string): unknown };
  readonly textures: { exists(key: string): boolean };
  readonly add: {
    particles(
      x: number,
      y: number,
      texture: string,
      config: Record<string, unknown>,
    ): PhaserStopAiSmokeEmitterLike;
    graphics(): PhaserStopAiSmokeGraphicsLike;
  };
  readonly time?: {
    delayedCall(
      delay: number,
      callback: () => void,
    ): PhaserStopAiSmokeTimerLike;
    readonly now?: number;
  };
  readonly cameras?: {
    readonly main?: {
      readonly worldView?: StopAiSmokeViewport;
      readonly scrollX?: number;
      readonly scrollY?: number;
      readonly width?: number;
      readonly height?: number;
    };
  };
  readonly events: PhaserStopAiSmokeEventsLike;
}

export interface PhaserStopAiSmokeRuntimeOptions {
  readonly viewport?: () => StopAiSmokeViewport;
  readonly playerPosition?: () => StopAiSmokePlayerPosition | undefined;
  readonly onError?: (reason: string) => void;
}

export type PhaserStopAiSmokeStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "shutdown" | "missing-texture" | "emitter-create-failed";
    };

function viewportFromScene(
  scene: PhaserStopAiSmokeSceneLike,
): StopAiSmokeViewport | undefined {
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

function timerRemove(timer: PhaserStopAiSmokeTimerLike | undefined): void {
  timer?.remove?.();
  timer?.destroy?.();
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function circleSource(radius: number): unknown {
  const phaser = Phaser as any;
  return phaser?.Geom?.Circle === undefined
    ? { x: 0, y: 0, radius }
    : new phaser.Geom.Circle(0, 0, radius);
}

/** Phaser adapter for the independently-owned Stop AI canister effects. */
export class PhaserStopAiSmokeRuntime {
  private readonly runtime = new StopAiSmokeRuntime();
  private readonly viewportProvider: (() => StopAiSmokeViewport) | undefined;
  private readonly playerPositionProvider:
    | (() => StopAiSmokePlayerPosition | undefined)
    | undefined;
  private readonly onError: ((reason: string) => void) | undefined;
  private readonly emitters = new Map<string, PhaserStopAiSmokeEmitterLike>();
  private readonly graphics = new Map<StopAiSmokeSite, PhaserStopAiSmokeGraphicsLike>();
  private readonly windTimers = new Map<string, PhaserStopAiSmokeTimerLike>();
  private readonly windResetTimers = new Map<string, PhaserStopAiSmokeTimerLike>();
  private updateAttached = false;
  private shutdownState = false;
  private lastVisibilityCheckAt: number | undefined;

  private readonly handleUpdate: SmokeListener = (): void => this.update();
  private readonly handleShutdown: SmokeListener = (): void => this.shutdown();

  constructor(
    private readonly scene: PhaserStopAiSmokeSceneLike,
    options: PhaserStopAiSmokeRuntimeOptions = {},
  ) {
    this.viewportProvider = options.viewport;
    this.playerPositionProvider = options.playerPosition;
    this.onError = options.onError;
  }

  /** The shared smoke-white asset is preloaded by the existing factory owner. */
  preload(): void {}

  start(): PhaserStopAiSmokeStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    if (!this.scene.textures.exists(STOP_AI_SMOKE_ASSET_KEY)) {
      this.report("missing-texture");
      return { ok: false, reason: "missing-texture" };
    }
    const result = this.runtime.start();
    if (!result.ok) return result;
    if (this.graphics.size === 0) {
      try {
        for (const site of STOP_AI_SMOKE_SITES) {
          this.graphics.set(site.site, this.createCanisterGraphic(site));
        }
      } catch {
        this.runtime.shutdown();
        this.cleanupObjects();
        this.report("emitter-create-failed");
        return { ok: false, reason: "emitter-create-failed" };
      }
    }
    this.attachUpdate();
    this.update();
    return { ok: true };
  }

  update(viewport = this.viewportProvider?.() ?? viewportFromScene(this.scene)): void {
    if (this.shutdownState || viewport === undefined) return;
    const now = this.scene.time?.now;
    const checkEmitters =
      now === undefined ||
      this.lastVisibilityCheckAt === undefined ||
      now - this.lastVisibilityCheckAt >= STOP_AI_SMOKE_VISIBILITY_CHECK_MS;
    if (checkEmitters && now !== undefined) {
      this.lastVisibilityCheckAt = now;
    }
    this.runtime.setPlayerPosition(this.playerPositionProvider?.());
    const snapshot = this.runtime.updateViewport(viewport, checkEmitters);
    for (const site of STOP_AI_SMOKE_SITES) {
      this.graphics.get(site.site)?.setVisible?.(
        stopAiSmokeSiteInViewport(site.site, viewport),
      );
    }
    for (const item of snapshot.canisters) {
      const key = `${item.site}:${item.layer}`;
      if (item.active && !this.emitters.has(key)) {
        try {
          const emitter = this.createEmitter(item.site, item.layer);
          this.emitters.set(key, emitter);
          this.bindWindLoop(item.site, item.layer);
        } catch {
          this.report("emitter-create-failed");
          continue;
        }
      }
      const emitter = this.emitters.get(key);
      if (!item.active) {
        if (emitter !== undefined) this.destroyEmitter(key, item.site, item.layer);
        continue;
      }
      emitter?.setDepth(item.depth).setVisible(true);
      if (emitter !== undefined && emitter.emitting !== true) emitter.start();
    }
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    this.runtime.shutdown();
    this.detachUpdate();
    this.cleanupObjects();
  }

  get snapshot() {
    return this.runtime.snapshot;
  }

  get emitterCount(): number {
    return this.emitters.size;
  }

  get graphicsCount(): number {
    return this.graphics.size;
  }

  private createEmitter(
    site: StopAiSmokeSite,
    layer: StopAiSmokeLayer,
  ): PhaserStopAiSmokeEmitterLike {
    const config = stopAiSmokeEmitterConfig(site, layer);
    const emitter = this.scene.add.particles(
      config.x,
      config.y,
      STOP_AI_SMOKE_ASSET_KEY,
      {
        speed: STOP_AI_SMOKE_CONFIG.speed,
        angle: config.angle,
        scale: STOP_AI_SMOKE_CONFIG.scale,
        alpha: config.alpha,
        lifespan: STOP_AI_SMOKE_CONFIG.lifespan,
        quantity: STOP_AI_SMOKE_CONFIG.quantity,
        frequency: STOP_AI_SMOKE_CONFIG.frequency,
        gravityY: STOP_AI_SMOKE_CONFIG.gravityY,
        blendMode: STOP_AI_SMOKE_CONFIG.blendMode,
        tint: STOP_AI_SMOKE_CONFIG.tint,
        emitting: false,
        emitZone: { type: "random", source: circleSource(3) },
      },
    );
    emitter.setDepth(config.depth).setVisible(false);
    return emitter;
  }

  private createCanisterGraphic(
    site: (typeof STOP_AI_SMOKE_SITES)[number],
  ): PhaserStopAiSmokeGraphicsLike {
    const graphics = this.scene.add.graphics();
    const color = site.graphicColor;
    const red = (color >> 16) & 255;
    const green = (color >> 8) & 255;
    const blue = color & 255;
    const bands = 3;
    const bandHeight = 3 / bands;
    graphics.setPosition?.(site.x, site.y);
    for (let index = 0; index < bands; index += 1) {
      const factor = 1 - (index / (bands - 1)) * 0.4;
      const bandColor =
        (Math.floor(red * factor) << 16) |
        (Math.floor(green * factor) << 8) |
        Math.floor(blue * factor);
      graphics.fillStyle?.(bandColor, 1);
      graphics.fillRect?.(-4, -1.5 + index * bandHeight, 8, bandHeight + 0.5);
    }
    graphics.fillStyle?.(
      (Math.floor(red * 0.5) << 16) |
        (Math.floor(green * 0.5) << 8) |
        Math.floor(blue * 0.5),
      1,
    );
    graphics.fillEllipse?.(-4, 0, 1.5, 3);
    graphics.fillStyle?.(
      (Math.floor(red * 0.3) << 16) |
        (Math.floor(green * 0.3) << 8) |
        Math.floor(blue * 0.3),
      1,
    );
    graphics.fillEllipse?.(4, 0, 1.5, 3);
    graphics.setRotation?.(site.graphicAngle * Math.PI / 180);
    graphics.setDepth(400).setVisible?.(false);
    return graphics;
  }

  private bindWindLoop(site: StopAiSmokeSite, layer: StopAiSmokeLayer): void {
    const key = `${site}:${layer}`;
    this.clearWindTimers(key);
    const schedule = (delay: number): void => {
      if (this.shutdownState || this.scene.time === undefined) return;
      this.windTimers.set(key, this.scene.time.delayedCall(delay, () => {
        const emitter = this.emitters.get(key);
        if (emitter === undefined || this.shutdownState) return;
        const sign = Math.random() < 0.5 ? -1 : 1;
        emitter.gravityX = sign * randomBetween(15, 40);
        this.runtime.setWindActive(site, layer, true);
        this.windResetTimers.set(key, this.scene.time!.delayedCall(
          randomBetween(STOP_AI_SMOKE_WIND_MIN_DURATION_MS, STOP_AI_SMOKE_WIND_MAX_DURATION_MS),
          () => {
            if (this.emitters.get(key) !== emitter) return;
            emitter.gravityX = 0;
            this.runtime.setWindActive(site, layer, false);
          },
        ));
        schedule(randomBetween(STOP_AI_SMOKE_WIND_MIN_DELAY_MS, STOP_AI_SMOKE_WIND_MAX_DELAY_MS));
      }));
    };
    schedule(STOP_AI_SMOKE_WIND_START_DELAY_MS);
  }

  private destroyEmitter(
    key: string,
    site: StopAiSmokeSite,
    layer: StopAiSmokeLayer,
  ): void {
    this.clearWindTimers(key);
    const emitter = this.emitters.get(key);
    emitter?.stop();
    emitter?.destroy();
    this.emitters.delete(key);
    this.runtime.setWindActive(site, layer, false);
  }

  private clearWindTimers(key: string): void {
    timerRemove(this.windTimers.get(key));
    timerRemove(this.windResetTimers.get(key));
    this.windTimers.delete(key);
    this.windResetTimers.delete(key);
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

  private cleanupObjects(): void {
    for (const key of this.windTimers.keys()) this.clearWindTimers(key);
    for (const key of this.windResetTimers.keys()) this.clearWindTimers(key);
    for (const emitter of this.emitters.values()) {
      emitter.stop();
      emitter.destroy();
    }
    this.emitters.clear();
    for (const graphics of this.graphics.values()) graphics.clear().destroy();
    this.graphics.clear();
  }

  private report(reason: string): void {
    this.onError?.(reason);
  }
}
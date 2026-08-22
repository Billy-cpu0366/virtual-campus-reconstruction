import {
  FACTORY_SMOKE_ASSET_KEY,
  FACTORY_SMOKE_CONFIG,
  FactorySmokeRuntime,
  type SmokeViewport,
} from "../src/fx/index.js";

export const FACTORY_SMOKE_RUNTIME_ASSET = Object.freeze({
  key: FACTORY_SMOKE_ASSET_KEY,
  url: new URL("../src/fx/assets/smoke-white.webp", import.meta.url).href,
});

type SmokeListener = (...args: unknown[]) => void;

export interface PhaserFactorySmokeLoaderLike {
  image(key: string, url: string): unknown;
}

export interface PhaserFactorySmokeTextureManagerLike {
  exists(key: string): boolean;
}

export interface PhaserFactorySmokeParticleLike {
  x: number;
  y: number;
  alpha: number;
  readonly lifeT?: number;
  velocityX?: number;
}

export interface PhaserFactorySmokeEmitterLike {
  start(): void;
  stop(): void;
  setVisible(value: boolean): this;
  setDepth(value: number): this;
  destroy(): void;
  forEachAlive?(
    callback: (particle: PhaserFactorySmokeParticleLike) => void,
    context?: unknown,
  ): void;
}

export interface PhaserFactorySmokeGraphicsLike {
  setDepth(value: number): this;
  clear(): this;
  destroy(): void;
}

export interface PhaserFactorySmokeEventsLike {
  on(event: string, listener: SmokeListener, context?: unknown): PhaserFactorySmokeEventsLike;
  off(event: string, listener: SmokeListener, context?: unknown): PhaserFactorySmokeEventsLike;
}

export interface PhaserFactorySmokeSceneLike {
  readonly load: PhaserFactorySmokeLoaderLike;
  readonly textures: PhaserFactorySmokeTextureManagerLike;
  readonly add: {
    particles(
      x: number,
      y: number,
      texture: string,
      config: Record<string, unknown>,
    ): PhaserFactorySmokeEmitterLike;
    graphics(): PhaserFactorySmokeGraphicsLike;
  };
  readonly cameras?: {
    readonly main?: {
      readonly worldView?: SmokeViewport;
      readonly scrollX?: number;
      readonly scrollY?: number;
      readonly width?: number;
      readonly height?: number;
    };
  };
  readonly events: PhaserFactorySmokeEventsLike;
}

export interface PhaserFactorySmokeRuntimeOptions {
  readonly viewport?: () => SmokeViewport;
  readonly onError?: (reason: string) => void;
}

export type PhaserFactorySmokeStartResult =
  | { readonly ok: true; readonly generation: number }
  | {
      readonly ok: false;
      readonly reason: "shutdown" | "missing-texture" | "emitter-create-failed";
    };

function viewportFromScene(
  scene: PhaserFactorySmokeSceneLike,
): SmokeViewport | undefined {
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

/** Dedicated Phaser owner for the one public factory smoke generator. */
export class PhaserFactorySmokeRuntime {
  private readonly runtime = new FactorySmokeRuntime();
  private readonly viewportProvider: (() => SmokeViewport) | undefined;
  private readonly onError: ((reason: string) => void) | undefined;
  private emitter: PhaserFactorySmokeEmitterLike | undefined;
  private pathGraphics: PhaserFactorySmokeGraphicsLike | undefined;
  private updateAttached = false;
  private shutdownState = false;

  private readonly handleUpdate: SmokeListener = (): void => {
    this.update();
  };

  private readonly handleShutdown: SmokeListener = (): void => {
    this.shutdown();
  };

  constructor(
    private readonly scene: PhaserFactorySmokeSceneLike,
    options: PhaserFactorySmokeRuntimeOptions = {},
  ) {
    this.viewportProvider = options.viewport;
    this.onError = options.onError;
  }

  preload(): void {
    if (this.shutdownState) return;
    this.scene.load.image(
      FACTORY_SMOKE_RUNTIME_ASSET.key,
      FACTORY_SMOKE_RUNTIME_ASSET.url,
    );
  }

  start(): PhaserFactorySmokeStartResult {
    if (this.shutdownState) return { ok: false, reason: "shutdown" };
    const textureAvailable = this.scene.textures.exists(
      FACTORY_SMOKE_RUNTIME_ASSET.key,
    );
    const result = this.runtime.start(textureAvailable);
    if (!result.ok) {
      this.report(result.reason);
      return result;
    }
    if (this.emitter !== undefined) {
      this.attachUpdate();
      this.update();
      return result;
    }

    try {
      this.pathGraphics = this.scene.add.graphics().setDepth(
        FACTORY_SMOKE_CONFIG.depth + 1,
      );
      this.emitter = this.scene.add.particles(
        FACTORY_SMOKE_CONFIG.x,
        FACTORY_SMOKE_CONFIG.y,
        FACTORY_SMOKE_RUNTIME_ASSET.key,
        this.emitterConfig(),
      );
      this.emitter
        .setDepth(FACTORY_SMOKE_CONFIG.depth)
        .setVisible(false);
    } catch {
      this.runtime.shutdown();
      this.cleanupObjects();
      this.report("emitter-create-failed");
      return { ok: false, reason: "emitter-create-failed" };
    }

    this.attachUpdate();
    this.update();
    return result;
  }

  update(viewport = this.viewportProvider?.() ?? viewportFromScene(this.scene)): void {
    if (this.shutdownState || this.emitter === undefined || viewport === undefined) return;
    const snapshot = this.runtime.updateViewport(viewport);
    if (snapshot.emitting) {
      this.emitter.start();
      this.emitter.setVisible(true);
      this.updateParticles();
    } else {
      this.emitter.stop();
      this.emitter.setVisible(false);
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

  get hasEmitter(): boolean {
    return this.emitter !== undefined;
  }

  private emitterConfig(): Record<string, unknown> {
    return {
      speed: 0,
      scale: {
        start: FACTORY_SMOKE_CONFIG.scaleStart,
        end: FACTORY_SMOKE_CONFIG.scaleEnd,
      },
      alpha: {
        start: FACTORY_SMOKE_CONFIG.alphaStart,
        end: FACTORY_SMOKE_CONFIG.alphaEnd,
      },
      lifespan: FACTORY_SMOKE_CONFIG.lifespan,
      quantity: FACTORY_SMOKE_CONFIG.quantity,
      frequency: FACTORY_SMOKE_CONFIG.frequency,
      emitting: false,
      gravityY: 0,
      blendMode: "NORMAL",
      emitCallback: (particle: PhaserFactorySmokeParticleLike): void => {
        particle.velocityX = Math.random() - 0.5;
        particle.alpha = Math.min(particle.alpha, FACTORY_SMOKE_CONFIG.maxAlpha);
      },
    };
  }

  private updateParticles(): void {
    this.emitter?.forEachAlive?.((particle) => {
      const position = this.runtime.particlePosition(particle.lifeT ?? 0);
      particle.x = FACTORY_SMOKE_CONFIG.x + position.x;
      particle.y = FACTORY_SMOKE_CONFIG.y + position.y;
      particle.alpha = Math.min(particle.alpha, FACTORY_SMOKE_CONFIG.maxAlpha);
    });
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
    this.emitter?.stop();
    this.emitter?.destroy();
    this.emitter = undefined;
    this.pathGraphics?.clear().destroy();
    this.pathGraphics = undefined;
  }

  private report(reason: string): void {
    this.onError?.(reason);
  }
}

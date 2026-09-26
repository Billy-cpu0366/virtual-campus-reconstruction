export interface StaticNpcPoint {
  readonly x: number;
  readonly y: number;
}

export interface StaticNpcFrameDuration {
  readonly frame: number;
  readonly duration: number;
}

export interface StaticNpcConfig {
  readonly id: string;
  readonly spriteKey: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly scale: number;
  readonly frameRate: number;
  readonly frameDurations?: readonly StaticNpcFrameDuration[];
}

export interface StaticNpcViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface StaticNpcInstanceSnapshot {
  readonly id: string;
  readonly spriteKey: string;
  readonly position: StaticNpcPoint;
  readonly materialized: boolean;
}

export interface StaticNpcSnapshot {
  readonly instances: readonly StaticNpcInstanceSnapshot[];
}

/**
 * 站位的人需要的外部输入。两个字段都**必须**由调用方给：原先它们各自有一个
 * 默认值（`STATIC_NPC_CONFIGS` / `STATIC_NPC_VIEWPORT_MARGIN`），那份默认值
 * 就是被搬走的配置。留着默认值等于「没给配置也能跑」，那种情况下场景会静悄悄地
 * 少几个人，比直接报错难查。
 */
export interface StaticNpcRuntimeOptions {
  readonly configs: readonly StaticNpcConfig[];
  readonly viewportMargin: number;
}

export const STATIC_NPC_TILE_SIZE = 16;

function pointFor(config: StaticNpcConfig): StaticNpcPoint {
  return {
    x: config.tileX * STATIC_NPC_TILE_SIZE,
    y: config.tileY * STATIC_NPC_TILE_SIZE,
  };
}

function isNearViewport(
  point: StaticNpcPoint,
  viewport: StaticNpcViewport,
  margin: number,
): boolean {
  return (
    point.x >= viewport.left - margin &&
    point.x <= viewport.left + viewport.width + margin &&
    point.y >= viewport.top - margin &&
    point.y <= viewport.top + viewport.height + margin
  );
}

/** Deterministic lifecycle owner for the three source-backed static NPCs. */
export class StaticNpcRuntime {
  private readonly configs: readonly StaticNpcConfig[];
  private readonly viewportMargin: number;
  private started = false;
  private dead = false;
  private current: StaticNpcSnapshot = { instances: Object.freeze([]) };

  constructor(options: StaticNpcRuntimeOptions) {
    this.configs = options.configs;
    this.viewportMargin = options.viewportMargin;
  }

  get snapshot(): StaticNpcSnapshot {
    return this.current;
  }

  get startedState(): boolean {
    return this.started;
  }

  start(viewport: StaticNpcViewport | undefined): StaticNpcSnapshot {
    if (this.dead) return this.current;
    this.started = true;
    return this.tick(viewport);
  }

  tick(viewport: StaticNpcViewport | undefined): StaticNpcSnapshot {
    if (this.dead || !this.started || viewport === undefined) {
      return this.current;
    }
    this.current = {
      instances: Object.freeze(
        this.configs.map((config) => {
          const point = pointFor(config);
          return Object.freeze({
            id: config.id,
            spriteKey: config.spriteKey,
            position: Object.freeze(point),
            materialized: isNearViewport(point, viewport, this.viewportMargin),
          });
        }),
      ),
    };
    return this.current;
  }

  cancel(): StaticNpcSnapshot {
    this.started = false;
    this.current = { instances: Object.freeze([]) };
    return this.current;
  }

  shutdown(): StaticNpcSnapshot {
    this.dead = true;
    return this.cancel();
  }
}

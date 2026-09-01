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

export interface StaticNpcRuntimeOptions {
  readonly configs?: readonly StaticNpcConfig[];
  readonly viewportMargin?: number;
}

export const STATIC_NPC_TILE_SIZE = 16;
export const STATIC_NPC_VIEWPORT_MARGIN = 300;

// DECISION: these are the only accepted static NPCs; no other public NPC
// configuration is inferred into this runtime.
export const STATIC_NPC_CONFIGS = Object.freeze([
  Object.freeze({
    id: "special-reading",
    spriteKey: "npc-special-reading",
    tileX: 72,
    tileY: 53,
    scale: 0.9,
    frameRate: 3,
    frameDurations: Object.freeze([
      Object.freeze({ frame: 1, duration: 2_000 }),
      Object.freeze({ frame: 9, duration: 3_000 }),
    ]),
  }),
  Object.freeze({
    id: "special-eating",
    spriteKey: "npc-special-eating",
    tileX: 54,
    tileY: 63,
    scale: 0.73,
    frameRate: 4,
  }),
  Object.freeze({
    id: "cat-licking",
    spriteKey: "npc-cat-licking",
    tileX: 12,
    tileY: 106,
    scale: 1,
    frameRate: 6,
    frameDurations: Object.freeze([
      Object.freeze({ frame: 0, duration: 3_000 }),
    ]),
  }),
] as const);

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

  constructor(options: StaticNpcRuntimeOptions = {}) {
    this.configs = options.configs ?? STATIC_NPC_CONFIGS;
    this.viewportMargin = options.viewportMargin ?? STATIC_NPC_VIEWPORT_MARGIN;
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

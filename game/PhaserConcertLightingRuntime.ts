export interface ConcertLightingViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ConcertLightingGraphicsLike {
  clear(): unknown;
  fillStyle(color: number, alpha: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
  fillCircle(x: number, y: number, radius: number): unknown;
  lineStyle(width: number, color: number, alpha: number): unknown;
  lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
  setDepth(value: number): unknown;
  setVisible(value: boolean): unknown;
  destroy(): void;
}

export interface PhaserConcertLightingSceneLike {
  readonly add: { graphics(): ConcertLightingGraphicsLike };
}

export const CONCERT_LIGHTING_BOUNDS = Object.freeze({
  left: 103 * 16,
  top: 25 * 16,
  right: (138 + 1) * 16,
  bottom: (52 + 1) * 16,
});

export const CONCERT_LIGHTING_CONTRACT = Object.freeze({
  darkZoneCount: 1,
  spotlightCount: 2,
  colorLightCount: 2,
  laserCount: 6,
  darkZoneDepth: 1_600,
  laserDepth: 1_650,
});

type Point = { readonly x: number; readonly y: number };
type LaserConfig = {
  readonly source: Point;
  readonly phase: number;
};

const SPOTLIGHT_ANCHORS = Object.freeze([
  Object.freeze({ x: 1_860, y: 600, radius: 60, phase: 0 }),
  Object.freeze({ x: 2_040, y: 680, radius: 50, phase: 2.1 }),
]);
const COLOR_LIGHT_ANCHORS = Object.freeze([
  Object.freeze({ x: 1_850, y: 690, color: 0xff2200, phase: 1.2 }),
  Object.freeze({ x: 2_030, y: 590, color: 0x0088ff, phase: 3.4 }),
]);
const LASERS: readonly LaserConfig[] = Object.freeze([
  { source: { x: 117 * 16 + 8, y: 36 * 16 + 8 }, phase: 0 },
  { source: { x: 125 * 16 + 8, y: 36 * 16 + 8 }, phase: 0.7 },
  { source: { x: 110 * 16 + 8, y: 36 * 16 + 8 }, phase: 1.4 },
  { source: { x: 132 * 16 + 8, y: 36 * 16 + 8 }, phase: 2.1 },
  { source: { x: 113 * 16 + 8, y: 44 * 16 + 8 }, phase: 2.8 },
  { source: { x: 128 * 16 + 8, y: 44 * 16 + 8 }, phase: 3.5 },
]);

const intersects = (
  bounds: typeof CONCERT_LIGHTING_BOUNDS,
  viewport: ConcertLightingViewport | undefined,
): boolean => viewport === undefined || !(
  bounds.right < viewport.left ||
  bounds.left > viewport.left + viewport.width ||
  bounds.bottom < viewport.top ||
  bounds.top > viewport.top + viewport.height
);

const oscillate = (
  anchor: Point,
  now: number,
  phase: number,
  radiusX: number,
  radiusY: number,
): Point => {
  const time = now / 1_000;
  return {
    x: anchor.x + Math.sin(time * 0.7 + phase) * radiusX,
    y: anchor.y + Math.cos(time * 0.55 + phase) * radiusY,
  };
};

const drawGlow = (
  graphics: ConcertLightingGraphicsLike,
  point: Point,
  radius: number,
  color: number,
  intensity: number,
): void => {
  graphics.clear();
  graphics.fillStyle(color, intensity * 0.12);
  graphics.fillCircle(point.x, point.y, radius + 22);
  graphics.fillStyle(color, intensity * 0.2);
  graphics.fillCircle(point.x, point.y, radius + 10);
  graphics.fillStyle(color, intensity * 0.35);
  graphics.fillCircle(point.x, point.y, radius);
};

/** Bounded visual owner for the public concert room lighting choreography. */
export class PhaserConcertLightingRuntime {
  private darkZone: ConcertLightingGraphicsLike | undefined;
  private spotlights: ConcertLightingGraphicsLike[] = [];
  private colorLights: ConcertLightingGraphicsLike[] = [];
  private lasers: ConcertLightingGraphicsLike[] = [];
  private started = false;
  private dead = false;
  private active = false;
  private lastUpdateAt = 0;

  constructor(private readonly scene: PhaserConcertLightingSceneLike) {}

  start(): boolean {
    if (this.dead || this.started) return false;
    try {
      this.darkZone = this.scene.add.graphics();
      this.darkZone.setDepth(CONCERT_LIGHTING_CONTRACT.darkZoneDepth);
      this.spotlights = SPOTLIGHT_ANCHORS.map(() => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(CONCERT_LIGHTING_CONTRACT.darkZoneDepth + 1);
        return graphics;
      });
      this.colorLights = COLOR_LIGHT_ANCHORS.map(() => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(CONCERT_LIGHTING_CONTRACT.darkZoneDepth + 1);
        return graphics;
      });
      this.lasers = LASERS.map(() => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(CONCERT_LIGHTING_CONTRACT.laserDepth);
        return graphics;
      });
      this.started = true;
      this.setVisible(false);
      return true;
    } catch {
      this.shutdown();
      return false;
    }
  }

  update(now: number, viewport?: ConcertLightingViewport): void {
    if (this.dead || !this.started) return;
    this.lastUpdateAt = now;
    const nextActive = intersects(CONCERT_LIGHTING_BOUNDS, viewport);
    if (!nextActive) {
      if (this.active) this.setVisible(false);
      this.active = false;
      return;
    }
    this.active = true;
    this.setVisible(true);
    this.draw(now);
  }

  shutdown(): void {
    if (this.dead) return;
    this.dead = true;
    this.setVisible(false);
    this.darkZone?.destroy();
    for (const graphics of this.spotlights) graphics.destroy();
    for (const graphics of this.colorLights) graphics.destroy();
    for (const graphics of this.lasers) graphics.destroy();
    this.darkZone = undefined;
    this.spotlights = [];
    this.colorLights = [];
    this.lasers = [];
    this.started = false;
    this.active = false;
  }

  get objectCount(): number {
    return this.started
      ? 1 + this.spotlights.length + this.colorLights.length + this.lasers.length
      : 0;
  }

  get snapshot() {
    return Object.freeze({
      started: this.started,
      active: this.active,
      objectCount: this.objectCount,
      darkZoneCount: this.started ? 1 : 0,
      spotlightCount: this.spotlights.length,
      colorLightCount: this.colorLights.length,
      laserCount: this.lasers.length,
      lastUpdateAt: this.lastUpdateAt,
    });
  }

  private setVisible(value: boolean): void {
    this.darkZone?.setVisible(value);
    for (const graphics of this.spotlights) graphics.setVisible(value);
    for (const graphics of this.colorLights) graphics.setVisible(value);
    for (const graphics of this.lasers) graphics.setVisible(value);
  }

  private draw(now: number): void {
    this.darkZone?.clear();
    this.darkZone?.fillStyle(0x662062, 0.7);
    this.darkZone?.fillRect(
      CONCERT_LIGHTING_BOUNDS.left,
      CONCERT_LIGHTING_BOUNDS.top,
      CONCERT_LIGHTING_BOUNDS.right - CONCERT_LIGHTING_BOUNDS.left,
      CONCERT_LIGHTING_BOUNDS.bottom - CONCERT_LIGHTING_BOUNDS.top,
    );

    for (const [index, anchor] of SPOTLIGHT_ANCHORS.entries()) {
      const point = oscillate(anchor, now, anchor.phase, 84, 48);
      drawGlow(this.spotlights[index]!, point, anchor.radius, 0xffffff, 1);
    }
    for (const [index, anchor] of COLOR_LIGHT_ANCHORS.entries()) {
      const point = oscillate(anchor, now, anchor.phase, 110, 70);
      drawGlow(this.colorLights[index]!, point, 50, anchor.color, 0.8);
    }
    for (const [index, laser] of LASERS.entries()) {
      const time = now / 1_000;
      const target = {
        x: (121 + Math.sin(time * 0.6 + laser.phase) * 5) * 16 + 8,
        y: (39 + Math.cos(time * 0.8 + laser.phase) * 2) * 16 + 8,
      };
      const width = 1 + (Math.sin(time * 1.2 + laser.phase) + 1) * 2.5;
      const graphics = this.lasers[index]!;
      graphics.clear();
      graphics.lineStyle(width, 0x00ff00, 0.5);
      graphics.lineBetween(laser.source.x, laser.source.y, target.x, target.y);
    }
  }
}

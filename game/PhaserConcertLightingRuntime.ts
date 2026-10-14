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

type Point = { readonly x: number; readonly y: number };

const intersects = (
  bounds: ConcertLightingFxConfig["bounds"],
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

  constructor(
    private readonly scene: PhaserConcertLightingSceneLike,
    private readonly config: ConcertLightingFxConfig,
  ) {}

  start(): boolean {
    if (this.dead || this.started) return false;
    try {
      this.darkZone = this.scene.add.graphics();
      this.darkZone.setDepth(this.config.darkZoneDepth);
      this.spotlights = this.config.spotlights.map(() => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(this.config.darkZoneDepth + 1);
        return graphics;
      });
      this.colorLights = this.config.colorLights.map(() => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(this.config.darkZoneDepth + 1);
        return graphics;
      });
      this.lasers = this.config.lasers.map(() => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(this.config.laserDepth);
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
    const nextActive = intersects(this.config.bounds, viewport);
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
      spotlightCount: this.config.spotlights.length,
      colorLightCount: this.config.colorLights.length,
      laserCount: this.config.lasers.length,
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
      this.config.bounds.left,
      this.config.bounds.top,
      this.config.bounds.right - this.config.bounds.left,
      this.config.bounds.bottom - this.config.bounds.top,
    );

    for (const [index, anchor] of this.config.spotlights.entries()) {
      const point = oscillate(anchor, now, anchor.phase, 84, 48);
      drawGlow(this.spotlights[index]!, point, anchor.radius, 0xffffff, 1);
    }
    for (const [index, anchor] of this.config.colorLights.entries()) {
      const point = oscillate(anchor, now, anchor.phase, 110, 70);
      drawGlow(this.colorLights[index]!, point, 50, anchor.color, 0.8);
    }
    for (const [index, laser] of this.config.lasers.entries()) {
      const time = now / 1_000;
      const target = {
        x: (121 + Math.sin(time * 0.6 + laser.phase) * 5) * 16 + 8,
        y: (39 + Math.cos(time * 0.8 + laser.phase) * 2) * 16 + 8,
      };
      const width = 1 + (Math.sin(time * 1.2 + laser.phase) + 1) * 2.5;
      const graphics = this.lasers[index]!;
      graphics.clear();
      graphics.lineStyle(width, 0x00ff00, 0.5);
      graphics.lineBetween(laser.tileX * 16 + 8, laser.tileY * 16 + 8, target.x, target.y);
    }
  }
}
import type { ConcertLightingFxConfig } from "../config/骨架/05-旁支/SYS-FX/逻辑/index.js";


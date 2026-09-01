import type { LayerMarkerRecord } from "../src/layer/index.js";

export const FOOTSTEP_TEXTURE_KEY = "footprint";
export const FOOTSTEP_POOL_SIZE = 95;
export const FOOTSTEP_DEPTH = 450;
export const FOOTSTEP_ALPHA = 0.6;
export const FOOTSTEP_SPACING = 14;
export const FOOTSTEP_VISIBLE_MS = 10_000;
export const FOOTSTEP_FADE_MS = 1_000;
export const FOOTSTEP_SPEED_THRESHOLD = 5;
export const FOOTSTEP_MAX_PLAYER_DEPTH = 1_000;

export interface PhaserFootstepSpriteLike {
  readonly x: number;
  readonly y: number;
  setPosition(x: number, y: number): this;
  setOrigin(x: number, y: number): this;
  setDepth(depth: number): this;
  setAlpha(alpha: number): this;
  setVisible(visible: boolean): this;
  setRotation(rotation: number): this;
  destroy(): void;
}

export interface PhaserFootstepTextureManagerLike {
  exists(key: string): boolean;
  addCanvas?(key: string, canvas: HTMLCanvasElement): unknown;
}

export interface PhaserFootstepSceneLike {
  readonly textures: PhaserFootstepTextureManagerLike;
  readonly add: {
    sprite(x: number, y: number, texture: string): PhaserFootstepSpriteLike;
  };
}

export interface FootstepPlayerFrame {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly controlsEnabled: boolean;
  readonly teleporting?: boolean;
}

interface PoolEntry {
  readonly sprite: PhaserFootstepSpriteLike;
  active: boolean;
  bornAt: number;
  sourceChunk: string;
  x: number;
  y: number;
  alpha: number;
}

function markerKey(x: number, y: number): string {
  return `${x},${y}`;
}

function chunkKey(marker: LayerMarkerRecord): string {
  return `${marker.chunk.x},${marker.chunk.y}`;
}

function createFootprintCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 12;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("footprint canvas unavailable");
  context.fillStyle = "#20242b";
  context.beginPath();
  context.ellipse(2.5, 3.5, 1.5, 3, -0.25, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(5.5, 8.5, 1.5, 3, -0.25, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** Scene-owned visible consumer for confirmed `footsteps` marker tiles. */
export class PhaserFootstepRuntime {
  private readonly pool: PoolEntry[] = [];
  private started = false;
  private shutdownState = false;
  private lastSpawn: { x: number; y: number } | undefined;

  constructor(private readonly scene: PhaserFootstepSceneLike) {}

  start(): void {
    if (this.started || this.shutdownState) return;
    if (!this.scene.textures.exists(FOOTSTEP_TEXTURE_KEY)) {
      const addCanvas = this.scene.textures.addCanvas;
      if (addCanvas === undefined) {
        throw new Error("footprint texture manager cannot add canvas");
      }
      addCanvas.call(
        this.scene.textures,
        FOOTSTEP_TEXTURE_KEY,
        createFootprintCanvas(),
      );
    }
    for (let index = 0; index < FOOTSTEP_POOL_SIZE; index += 1) {
      const sprite = this.scene.add
        .sprite(0, 0, FOOTSTEP_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setDepth(FOOTSTEP_DEPTH)
        .setAlpha(0)
        .setVisible(false);
      this.pool.push({
        sprite,
        active: false,
        bornAt: 0,
        sourceChunk: "",
        x: 0,
        y: 0,
        alpha: 0,
      });
    }
    this.started = true;
  }

  update(
    nowMs: number,
    player: FootstepPlayerFrame,
    markers: readonly LayerMarkerRecord[],
  ): void {
    if (!this.started || this.shutdownState || !Number.isFinite(nowMs)) return;
    const surface = new Map<string, LayerMarkerRecord>();
    const loadedChunks = new Set<string>();
    for (const marker of markers) {
      if (marker.layerName !== "footsteps" || marker.gid !== 69345) continue;
      surface.set(markerKey(marker.worldTile.x, marker.worldTile.y), marker);
      loadedChunks.add(chunkKey(marker));
    }
    this.updatePool(nowMs, loadedChunks);

    const moving =
      Math.abs(player.velocityX) > FOOTSTEP_SPEED_THRESHOLD ||
      Math.abs(player.velocityY) > FOOTSTEP_SPEED_THRESHOLD;
    if (
      !player.controlsEnabled ||
      player.teleporting === true ||
      !moving ||
      player.depth >= FOOTSTEP_MAX_PLAYER_DEPTH
    ) {
      return;
    }

    const spawnY = player.y + 10;
    const marker = surface.get(
      markerKey(Math.floor(player.x / 16), Math.floor(spawnY / 16)),
    );
    if (marker === undefined) return;
    if (
      this.lastSpawn !== undefined &&
      Math.hypot(player.x - this.lastSpawn.x, spawnY - this.lastSpawn.y) <
        FOOTSTEP_SPACING
    ) {
      return;
    }
    this.spawn(
      nowMs,
      player.x,
      spawnY,
      Math.atan2(player.velocityY, player.velocityX),
      chunkKey(marker),
    );
  }

  shutdown(): void {
    if (this.shutdownState) return;
    this.shutdownState = true;
    for (const entry of this.pool) entry.sprite.destroy();
    this.pool.length = 0;
    this.lastSpawn = undefined;
  }

  get activeCount(): number {
    return this.pool.filter((entry) => entry.active).length;
  }

  get visualSnapshots() {
    return Object.freeze(
      this.pool
        .filter((entry) => entry.active)
        .map((entry) =>
          Object.freeze({
            x: entry.x,
            y: entry.y,
            alpha: entry.alpha,
            depth: FOOTSTEP_DEPTH,
            sourceChunk: entry.sourceChunk,
          }),
        ),
    );
  }

  private updatePool(nowMs: number, loadedChunks: ReadonlySet<string>): void {
    for (const entry of this.pool) {
      if (!entry.active) continue;
      const age = nowMs - entry.bornAt;
      if (age >= FOOTSTEP_VISIBLE_MS + FOOTSTEP_FADE_MS) {
        this.recycle(entry);
        continue;
      }
      if (!loadedChunks.has(entry.sourceChunk)) {
        this.recycle(entry);
        continue;
      }
      const fadeProgress = Math.max(
        0,
        (age - FOOTSTEP_VISIBLE_MS) / FOOTSTEP_FADE_MS,
      );
      entry.alpha = FOOTSTEP_ALPHA * (1 - Math.min(1, fadeProgress));
      entry.sprite.setAlpha(entry.alpha);
    }
  }

  private spawn(
    nowMs: number,
    x: number,
    y: number,
    rotation: number,
    sourceChunk: string,
  ): void {
    const entry =
      this.pool.find((candidate) => !candidate.active) ??
      this.pool.reduce((oldest, candidate) =>
        candidate.bornAt < oldest.bornAt ? candidate : oldest,
      );
    entry.active = true;
    entry.bornAt = nowMs;
    entry.sourceChunk = sourceChunk;
    entry.x = x;
    entry.y = y;
    entry.alpha = FOOTSTEP_ALPHA;
    entry.sprite
      .setPosition(x, y)
      .setRotation(rotation)
      .setDepth(FOOTSTEP_DEPTH)
      .setAlpha(FOOTSTEP_ALPHA)
      .setVisible(true);
    this.lastSpawn = { x, y };
  }

  private recycle(entry: PoolEntry): void {
    entry.active = false;
    entry.sourceChunk = "";
    entry.alpha = 0;
    entry.sprite.setAlpha(0).setVisible(false);
  }
}

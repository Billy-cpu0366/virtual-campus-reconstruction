import { describe, expect, it } from "vitest";

import {
  FOOTSTEP_ALPHA,
  FOOTSTEP_DEPTH,
  FOOTSTEP_POOL_SIZE,
  PhaserFootstepRuntime,
  type PhaserFootstepSceneLike,
  type PhaserFootstepSpriteLike,
} from "../../game/PhaserFootstepRuntime.js";
import type { LayerMarkerRecord } from "../../src/layer/index.js";

class FakeSprite implements PhaserFootstepSpriteLike {
  x: number;
  y: number;
  depth = 0;
  alpha = 0;
  visible = false;
  rotation = 0;
  destroyed = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setOrigin(): this { return this; }
  setDepth(depth: number): this { this.depth = depth; return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setRotation(rotation: number): this { this.rotation = rotation; return this; }
  destroy(): void { this.destroyed = true; }
}

function marker(
  worldTileX = 13,
  worldTileY = 115,
  chunkX = 0,
  chunkY = 4,
): LayerMarkerRecord {
  return {
    layerName: "footsteps",
    gid: 69345,
    localTile: { x: worldTileX, y: worldTileY % 28 },
    worldTile: { x: worldTileX, y: worldTileY },
    worldPixel: { x: worldTileX * 16, y: worldTileY * 16 },
    chunk: { x: chunkX, y: chunkY },
  };
}

function setup() {
  const sprites: FakeSprite[] = [];
  const scene: PhaserFootstepSceneLike = {
    textures: { exists: () => true },
    add: {
      sprite: (x, y) => {
        const sprite = new FakeSprite(x, y);
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  const runtime = new PhaserFootstepRuntime(scene);
  runtime.start();
  return { runtime, sprites };
}

const movingPlayer = {
  x: 216,
  y: 1832,
  depth: 700,
  velocityX: 100,
  velocityY: 0,
  controlsEnabled: true,
};

describe("PhaserFootstepRuntime", () => {
  it("在confirmed surface按14px间距生成depth450/alpha.6脚印", () => {
    const { runtime, sprites } = setup();
    expect(sprites).toHaveLength(FOOTSTEP_POOL_SIZE);

    runtime.update(0, movingPlayer, [marker()]);
    runtime.update(100, { ...movingPlayer, x: 226 }, [marker()]);
    runtime.update(200, { ...movingPlayer, x: 231 }, [marker(14, 115)]);

    expect(runtime.activeCount).toBe(2);
    expect(runtime.visualSnapshots).toEqual([
      {
        x: 216,
        y: 1842,
        alpha: FOOTSTEP_ALPHA,
        depth: FOOTSTEP_DEPTH,
        sourceChunk: "0,4",
      },
      {
        x: 231,
        y: 1842,
        alpha: FOOTSTEP_ALPHA,
        depth: FOOTSTEP_DEPTH,
        sourceChunk: "0,4",
      },
    ]);
    expect(sprites[0]).toMatchObject({
      visible: true,
      depth: FOOTSTEP_DEPTH,
      alpha: FOOTSTEP_ALPHA,
    });
  });

  it("静止、深度过高、teleport或非surface不生成", () => {
    const { runtime } = setup();
    runtime.update(0, { ...movingPlayer, velocityX: 0 }, [marker()]);
    runtime.update(1, { ...movingPlayer, depth: 1_000 }, [marker()]);
    runtime.update(2, { ...movingPlayer, teleporting: true }, [marker()]);
    runtime.update(3, movingPlayer, []);
    expect(runtime.activeCount).toBe(0);
  });

  it("10秒后1秒淡出，source chunk移除立即回池，shutdown销毁", () => {
    const { runtime, sprites } = setup();
    runtime.update(0, movingPlayer, [marker()]);
    runtime.update(10_500, { ...movingPlayer, velocityX: 0 }, [marker()]);
    expect(runtime.visualSnapshots[0]?.alpha).toBeCloseTo(0.3, 5);
    runtime.update(10_600, { ...movingPlayer, velocityX: 0 }, []);
    expect(runtime.activeCount).toBe(0);

    runtime.update(12_000, { ...movingPlayer, x: 232 }, [marker(14, 115)]);
    expect(runtime.activeCount).toBe(1);
    runtime.update(23_001, { ...movingPlayer, velocityX: 0 }, [marker(14, 115)]);
    expect(runtime.activeCount).toBe(0);

    runtime.shutdown();
    runtime.shutdown();
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
    runtime.update(24_000, movingPlayer, [marker()]);
    expect(runtime.activeCount).toBe(0);
  });
});

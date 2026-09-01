import { describe, expect, it } from "vitest";

import {
  STATIC_NPC_CONFIGS,
  StaticNpcRuntime,
} from "../../src/npc/index.js";
import {
  PhaserStaticNpcRuntime,
  type PhaserStaticNpcSceneLike,
} from "../../game/PhaserStaticNpcRuntime.js";

class FakeSprite {
  x: number;
  y: number;
  scale = 1;
  destroyed = false;
  readonly anims = { play: (key: string) => { this.played = key; } };
  played = "";

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setScale(value: number): this { this.scale = value; return this; }
  setDepth(_value: number): this { return this; }
  destroy(): void { this.destroyed = true; }
}

function viewportFor(tileX: number, tileY: number) {
  return { left: tileX * 16 - 10, top: tileY * 16 - 10, width: 20, height: 20 };
}

describe("StaticNpcRuntime", () => {
  it("keeps only the three accepted configs and culls by viewport-near position", () => {
    expect(STATIC_NPC_CONFIGS).toHaveLength(3);
    expect(STATIC_NPC_CONFIGS.map((config) => config.spriteKey)).toEqual([
      "npc-special-reading",
      "npc-special-eating",
      "npc-cat-licking",
    ]);
    const runtime = new StaticNpcRuntime({ viewportMargin: 0 });
    runtime.start(viewportFor(72, 53));
    expect(runtime.snapshot.instances.filter((item) => item.materialized)).toHaveLength(1);
    expect(runtime.snapshot.instances.find((item) => item.id === "special-reading"))
      .toMatchObject({ position: { x: 1152, y: 848 }, materialized: true });
    runtime.tick({ left: 0, top: 0, width: 100, height: 100 });
    expect(runtime.snapshot.instances.every((item) => !item.materialized)).toBe(true);
  });

  it("creates, recycles, and destroys only the materialized static sprites", () => {
    const sprites: FakeSprite[] = [];
    const animations: Array<{ key: string; frames: readonly unknown[] }> = [];
    const scene: PhaserStaticNpcSceneLike = {
      textures: { exists: () => true },
      anims: {
        exists: () => false,
        create: (config) => {
          animations.push({ key: config.key, frames: config.frames });
          return config;
        },
      },
      add: {
        sprite: (x, y) => {
          const sprite = new FakeSprite(x, y);
          sprites.push(sprite);
          return sprite;
        },
      },
    };
    let viewport = viewportFor(72, 53);
    const runtime = new PhaserStaticNpcRuntime(scene, { viewport: () => viewport, viewportMargin: 0 });
    expect(runtime.start()).toEqual({ ok: true });
    expect(runtime.spriteCount).toBe(1);
    expect(sprites[0]?.scale).toBe(0.9);
    const readingFrames = animations.find((item) => item.key === "static-npc-special-reading")?.frames as readonly { frame: number; duration: number }[];
    expect(readingFrames.find((frame) => frame.frame === 1)?.duration).toBe(2_000);
    expect(readingFrames.find((frame) => frame.frame === 9)?.duration).toBe(3_000);
    viewport = { left: 0, top: 0, width: 100, height: 100 };
    runtime.update();
    expect(runtime.spriteCount).toBe(0);
    expect(sprites[0]?.destroyed).toBe(true);
    runtime.shutdown();
    expect(runtime.spriteCount).toBe(0);
  });
});

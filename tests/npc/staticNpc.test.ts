import { describe, expect, it } from "vitest";

import { StaticNpcRuntime } from "../../src/npc/index.js";
import {
  PhaserStaticNpcRuntime,
  type PhaserStaticNpcSceneLike,
} from "../../game/PhaserStaticNpcRuntime.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";

/** 三个站位的人、以及视口外多远撤掉，现在都读磁盘上那份配置。 */
const CONFIGS = await loadNpcConfigs(createDiskConfigSource());
const STATIC_NPC_CONFIGS = CONFIGS.staticNpcConfigs;
const STATIC_NPC_PRESENTATION = CONFIGS.presentation.staticNpc;

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

/** 一张假场景：只记下「建了哪些动画、建了几个精灵」，够下面几个测试看结果。 */
function makeScene() {
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
  return { scene, sprites, animations };
}

describe("StaticNpcRuntime", () => {
  it("keeps only the three accepted configs and culls by viewport-near position", () => {
    expect(STATIC_NPC_CONFIGS).toHaveLength(3);
    expect(STATIC_NPC_CONFIGS.map((config) => config.spriteKey)).toEqual([
      "npc-special-reading",
      "npc-special-eating",
      "npc-cat-licking",
    ]);
    const runtime = new StaticNpcRuntime({
      configs: STATIC_NPC_CONFIGS,
      viewportMargin: 0,
    });
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
    const runtime = new PhaserStaticNpcRuntime(scene, {
      viewport: () => viewport,
      configs: STATIC_NPC_CONFIGS,
      viewportMargin: 0,
      presentation: STATIC_NPC_PRESENTATION,
    });
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

  it("动画帧数按递进来的那份配置算，不是写死的 16", () => {
    const { scene, animations } = makeScene();
    expect(STATIC_NPC_PRESENTATION.map((asset) => asset.frameCount)).toEqual([
      16, 16, 16,
    ]);
    const fiveFrames = STATIC_NPC_PRESENTATION.map((asset) => ({
      ...asset,
      frameCount: 5,
    }));
    const runtime = new PhaserStaticNpcRuntime(scene, {
      viewport: () => viewportFor(72, 53),
      configs: STATIC_NPC_CONFIGS,
      viewportMargin: 0,
      presentation: fiveFrames,
    });
    expect(runtime.start()).toEqual({ ok: true });
    // 只站着一个人（reading 那个在视口里），它的动画就该是 5 帧。
    expect(animations).toHaveLength(1);
    expect(animations[0]?.frames).toHaveLength(5);
  });

  it("配置里没登记这张图 → start() 当场报出来，不静默建一条空动画", () => {
    const { scene } = makeScene();
    const failures: string[] = [];
    const runtime = new PhaserStaticNpcRuntime(scene, {
      viewport: () => viewportFor(72, 53),
      configs: STATIC_NPC_CONFIGS,
      viewportMargin: 0,
      presentation: STATIC_NPC_PRESENTATION.filter(
        (asset) => asset.key !== "npc-special-reading",
      ),
      onError: (reason) => failures.push(reason),
    });
    expect(runtime.start()).toEqual({
      ok: false,
      reason: "missing-presentation",
    });
    expect(failures).toEqual(["missing-presentation:npc-special-reading"]);
  });
});

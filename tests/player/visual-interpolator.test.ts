import { describe, expect, it, vi } from "vitest";

import {
  PhaserPlayerVisualInterpolator,
  type PhaserPlayerVisualSourceLike,
  type PhaserPlayerVisualSpriteLike,
} from "../../game/PhaserPlayerVisualInterpolator.js";

class FakeSprite implements PhaserPlayerVisualSpriteLike {
  x: number;
  y: number;
  texture = "player";
  frame: string | number = 0;
  visible = true;
  alpha = 1;
  depth = 0;
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
  setTexture(key: string, frame?: string | number): this {
    this.texture = key;
    this.frame = frame ?? 0;
    return this;
  }
  setDisplaySize(): this { return this; }
  setOrigin(): this { return this; }
  setFlip(): this { return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setDepth(depth: number): this { this.depth = depth; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  destroy(): void { this.destroyed = true; }
}

function source(): PhaserPlayerVisualSourceLike & {
  x: number;
  y: number;
  visible: boolean;
  texture: { key: string };
  frame: { name: string | number };
} {
  return {
    x: 100,
    y: 200,
    visible: true,
    active: true,
    alpha: 1,
    depth: 500,
    flipX: false,
    flipY: false,
    displayWidth: 48,
    displayHeight: 48,
    originX: 0.5,
    originY: 0.5,
    texture: { key: "player" },
    frame: { name: 0 },
  };
}

function setup() {
  const body = source();
  const visual = new FakeSprite(body.x, body.y);
  const ignore = vi.fn();
  const scene = {
    add: { sprite: vi.fn(() => visual) },
    cameras: { main: { ignore } },
  };
  const runtime = new PhaserPlayerVisualInterpolator(scene, body, {
    stepMs: 1000 / 30,
  });
  return { body, visual, ignore, runtime };
}

describe("PhaserPlayerVisualInterpolator", () => {
  it("keeps the physics source ignored and interpolates each 30 Hz step", () => {
    const { body, visual, ignore, runtime } = setup();
    expect(ignore).toHaveBeenCalledWith(body);

    runtime.update(0);
    body.x += 6;
    runtime.update(0);
    expect(visual.x).toBe(100);
    runtime.update(1000 / 60);
    expect(visual.x).toBeCloseTo(103, 5);
    runtime.update(1000 / 30);
    expect(visual.x).toBeCloseTo(106, 5);

    body.x += 6;
    runtime.update(1000 / 30);
    runtime.update(1000 / 20);
    expect(visual.x).toBeCloseTo(109, 5);
  });

  it("snaps teleports and mirrors texture, frame, visibility and depth", () => {
    const { body, visual, runtime } = setup();
    body.x = 400;
    body.y = 500;
    body.texture.key = "player-sitting";
    body.frame.name = 15;
    body.visible = false;
    (body as { depth: number }).depth = 900;
    runtime.update(100);

    expect(runtime.position).toEqual({ x: 400, y: 500 });
    expect(visual.texture).toBe("player-sitting");
    expect(visual.frame).toBe(15);
    expect(visual.visible).toBe(false);
    expect(visual.depth).toBe(900);
  });

  it("destroys only the render mirror and becomes inert", () => {
    const { body, visual, runtime } = setup();
    runtime.shutdown();
    runtime.shutdown();
    body.x = 120;
    runtime.update(100);
    expect(visual.destroyed).toBe(true);
    expect(visual.x).toBe(100);
  });
});

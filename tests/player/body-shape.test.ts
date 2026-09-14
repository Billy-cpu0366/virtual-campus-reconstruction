import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { PhaserPlayerRuntime, type PhaserPlayerSceneLike } from "../../game/PhaserPlayerRuntime.js";

// Exercise the bundled engine's real body transform, including scale and origin.
const engine = readFileSync(new URL("../../sample/original-public-build/mirror/assets/js/phaser.min.js", import.meta.url), "utf8");
function engineMethod(name: string, next: string): (...args: any[]) => any {
  const start = engine.indexOf(`${name}:function(){`, engine.indexOf("this.sourceWidth")) + name.length + 12;
  const end = engine.indexOf(`},${next}:`, start);
  if (start < name.length + 12 || end < start) throw new Error(`missing engine method ${name}`);
  return new Function(engine.slice(start, end)) as (...args: any[]) => any;
}

it.each(["player-eating", "player-scratching", "player-tying-shoe", "player-sitting"])(
  "%s 切换和恢复保持实际碰撞框 20×8 及脚底位置", (texture) => {
    const sprite: any = {
      x: 100, y: 100, angle: 0, scaleX: 1, scaleY: 1,
      width: 48, height: 48, displayOriginX: 24, displayOriginY: 24,
      anims: { play: () => true, stop() {} },
      setTexture(key: string) {
        this.width = this.height = key === "player" ? 48 : 128;
        this.displayOriginX = this.width / 2;
        this.displayOriginY = this.height / 2;
        return this;
      },
      setFrame() { return this; },
      setDisplaySize(w: number, h: number) { this.scaleX = w / this.width; this.scaleY = h / this.height; return this; },
      on() {}, off() {},
    };
    const body: any = {
      gameObject: sprite, transform: {}, width: 20, height: 8,
      sourceWidth: 20, sourceHeight: 8, _sx: 1, _sy: 1,
      position: { x: 0, y: 0 }, offset: { x: 14, y: 36 },
      updateCenter() {},
      updateBounds: engineMethod("updateBounds", "updateCenter"),
      updateFromGameObject: engineMethod("updateFromGameObject", "resetFlags"),
      setSize(w: number, h: number) {
        this.sourceWidth = w; this.sourceHeight = h;
        this.width = w * this._sx; this.height = h * this._sy;
      },
      setOffset(x: number, y: number) { this.offset = { x, y }; },
    };
    sprite.body = body;
    const scene = { anims: { exists: () => true }, textures: { exists: (key: string) => key === "player" || key === texture } } as unknown as PhaserPlayerSceneLike;
    const runtime = new PhaserPlayerRuntime(scene, sprite, { now: () => 0, random: () => 0 });
    const check = () => {
      body.updateFromGameObject();
      expect({ width: body.width, height: body.height, ...body.position }).toEqual({ width: 20, height: 8, x: 90, y: 112 });
    };
    runtime.enableControls(0);
    check();
    runtime.update(null, texture === "player-sitting" ? 30_000 : 8_000);
    expect(runtime.status).toBe(texture === "player-sitting" ? "sitting-down" : "idle-action");
    check();
    if (texture === "player-sitting") { runtime.update("east", 30_001); check(); }
    runtime.reset(31_000);
    check();
  },
);

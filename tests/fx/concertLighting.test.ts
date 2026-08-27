import { describe, expect, it } from "vitest";
import {
  CONCERT_LIGHTING_CONTRACT,
  PhaserConcertLightingRuntime,
  type ConcertLightingGraphicsLike,
} from "../../game/PhaserConcertLightingRuntime.js";

class Graphics implements ConcertLightingGraphicsLike {
  visible = false;
  destroyed = false;
  depth = 0;
  drawCalls = 0;

  clear(): this { this.drawCalls += 1; return this; }
  fillStyle(): this { return this; }
  fillRect(): this { this.drawCalls += 1; return this; }
  fillCircle(): this { this.drawCalls += 1; return this; }
  lineStyle(): this { return this; }
  lineBetween(): this { this.drawCalls += 1; return this; }
  setDepth(value: number): this { this.depth = value; return this; }
  setVisible(value: boolean): this { this.visible = value; return this; }
  destroy(): void { this.destroyed = true; }
}

describe("PhaserConcertLightingRuntime", () => {
  it("creates the public concert lighting owner with bounded visibility", () => {
    const graphics: Graphics[] = [];
    const runtime = new PhaserConcertLightingRuntime({
      add: { graphics: () => {
        const value = new Graphics();
        graphics.push(value);
        return value;
      } },
    });

    expect(runtime.start()).toBe(true);
    expect(runtime.snapshot).toMatchObject({
      started: true,
      active: false,
      objectCount: 11,
      darkZoneCount: CONCERT_LIGHTING_CONTRACT.darkZoneCount,
      spotlightCount: CONCERT_LIGHTING_CONTRACT.spotlightCount,
      colorLightCount: CONCERT_LIGHTING_CONTRACT.colorLightCount,
      laserCount: CONCERT_LIGHTING_CONTRACT.laserCount,
    });
    expect(graphics).toHaveLength(11);
    expect(graphics.every((value) => !value.visible)).toBe(true);

    runtime.update(1_000, { left: 0, top: 0, width: 480, height: 270 });
    expect(runtime.snapshot.active).toBe(false);
    expect(graphics.every((value) => !value.visible)).toBe(true);

    runtime.update(2_000, { left: 1_600, top: 350, width: 640, height: 550 });
    expect(runtime.snapshot.active).toBe(true);
    expect(graphics.every((value) => value.visible)).toBe(true);
    expect(graphics.every((value) => value.drawCalls > 0)).toBe(true);

    runtime.update(3_000, { left: 0, top: 0, width: 480, height: 270 });
    expect(runtime.snapshot.active).toBe(false);
    expect(graphics.every((value) => !value.visible)).toBe(true);

    runtime.shutdown();
    expect(runtime.snapshot).toMatchObject({
      started: false,
      active: false,
      objectCount: 0,
    });
    expect(graphics.every((value) => value.destroyed)).toBe(true);
  });
});

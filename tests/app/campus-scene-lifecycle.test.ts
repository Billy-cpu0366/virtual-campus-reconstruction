import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../game/phaser.js", () => ({ default: { Scene: class {} } }));
import { CampusScene } from "../../game/CampusScene.js";
import { PLAYER_RUNTIME_ASSETS } from "../../game/PhaserPlayerRuntime.js";
import { AppGameUiBridge } from "../../game/AppGameUiBridge.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("地图内容关闭后回收虚拟驻留记录", () => {
  vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600, addEventListener: vi.fn() });
  vi.stubGlobal("document", { getElementById: () => null, addEventListener: vi.fn() });
  const listeners: Array<(event: any) => void> = [];
  vi.spyOn(AppGameUiBridge.prototype, "subscribeUserClose").mockImplementation((listener) => {
    listeners.push(listener); return () => {};
  });
  vi.spyOn(AppGameUiBridge.prototype, "show").mockReturnValue({ status: "shown" });
  vi.spyOn(AppGameUiBridge.prototype, "hide").mockReturnValue({ status: "hidden" });
  const scene = new CampusScene() as any;
  scene.time = { now: 0 };
  scene.playerRuntime = { control: { enabled: true }, disableControls: () => true, enableControls: () => true };
  scene.createContentFoundation();
  for (let index = 0; index < 100; index += 1) {
    scene.openContentFromMap({ markerId: "about", menuId: "about", enabled: true });
    const active = scene.interactRuntime.active;
    expect(active).toBeDefined();
    for (const listener of listeners) listener({ ...active, source: "close-button" });
  }
  expect(scene.interactRuntime.committedResidences.size).toBe(0);
  expect(scene.interactRuntime.suppressedResidenceIds).toEqual([]);
  expect(scene.contentLeaseRuntime.activeLeaseCount).toBe(0);
});

it("可选玩家素材失败保持降级路径，随后必需素材错误仍被上报", () => {
  const onError = vi.fn();
  const scene = new CampusScene({ onError }) as any;
  const loader = Object.assign(new EventEmitter(), {
    image: vi.fn(), json: vi.fn(), spritesheet: vi.fn(),
  });
  scene.load = loader;
  scene.preload();
  for (const asset of PLAYER_RUNTIME_ASSETS) loader.emit("loaderror", { key: asset.key });
  expect(onError).not.toHaveBeenCalled();
  expect(scene.sideFailures).toHaveLength(4);
  loader.emit("loaderror", { key: "player" });
  loader.emit("loaderror", { key: "exterior" });
  expect(onError).toHaveBeenCalledOnce();
  expect(onError.mock.calls[0]?.[0].message).toContain("player");
});

it("单个 owner 清理异常仍清理其他 owner，失败任务可重新执行", async () => {
  vi.stubGlobal("window", { removeEventListener: vi.fn() });
  vi.stubGlobal("document", { removeEventListener: vi.fn(), getElementById: () => null });
  const scene = new CampusScene() as any;
  scene.scene = { stop: vi.fn() };
  scene.time = { now: 0 };
  scene.sprayerRuntime = { shutdown: vi.fn().mockImplementationOnce(() => { throw new Error("owner failure"); }) };
  const later = vi.fn();
  scene.routeCrowdRuntime = { shutdown: later };
  scene.shutdownDynamicWorld = vi.fn().mockResolvedValue(undefined);
  await expect(scene.shutdownForGeneration()).rejects.toThrow("Scene cleanup reported failures");
  expect(later).toHaveBeenCalledOnce();
  expect(scene.shutdownDynamicWorld).toHaveBeenCalledOnce();
  expect(scene.scene.stop).toHaveBeenCalledOnce();
  await expect(scene.shutdownForGeneration()).resolves.toMatchObject({
    sideFailures: ["cleanup:sprayer"],
  });
});

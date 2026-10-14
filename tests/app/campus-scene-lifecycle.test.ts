import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../game/phaser.js", () => ({ default: { Scene: class {} } }));
import { CampusScene } from "../../game/CampusScene.js";
import { AppGameUiBridge } from "../../game/AppGameUiBridge.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";
import { loadRouteConfigs } from "../../config/骨架/05-旁支/SYS-ROUTE/逻辑/index.js";
import { loadChunkConfigs } from "../../config/骨架/01-地图线/SYS-CHUNK/逻辑/index.js";
import { loadZoneConfigs } from "../../config/骨架/03-内容线/SYS-ZONE/逻辑/index.js";
import { loadMoveConfigs } from "../../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js";
import { loadInputConfigs } from "../../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js";
import { loadWorldConfigs } from "../../config/骨架/01-地图线/SYS-WORLD/逻辑/index.js";
import { loadCameraConfigs } from "../../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js";
import { loadInteractConfigs } from "../../config/骨架/03-内容线/SYS-INTERACT/逻辑/index.js";
import { loadLayerConfigs } from "../../config/骨架/02-玩法线/SYS-LAYER/逻辑/index.js";
import { loadPlayerConfigs } from "../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";
import { loadEntityConfigs } from "../../config/骨架/04-独立件/SYS-ENTITY/逻辑/index.js";
import { loadFxConfigs } from "../../config/骨架/05-旁支/SYS-FX/逻辑/index.js";
import { loadTransportConfigs } from "../../config/骨架/06-网络协议层/SYS-TRANSPORT/逻辑/index.js";

/**
 * 场景现在**必须**带着配置才能造出来——`preload()` 要靠配置里的帧规格登记贴图。
 * 这里读的是磁盘上那份真配置，和游戏里读的是同一份。
 *
 * 参数是「一个板块一组」：NPC 一组、路线一组。以后每接一个板块就多一组。
 */
const CONFIG_SOURCE = createDiskConfigSource();
const NPC_CONFIGS = await loadNpcConfigs(CONFIG_SOURCE);
const ROUTE_CONFIGS = await loadRouteConfigs(CONFIG_SOURCE);
const PLAYER_CONFIGS = await loadPlayerConfigs(CONFIG_SOURCE);
const TRANSPORT_CONFIGS = await loadTransportConfigs(CONFIG_SOURCE);
const ENTITY_CONFIGS = await loadEntityConfigs(CONFIG_SOURCE);
const SET1_ENTITY_CONFIGS = await loadEntityConfigs(createDiskConfigSource("config/set1"));
const loadChunk = () => loadChunkConfigs(CONFIG_SOURCE);
const loadZone = () => loadZoneConfigs(CONFIG_SOURCE);
const loadMove = () => loadMoveConfigs(CONFIG_SOURCE);
const loadInput = () => loadInputConfigs(CONFIG_SOURCE);
const loadWorld = () => loadWorldConfigs(CONFIG_SOURCE);
const loadCamera = () => loadCameraConfigs(CONFIG_SOURCE);
const loadInteract = () => loadInteractConfigs(CONFIG_SOURCE);
const loadLayer = () => loadLayerConfigs(CONFIG_SOURCE);
const loadEntity = () => loadEntityConfigs(CONFIG_SOURCE);
const loadFx = () => loadFxConfigs(CONFIG_SOURCE);
const ZONE_CONFIGS = await loadZone();
const INTERACT_CONFIGS = await loadInteract();

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
  const scene = new CampusScene(NPC_CONFIGS, ROUTE_CONFIGS, PLAYER_CONFIGS, TRANSPORT_CONFIGS, loadChunk, loadZone, loadMove, loadInput, loadWorld, loadCamera, loadInteract, loadLayer, loadEntity, loadFx) as any;
  scene.zoneConfigs = ZONE_CONFIGS;
  scene.interactConfigs = INTERACT_CONFIGS;
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
  const scene = new CampusScene(NPC_CONFIGS, ROUTE_CONFIGS, PLAYER_CONFIGS, TRANSPORT_CONFIGS, loadChunk, loadZone, loadMove, loadInput, loadWorld, loadCamera, loadInteract, loadLayer, loadEntity, loadFx, { onError }) as any;
  const loader = Object.assign(new EventEmitter(), {
    image: vi.fn(), json: vi.fn(), spritesheet: vi.fn(),
  });
  scene.load = loader;
  scene.preload();
  for (const asset of PLAYER_CONFIGS.idle.textures) loader.emit("loaderror", { key: asset.key });
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
  const scene = new CampusScene(NPC_CONFIGS, ROUTE_CONFIGS, PLAYER_CONFIGS, TRANSPORT_CONFIGS, loadChunk, loadZone, loadMove, loadInput, loadWorld, loadCamera, loadInteract, loadLayer, loadEntity, loadFx) as any;
  scene.scene = { stop: vi.fn() };
  scene.time = { now: 0 };
  scene.sprayerRuntime = { shutdown: vi.fn().mockImplementationOnce(() => { throw new Error("owner failure"); }) };
  const later = vi.fn();
  scene.routeCrowdRuntime = { shutdown: later };
  scene.entityConfigs = ENTITY_CONFIGS;
  scene.shutdownDynamicWorld = vi.fn().mockResolvedValue(undefined);
  await expect(scene.shutdownForGeneration()).rejects.toThrow("Scene cleanup reported failures");
  expect(later).toHaveBeenCalledOnce();
  expect(scene.shutdownDynamicWorld).toHaveBeenCalledOnce();
  expect(scene.scene.stop).toHaveBeenCalledOnce();
  await expect(scene.shutdownForGeneration()).resolves.toMatchObject({
    sideFailures: ["cleanup:sprayer"],
  });
});

it("场景关停按 SYS-ENTITY 配置的顺序执行运行时清理", async () => {
  vi.stubGlobal("window", { removeEventListener: vi.fn() });
  vi.stubGlobal("document", { removeEventListener: vi.fn(), getElementById: () => null });
  const scene = new CampusScene(NPC_CONFIGS, ROUTE_CONFIGS, PLAYER_CONFIGS, TRANSPORT_CONFIGS, loadChunk, loadZone, loadMove, loadInput, loadWorld, loadCamera, loadInteract, loadLayer, loadEntity, loadFx) as any;
  scene.entityConfigs = SET1_ENTITY_CONFIGS;
  scene.scene = { stop: vi.fn() };
  scene.time = { now: 0 };
  scene.shutdownDynamicWorld = vi.fn().mockResolvedValue(undefined);
  scene.disconnectPoliceCollisions = vi.fn();
  scene.stopRoofTweens = vi.fn();
  scene.stopPlayerMovement = vi.fn();
  scene.clearRuntimeTestHooks = vi.fn();
  const order: string[] = [];
  scene.staticNpcRuntime = { shutdown: () => order.push("static-npc") };
  scene.staticCrowdRuntime = { shutdown: () => order.push("static-crowd") };

  await scene.shutdownForGeneration();

  expect(order).toEqual(["static-crowd", "static-npc"]);
});

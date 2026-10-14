import { afterEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  effects: undefined as any,
  shutdown: vi.fn(),
  destroy: vi.fn(),
  appShutdown: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../../src/app/index.js", () => ({ AppRuntime: class {
  constructor(options: any) { harness.effects = options.effects; }
  start() {}
  shutdown = harness.appShutdown;
} }));
vi.mock("../../src/game-ui/index.js", () => ({ DomAppUi: class { render() {} } }));
vi.mock("../../game/runtimeDiagnostics.js", () => ({ installRuntimeDiagnostics: vi.fn() }));
vi.mock("../../game/CampusScene.js", () => ({ CampusScene: class {
  shutdownForGeneration = harness.shutdown;
} }));
vi.mock("../../game/phaser.js", () => ({ default: {
  AUTO: 0, Scale: { ENVELOP: 0, CENTER_BOTH: 0 },
  Game: class { destroy = harness.destroy; scale = { refresh: harness.refresh }; },
} }));
// 配置是**造游戏对象之前**读的（见 main.ts 里的说明），所以这里把它换成不碰网络的假实现。
// 板块是一个一个接的，每接一个这里就多 mock 一行；漏了的话真实现会去发请求，测试就红了。
vi.mock("../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js", () => ({ loadNpcConfigs: async () => ({}) }));
vi.mock("../../config/骨架/05-旁支/SYS-ROUTE/逻辑/index.js", () => ({ loadRouteConfigs: async () => ({}) }));
vi.mock("../../config/骨架/01-地图线/SYS-CHUNK/逻辑/index.js", () => ({ loadChunkConfigs: async () => ({}) }));
vi.mock("../../config/骨架/03-内容线/SYS-ZONE/逻辑/index.js", () => ({ loadZoneConfigs: async () => ({}) }));
vi.mock("../../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js", () => ({ loadMoveConfigs: async () => ({}) }));
vi.mock("../../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js", () => ({ loadInputConfigs: async () => ({}) }));
vi.mock("../../config/骨架/01-地图线/SYS-WORLD/逻辑/index.js", () => ({ loadWorldConfigs: async () => ({}) }));
vi.mock("../../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js", () => ({ loadCameraConfigs: async () => ({}) }));
vi.mock("../../config/骨架/03-内容线/SYS-INTERACT/逻辑/index.js", () => ({ loadInteractConfigs: async () => ({}) }));
vi.mock("../../config/骨架/02-玩法线/SYS-LAYER/逻辑/index.js", () => ({ loadLayerConfigs: async () => ({}) }));
vi.mock("../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js", () => ({ loadPlayerConfigs: async () => ({}) }));
vi.mock("../../config/骨架/04-独立件/SYS-ENTITY/逻辑/index.js", () => ({ loadEntityConfigs: async () => ({}) }));
vi.mock("../../config/骨架/05-旁支/SYS-FX/逻辑/index.js", () => ({ loadFxConfigs: async () => ({}) }));
vi.mock("../../config/骨架/04-独立件/SYS-APP/逻辑/index.js", () => ({ loadAppConfigs: async () => ({
  logicalWidth: 480, logicalHeight: 270, physicsFps: 30, physicsFixedStep: true,
  physicsGravity: { x: 0, y: 0 }, pixelArt: true, roundPixels: true,
  backgroundColor: "#0f172a", showErrorDetail: true, entryTrainArrivalMs: 5000,
}) }));
vi.mock("../../config/骨架/04-独立件/SYS-GAME-UI/逻辑/index.js", () => ({ loadGameUiConfigs: async () => ({
  breakpoint: { mobile: 767 }, focusRing: "3px solid #0b57d0",
  rootPadding: { desktop: "24px", mobile: "16px" },
}) }));
vi.mock("../../config/骨架/06-网络协议层/SYS-TRANSPORT/逻辑/index.js", () => ({ loadTransportConfigs: async () => ({
  timeouts: { json: 15000 },
}) }));
vi.mock("../../config/骨架/公共/fetch-config-source.js", () => ({ createFetchConfigSource: () => ({}) }));
// `config-location.js` 不 mock：它是纯的，不碰网络也不碰 window。
// main.ts 读 `window.location?.search`，这里 stub 的假 window 没有 location，
// 那句会退回默认那一套，正好。
afterEach(() => vi.unstubAllGlobals());

/** 等新一代把配置读完、把场景和游戏对象造出来。 */
const settleGeneration = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

it("缓存页面往返保留游戏，真实离开仍执行 shutdown", async () => {
  vi.resetModules();
  const handlers = new Map<string, (event: { persisted: boolean }) => void>();
  vi.stubGlobal("document", { getElementById: () => ({ hidden: false, textContent: "" }) });
  vi.stubGlobal("window", { addEventListener: (name: string, handler: any) => handlers.set(name, handler) });
  await import("../../game/main.js");
  harness.effects.startLoading(1, {});
  await settleGeneration();
  handlers.get("pagehide")?.({ persisted: true });
  expect(harness.appShutdown).not.toHaveBeenCalled();
  handlers.get("pageshow")?.({ persisted: true });
  expect(harness.refresh).toHaveBeenCalledOnce();
  handlers.get("pagehide")?.({ persisted: false });
  expect(harness.appShutdown).toHaveBeenCalledOnce();
});

it("场景清理报错后销毁并退役旧代，后续重试可创建新代", async () => {
  vi.stubGlobal("document", { getElementById: () => ({ hidden: false, textContent: "" }) });
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  await import("../../game/main.js");
  harness.shutdown.mockRejectedValueOnce(new Error("owner failure"));
  harness.effects.startLoading(1, {});
  await settleGeneration();
  await expect(harness.effects.cleanup(1)).rejects.toThrow("owner failure");
  expect(harness.destroy).toHaveBeenCalledWith(true);
  await expect(harness.effects.cleanup(1)).resolves.toBeUndefined();
  expect(harness.shutdown).toHaveBeenCalledOnce();
  harness.effects.startLoading(2, {});
  await settleGeneration();
  harness.shutdown.mockResolvedValueOnce({});
  await expect(harness.effects.cleanup(2)).resolves.toBeUndefined();
  expect(harness.destroy).toHaveBeenCalledTimes(2);
});

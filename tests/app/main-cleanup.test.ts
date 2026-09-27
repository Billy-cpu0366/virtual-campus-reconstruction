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
vi.mock("../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js", () => ({ loadNpcConfigs: async () => ({}) }));
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

import Phaser from "./phaser.js";

import {
  AppRuntime,
  type AppLoadCallbacks,
  type AppSnapshot,
} from "../src/app/index.js";
import {
  DomAppUi,
  type DomAppFocusPort,
  type DomAppImageTarget,
  type DomAppTarget,
  type DomAppViewport,
} from "../src/game-ui/index.js";
import {
  CampusScene,
  type CampusAmbientGuideTarget,
  type CampusSceneEntryCallbacks,
  type CampusSceneShutdownReceipt,
} from "./CampusScene.js";
import type {
  ProductEntryGuideTarget,
  ProductEntrySnapshot,
} from "./ProductEntryRuntime.js";
import { installRuntimeDiagnostics } from "./runtimeDiagnostics.js";
import { loadNpcConfigs } from "../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";
import { loadRouteConfigs } from "../config/骨架/05-旁支/SYS-ROUTE/逻辑/index.js";
import { loadChunkConfigs } from "../config/骨架/01-地图线/SYS-CHUNK/逻辑/index.js";
import { loadZoneConfigs } from "../config/骨架/03-内容线/SYS-ZONE/逻辑/index.js";
import { loadMoveConfigs } from "../config/骨架/02-玩法线/SYS-MOVE/逻辑/index.js";
import { loadInputConfigs } from "../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js";
import { loadWorldConfigs } from "../config/骨架/01-地图线/SYS-WORLD/逻辑/index.js";
import { loadCameraConfigs } from "../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js";
import { loadInteractConfigs } from "../config/骨架/03-内容线/SYS-INTERACT/逻辑/index.js";
import { loadLayerConfigs } from "../config/骨架/02-玩法线/SYS-LAYER/逻辑/index.js";
import { loadPlayerConfigs } from "../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";
import { loadEntityConfigs } from "../config/骨架/04-独立件/SYS-ENTITY/逻辑/index.js";
import { loadFxConfigs } from "../config/骨架/05-旁支/SYS-FX/逻辑/index.js";
import { loadAppConfigs, type AppConfigs } from "../config/骨架/04-独立件/SYS-APP/逻辑/index.js";
import { loadGameUiConfigs } from "../config/骨架/04-独立件/SYS-GAME-UI/逻辑/index.js";
import {
  loadTransportConfigs,
  type TransportConfigs,
} from "../config/骨架/06-网络协议层/SYS-TRANSPORT/逻辑/index.js";
import { createFetchConfigSource } from "../config/骨架/公共/fetch-config-source.js";
import {
  configBaseUrlFor,
  resolveConfigSet,
} from "../config/骨架/公共/config-location.js";

/**
 * 这一局读哪一套配置：网址上带 `?config=set1` 就读 set1，不带就读 `config/default/`。
 * 什么算合法集名、认不出来怎么办，都在 `config-location.ts` 里，这里只把网址递进去。
 *
 * `window.location?.` 那个问号不能省：测试里 `window` 是换过的假对象，没有 `location`。
 */
const CONFIG_BASE_URL = configBaseUrlFor(
  resolveConfigSet(window.location?.search ?? ""),
);

interface PhaserGameLike {
  readonly scale?: {
    refresh(): void;
  };
  destroy(removeCanvas?: boolean): void;
}

interface AppGeneration {
  readonly generation: number;
  /** 配置读回来、场景造出来之后才有值。读配置那段时间它是 `undefined`。 */
  scene: CampusScene | undefined;
  game: PhaserGameLike | undefined;
  cancelled: boolean;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`missing app element: #${id}`);
  return element as T;
}

function asAppTarget(id: string): DomAppTarget {
  return requiredElement<HTMLElement>(id) as unknown as DomAppTarget;
}

function asAppImageTarget(id: string): DomAppImageTarget {
  return requiredElement<HTMLImageElement>(id) as unknown as DomAppImageTarget;
}

const shell = requiredElement<HTMLElement>("app-shell");
const playButton = requiredElement<HTMLButtonElement>("app-play");
const retryButton = requiredElement<HTMLButtonElement>("app-retry");
const guide = requiredElement<HTMLElement>("content-guide");
const appTestHooksEnabled =
  import.meta.env.DEV || import.meta.env.MODE === "test-hooks";
let currentGeneration: AppGeneration | undefined;
let latestAppSnapshot: AppSnapshot = Object.freeze({
  status: "BOOT",
  generation: 0,
  progress: 0,
});
let latestEntrySnapshot: ProductEntrySnapshot | undefined;
let latestCleanupReceipt:
  | {
      readonly generation: number;
      /** 场景没造出来就被清理时是 `undefined`——没有场景自然没有收据。 */
      readonly receipt: CampusSceneShutdownReceipt | undefined;
    }
  | undefined;

const viewport: DomAppViewport = {
  getSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
  subscribeResize: (listener) => {
    const handler = (): void => listener();
    window.addEventListener("resize", handler);
    window.visualViewport?.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.visualViewport?.removeEventListener("resize", handler);
    };
  },
};

const focus: DomAppFocusPort = {
  getActiveElement: () =>
    document.activeElement === null
      ? undefined
      : (document.activeElement as unknown as DomAppTarget),
  focus: (target) => target.focus?.(),
};

let appRuntime: AppRuntime | undefined;
let appUi: DomAppUi | undefined;
let latestAppConfig: AppConfigs | undefined;
const configSource = createFetchConfigSource({ baseUrl: CONFIG_BASE_URL });

function createAppUi(
  gameUiConfigs: Awaited<ReturnType<typeof loadGameUiConfigs>>,
  appConfigs: Pick<AppConfigs, "showErrorDetail">,
): DomAppUi {
  return new DomAppUi(
    {
      elements: {
        root: asAppTarget("app-shell"),
        loading: asAppTarget("app-loading"),
        progressBar: asAppTarget("app-progress-bar"),
        progressText: asAppTarget("app-progress-text"),
        ready: asAppTarget("app-ready"),
        play: playButton as unknown as DomAppTarget,
        error: asAppTarget("app-error"),
        errorText: asAppTarget("app-error-text"),
        retry: retryButton as unknown as DomAppTarget,
      },
      viewport,
      focus,
      onViewportChange: () => {
        currentGeneration?.game?.scale?.refresh();
      },
      optionalImages: [
        {
          image: asAppImageTarget("app-loading-image"),
          fallbackAlt: "Peter Oravec portfolio loader unavailable",
        },
        {
          image: asAppImageTarget("app-logo"),
          fallbackAlt: "Peter Oravec portfolio logo unavailable",
        },
      ],
      onPlay: () => {
        appRuntime?.play();
      },
      onRetry: () => {
        appRuntime?.retry();
      },
    },
    {
      mobileBreakpoint: gameUiConfigs.breakpoint.mobile,
      focusRing: gameUiConfigs.focusRing,
      rootPadding: gameUiConfigs.rootPadding,
      showErrorDetail: appConfigs.showErrorDetail,
    },
  );
}

function publishGuide(target: ProductEntryGuideTarget): boolean {
  guide.textContent =
    `Explore ${target.menuId.toUpperCase()} · ` +
    `head west ${target.westTiles} tiles, then north ${target.northTiles}`;
  guide.hidden = false;
  return true;
}

function publishAmbientGuide(target: CampusAmbientGuideTarget): void {
  const route = target.steps
    .map((step) => `${step.direction} ${step.tiles}`)
    .join(", then ");
  guide.textContent = `${target.label} · ${route}`;
  guide.hidden = false;
}

function isCurrent(generation: number): boolean {
  const current = currentGeneration;
  return (
    current !== undefined &&
    current.generation === generation &&
    !current.cancelled
  );
}

function createSceneCallbacks(
  generation: number,
  callbacks: AppLoadCallbacks,
): CampusSceneEntryCallbacks {
  return {
    onLoadProgress: (ratio) => {
      if (isCurrent(generation)) callbacks.onProgress(ratio);
    },
    onReady: () => {
      if (!isCurrent(generation)) return;
      currentGeneration?.game?.scale?.refresh();
      callbacks.onReady();
    },
    onEntryStatus: (snapshot) => {
      if (isCurrent(generation)) latestEntrySnapshot = snapshot;
    },
    onGuide: (target) =>
      isCurrent(generation) ? publishGuide(target) : false,
    onAmbientGuide: (target) => {
      if (isCurrent(generation)) publishAmbientGuide(target);
    },
    onModalVisibility: (visible) => {
      if (!isCurrent(generation)) return;
      guide.hidden = visible || guide.textContent === "";
      if (visible) appRuntime?.openModal();
      else appRuntime?.closeModal();
    },
    onError: (error) => {
      if (isCurrent(generation)) callbacks.onError(error);
    },
  };
}

function gameConfig(
  scene: CampusScene,
  appConfigs: AppConfigs,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: "app",
    width: appConfigs.logicalWidth,
    height: appConfigs.logicalHeight,
    backgroundColor: appConfigs.backgroundColor,
    pixelArt: appConfigs.pixelArt,
    roundPixels: appConfigs.roundPixels,
    physics: {
      default: "arcade",
      arcade: {
        gravity: appConfigs.physicsGravity,
        fixedStep: appConfigs.physicsFixedStep,
        fps: appConfigs.physicsFps,
      },
    },
    scale: {
      mode: Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: appConfigs.logicalWidth,
      height: appConfigs.logicalHeight,
    },
    scene: [scene],
  };
}

appRuntime = new AppRuntime({
  effects: {
    startLoading: (generation, callbacks) => {
      guide.hidden = true;
      guide.textContent = "";
      latestEntrySnapshot = undefined;
      const active: AppGeneration = {
        generation,
        scene: undefined,
        game: undefined,
        cancelled: false,
      };
      currentGeneration = active;
      // 配置必须在 `new Phaser.Game` **之前**读完。
      //
      // 原因：贴图的帧规格（每帧多大、共几帧）是 `preload()` 阶段就要报给
      // Phaser 的，而 `preload()` 跟在这句后面同步跑起来，来不及等网络。
      // 所以顺序是：读配置 → 造游戏对象 → 场景自己按配置登记贴图。
      //
      // 两个板块**同时**发请求，不是读完一个再读另一个：它们互不依赖，
      // 排队只会让首屏多等一趟网络。板块多了以后也一样，谁慢等谁。
      const gameUiConfigPromise = loadGameUiConfigs(configSource);
      let loadedAppConfig: AppConfigs | undefined;
      const appConfigPromise = loadAppConfigs(configSource).then((config) => {
        loadedAppConfig = config;
        return config;
      });
      void Promise.all([
        appConfigPromise,
        gameUiConfigPromise,
        loadNpcConfigs(configSource),
        loadRouteConfigs(configSource),
        loadPlayerConfigs(configSource),
        loadTransportConfigs(configSource),
      ]).then(
        ([appConfigs, gameUiConfigs, npcConfigs, routeConfigs, playerConfigs, transportConfigs]) => {
          if (active.cancelled || currentGeneration !== active) return;
          latestAppConfig = appConfigs;
          if (appUi === undefined) {
            appUi = createAppUi(gameUiConfigs, appConfigs);
            appUi.render(latestAppSnapshot);
          }
          const scene = new CampusScene(
            npcConfigs,
            routeConfigs,
            playerConfigs,
            transportConfigs,
            () => Promise.all([loadChunkConfigs(configSource)]).then(([chunk]) => chunk),
            () => Promise.all([loadZoneConfigs(configSource)]).then(([zone]) => zone),
            () => Promise.all([loadMoveConfigs(configSource)]).then(([move]) => move),
            () => Promise.all([loadInputConfigs(configSource)]).then(([input]) => input),
            () => Promise.all([loadWorldConfigs(configSource)]).then(([world]) => world),
            () => Promise.all([loadCameraConfigs(configSource)]).then(([camera]) => camera),
            () => Promise.all([loadInteractConfigs(configSource)]).then(([interact]) => interact),
            () => Promise.all([loadLayerConfigs(configSource)]).then(([layer]) => layer),
            () => loadEntityConfigs(configSource),
            () => loadFxConfigs(configSource),
            createSceneCallbacks(generation, callbacks),
          );
          active.scene = scene;
          try {
            active.game = new Phaser.Game(gameConfig(scene, appConfigs)) as PhaserGameLike;
          } catch (error) {
            if (currentGeneration === active) currentGeneration = undefined;
            callbacks.onError(error);
          }
        },
        (error: unknown) => {
          if (active.cancelled || currentGeneration !== active) return;
          callbacks.onError(error);
          if (appUi === undefined) {
            void gameUiConfigPromise.then((gameUiConfigs) => {
              if (active.cancelled || currentGeneration !== active || appUi !== undefined) return;
              appUi = createAppUi(gameUiConfigs, {
                showErrorDetail: loadedAppConfig?.showErrorDetail ?? true,
              });
              appUi.render(latestAppSnapshot);
            }).catch(() => undefined);
          }
        },
      );
      return {
        cancel: () => {
          active.cancelled = true;
        },
      };
    },
    cleanup: async (generation) => {
      const active = currentGeneration;
      if (active === undefined || active.generation !== generation) return;
      active.cancelled = true;
      // 场景可能还没造出来（配置还没读完就被取消/重试）。那种情况下没有
      // 收据，但清理照样要往下走——游戏对象和界面都要收干净。
      let receipt: CampusSceneShutdownReceipt | undefined;
      try {
        receipt = await active.scene?.shutdownForGeneration();
      } finally {
        active.game?.destroy(true);
        // Once Phaser accepts destruction this generation is retired, even
        // if an individual scene owner reported a cleanup error. Retry can
        // create a fresh generation instead of reusing a rejected cleanup.
        if (currentGeneration === active) currentGeneration = undefined;
        latestEntrySnapshot = undefined;
        guide.hidden = true;
        guide.textContent = "";
      }
      latestCleanupReceipt = Object.freeze({ generation, receipt });
    },
    enterGame: (generation, onEntered, onError) => {
      const active = currentGeneration;
      if (
        active === undefined ||
        active.generation !== generation ||
        active.cancelled ||
        active.scene === undefined
      ) {
        onError(new Error("current app generation is unavailable"));
        return;
      }
      void active.scene.startProductEntry().then((result) => {
        if (!isCurrent(generation)) return;
        if (result.status === "completed") onEntered();
        else if (result.status === "failed") onError(result.error);
        else onError(new Error("product entry was cancelled"));
      }, onError);
    },
  },
  onChange: (snapshot) => {
    const generationChanged = latestAppSnapshot.generation !== snapshot.generation;
    latestAppSnapshot = snapshot;
    document.body.dataset.appState = snapshot.status;
    document.body.dataset.appGeneration = String(snapshot.generation);
    shell.hidden =
      snapshot.status === "ENTERING_GAME" ||
      snapshot.status === "PLAYING" ||
      snapshot.status === "MODAL_OPEN" ||
      snapshot.status === "SHUTDOWN";
    if (generationChanged) {
      playButton.disabled = false;
      retryButton.disabled = false;
    }
    appUi?.render(snapshot);
  },
});

if (appTestHooksEnabled) {
  (window as any).__campusEntryTest = Object.freeze({
    snapshot: () => ({
      app: latestAppSnapshot,
      runtime: latestEntrySnapshot ?? null,
      currentGeneration: currentGeneration?.generation ?? null,
      cleanup: latestCleanupReceipt ?? null,
      guideHidden: guide.hidden,
      guideText: guide.textContent ?? "",
      canvasCount: document.querySelectorAll("#app canvas").length,
      logicalViewport: {
        width: latestAppConfig?.logicalWidth ?? null,
        height: latestAppConfig?.logicalHeight ?? null,
      },
    }),
  });
}

window.addEventListener("pagehide", (event) => {
  // A persisted page keeps its live generation for back/forward restoration.
  if (!event.persisted) appRuntime?.shutdown();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) currentGeneration?.game?.scale?.refresh();
});
installRuntimeDiagnostics();
appRuntime.start();

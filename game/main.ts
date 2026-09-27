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
import { createFetchConfigSource } from "../config/骨架/公共/fetch-config-source.js";
import {
  configBaseUrlFor,
  resolveConfigSet,
} from "../config/骨架/公共/config-location.js";

const LOGICAL_WORLD_WIDTH = 480;
const LOGICAL_WORLD_HEIGHT = 270;

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

let appRuntime: AppRuntime;
const appUi = new DomAppUi({
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
    appRuntime.play();
  },
  onRetry: () => {
    appRuntime.retry();
  },
});

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
      if (visible) appRuntime.openModal();
      else appRuntime.closeModal();
    },
    onError: (error) => {
      if (isCurrent(generation)) callbacks.onError(error);
    },
  };
}

function gameConfig(scene: CampusScene): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: "app",
    width: LOGICAL_WORLD_WIDTH,
    height: LOGICAL_WORLD_HEIGHT,
    backgroundColor: "#0f172a",
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        fixedStep: true,
        fps: 30,
      },
    },
    scale: {
      mode: Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LOGICAL_WORLD_WIDTH,
      height: LOGICAL_WORLD_HEIGHT,
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
      void loadNpcConfigs(createFetchConfigSource({ baseUrl: CONFIG_BASE_URL })).then(
        (npcConfigs) => {
          if (active.cancelled || currentGeneration !== active) return;
          const scene = new CampusScene(
            npcConfigs,
            createSceneCallbacks(generation, callbacks),
          );
          active.scene = scene;
          try {
            active.game = new Phaser.Game(gameConfig(scene)) as PhaserGameLike;
          } catch (error) {
            if (currentGeneration === active) currentGeneration = undefined;
            callbacks.onError(error);
          }
        },
        (error: unknown) => {
          if (active.cancelled || currentGeneration !== active) return;
          callbacks.onError(error);
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
    appUi.render(snapshot);
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
        width: LOGICAL_WORLD_WIDTH,
        height: LOGICAL_WORLD_HEIGHT,
      },
    }),
  });
}

window.addEventListener("pagehide", (event) => {
  // A persisted page keeps its live generation for back/forward restoration.
  if (!event.persisted) appRuntime.shutdown();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) currentGeneration?.game?.scale?.refresh();
});
installRuntimeDiagnostics();
appRuntime.start();

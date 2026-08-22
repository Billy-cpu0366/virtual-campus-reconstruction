import Phaser from "./phaser.js";

import {
  AppRuntime,
  type AppLoadCallbacks,
  type AppSnapshot,
} from "../src/app/index.js";
import {
  DomAppUi,
  type DomAppFocusPort,
  type DomAppTarget,
  type DomAppViewport,
} from "../src/game-ui/index.js";
import {
  CampusScene,
  type CampusSceneEntryCallbacks,
  type CampusSceneShutdownReceipt,
} from "./CampusScene.js";
import type {
  ProductEntryGuideTarget,
  ProductEntrySnapshot,
} from "./ProductEntryRuntime.js";
import { installRuntimeDiagnostics } from "./runtimeDiagnostics.js";

const LOGICAL_WORLD_WIDTH = 480;
const LOGICAL_WORLD_HEIGHT = 270;

interface PhaserGameLike {
  destroy(removeCanvas?: boolean): void;
}

interface AppGeneration {
  readonly generation: number;
  readonly scene: CampusScene;
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
  | { readonly generation: number; readonly receipt: CampusSceneShutdownReceipt }
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
    loading: asAppTarget("app-loading"),
    progressBar: asAppTarget("app-progress-bar"),
    progressText: asAppTarget("app-progress-text"),
    play: playButton as unknown as DomAppTarget,
    error: asAppTarget("app-error"),
    errorText: asAppTarget("app-error-text"),
    retry: retryButton as unknown as DomAppTarget,
  },
  viewport,
  focus,
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
      if (isCurrent(generation)) callbacks.onReady();
    },
    onEntryStatus: (snapshot) => {
      if (isCurrent(generation)) latestEntrySnapshot = snapshot;
    },
    onGuide: (target) =>
      isCurrent(generation) ? publishGuide(target) : false,
    onModalVisibility: (visible) => {
      if (!isCurrent(generation)) return;
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
      mode: Phaser.Scale.FIT,
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
      const scene = new CampusScene(
        createSceneCallbacks(generation, callbacks),
      );
      const active: AppGeneration = {
        generation,
        scene,
        game: undefined,
        cancelled: false,
      };
      currentGeneration = active;
      try {
        active.game = new Phaser.Game(gameConfig(scene)) as PhaserGameLike;
      } catch (error) {
        if (currentGeneration === active) currentGeneration = undefined;
        throw error;
      }
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
      let receipt: CampusSceneShutdownReceipt;
      try {
        receipt = await active.scene.shutdownForGeneration();
      } finally {
        active.game?.destroy(true);
      }
      latestCleanupReceipt = Object.freeze({ generation, receipt });
      if (currentGeneration === active) currentGeneration = undefined;
      latestEntrySnapshot = undefined;
      guide.hidden = true;
      guide.textContent = "";
    },
    enterGame: (generation, onEntered, onError) => {
      const active = currentGeneration;
      if (
        active === undefined ||
        active.generation !== generation ||
        active.cancelled
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

window.addEventListener("pagehide", () => appRuntime.shutdown(), { once: true });
installRuntimeDiagnostics();
appRuntime.start();

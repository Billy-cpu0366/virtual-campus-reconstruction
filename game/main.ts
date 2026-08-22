import Phaser from "./phaser.js";

import {
  CampusScene,
  type CampusSceneEntryCallbacks,
} from "./CampusScene.js";
import type {
  ProductEntryGuideTarget,
  ProductEntrySnapshot,
} from "./ProductEntryRuntime.js";
import { installRuntimeDiagnostics } from "./runtimeDiagnostics.js";

const LOGICAL_WORLD_WIDTH = 480;
const LOGICAL_WORLD_HEIGHT = 270;

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`missing entry element: #${id}`);
  return element as T;
}

const shell = requiredElement<HTMLElement>("entry-shell");
const status = requiredElement<HTMLElement>("entry-status");
const progress = requiredElement<HTMLProgressElement>("entry-progress");
const progressText = requiredElement<HTMLElement>("entry-progress-text");
const playButton = requiredElement<HTMLButtonElement>("entry-play");
const guide = requiredElement<HTMLElement>("content-guide");
let entryState = "loading";
let latestEntrySnapshot: ProductEntrySnapshot | undefined;
let autoPlayQueued = false;
const entryTestHooksEnabled =
  import.meta.env.DEV || import.meta.env.MODE === "test-hooks";

function setState(state: string): void {
  entryState = state;
  document.body.dataset.entryState = state;
}

function showFailure(error: Error): void {
  setState("error");
  shell.hidden = false;
  status.textContent = `Unable to enter campus: ${error.message}`;
  progress.hidden = true;
  progressText.hidden = true;
  playButton.hidden = true;
}

function publishGuide(target: ProductEntryGuideTarget): boolean {
  guide.textContent =
    `Explore ${target.menuId.toUpperCase()} · ` +
    `head west ${target.westTiles} tiles, then north ${target.northTiles}`;
  guide.hidden = false;
  return true;
}

const callbacks: CampusSceneEntryCallbacks = {
  onLoadProgress: (value) => {
    if (entryState === "error") return;
    const normalized = Math.min(1, Math.max(0, value));
    const percentage = Math.round(normalized * 100);
    setState("loading");
    progress.value = percentage;
    progressText.textContent = `${percentage}%`;
    status.textContent = "Loading campus assets…";
  },
  onReady: () => {
    if (entryState === "error") return;
    setState("ready");
    progress.value = 100;
    progressText.textContent = "100%";
    status.textContent = "Campus ready";
    playButton.hidden = false;
    playButton.disabled = false;
    if (
      entryTestHooksEnabled &&
      new URLSearchParams(window.location.search).has("entry-autoplay") &&
      !autoPlayQueued
    ) {
      autoPlayQueued = true;
      queueMicrotask(() => playButton.click());
    }
  },
  onEntryStatus: (snapshot) => {
    latestEntrySnapshot = snapshot;
    setState(snapshot.status);
    if (snapshot.status === "entering") {
      shell.hidden = true;
    }
  },
  onGuide: publishGuide,
  onError: showFailure,
};

const campusScene = new CampusScene(callbacks);
playButton.addEventListener(
  "click",
  () => {
    if (playButton.disabled || entryState !== "ready") return;
    playButton.disabled = true;
    playButton.textContent = "Entering…";
    void campusScene.startProductEntry().then((result) => {
      if (result.status === "failed") showFailure(result.error);
    });
  },
  { once: true },
);

const config: Phaser.Types.Core.GameConfig = {
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
  scene: [campusScene],
};

if (entryTestHooksEnabled) {
  (window as any).__campusEntryTest = Object.freeze({
    play: () => playButton.click(),
    snapshot: () => ({
      state: entryState,
      runtime: latestEntrySnapshot ?? null,
      progress: progress.value,
      shellHidden: shell.hidden,
      playHidden: playButton.hidden,
      playDisabled: playButton.disabled,
      guideHidden: guide.hidden,
      guideText: guide.textContent ?? "",
      logicalViewport: {
        width: LOGICAL_WORLD_WIDTH,
        height: LOGICAL_WORLD_HEIGHT,
      },
    }),
  });
}

installRuntimeDiagnostics();
new Phaser.Game(config);

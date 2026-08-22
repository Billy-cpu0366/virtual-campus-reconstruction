import { writeFileSync } from "node:fs";

import { clickPlay } from "./browser-app-actions.mjs";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const appBase = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4175";
const outputPath =
  process.env.PERF_OUTPUT ?? ".pi/window-d-perf-baseline-results.json";
const initialWaitMs = Number(process.env.PERF_INITIAL_WAIT_MS ?? 6000);
const settleTimeoutMs = Number(process.env.PERF_SETTLE_TIMEOUT_MS ?? 16000);
const frameSampleMs = Number(process.env.PERF_FRAME_SAMPLE_MS ?? 1500);
const viewports = [
  { name: "small", width: 320, height: 240 },
  { name: "default", width: 780, height: 437 },
  { name: "large", width: 1920, height: 1080 },
];
const zooms = [0.5, 1, 2];
const positions = [
  { name: "center", x: 1120, y: 1120 },
  { name: "north-west-boundary", x: 8, y: 8 },
  { name: "south-east-boundary", x: 2232, y: 2232 },
];
const origin = new URL(appBase).origin;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function keyOf(coordinate) {
  return `${coordinate.x}_${coordinate.y}`;
}

function sortedKeys(coordinates) {
  return [...(coordinates ?? [])]
    .map(keyOf)
    .sort((left, right) => {
      const [leftY, leftX] = left.split("_").map(Number).reverse();
      const [rightY, rightX] = right.split("_").map(Number).reverse();
      return leftY - rightY || leftX - rightX;
    });
}

function coordinatesInRange(startX, startY, endX, endY) {
  const result = [];
  if (startX > endX || startY > endY) return result;
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      result.push({ x, y });
    }
  }
  return result;
}

function expectedTargetKeys(player, camera) {
  const geometry = {
    chunkWidthTiles: 28,
    chunkHeightTiles: 28,
    chunksHorizontal: 5,
    chunksVertical: 5,
    tileWidthPixels: 16,
    tileHeightPixels: 16,
  };
  const playerChunk = {
    x: Math.floor(player.x / (28 * 16)),
    y: Math.floor(player.y / (28 * 16)),
  };
  const playerChunks = coordinatesInRange(
    Math.max(0, playerChunk.x - 1),
    Math.max(0, playerChunk.y - 1),
    Math.min(4, playerChunk.x + 1),
    Math.min(4, playerChunk.y + 1),
  ).filter(
    (coordinate) =>
      coordinate.x >= 0 &&
      coordinate.y >= 0 &&
      coordinate.x < geometry.chunksHorizontal &&
      coordinate.y < geometry.chunksVertical,
  );
  const endWorldX = camera.scrollX + camera.width / camera.zoom;
  const endWorldY = camera.scrollY + camera.height / camera.zoom;
  const startTileX = Math.floor(camera.scrollX / geometry.tileWidthPixels);
  const startTileY = Math.floor(camera.scrollY / geometry.tileHeightPixels);
  const endTileX = Math.ceil(endWorldX / geometry.tileWidthPixels);
  const endTileY = Math.ceil(endWorldY / geometry.tileHeightPixels);
  const cameraChunks = coordinatesInRange(
    Math.max(
      0,
      Math.floor(startTileX / geometry.chunkWidthTiles) - 1,
    ),
    Math.max(
      0,
      Math.floor(startTileY / geometry.chunkHeightTiles) - 1,
    ),
    Math.min(
      geometry.chunksHorizontal - 1,
      Math.ceil(endTileX / geometry.chunkWidthTiles) + 1,
    ),
    Math.min(
      geometry.chunksVertical - 1,
      Math.ceil(endTileY / geometry.chunkHeightTiles) + 1,
    ),
  );
  return [...new Set([...playerChunks, ...cameraChunks].map(keyOf))].sort(
    (left, right) => {
      const [leftY, leftX] = left.split("_").map(Number).reverse();
      const [rightY, rightX] = right.split("_").map(Number).reverse();
      return leftY - rightY || leftX - rightX;
    },
  );
}

function sameKeys(left, right) {
  const leftKeys = [...left].sort();
  const rightKeys = [...right].sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((value, index) => value === rightKeys[index])
  );
}

function subsetKeys(left, right) {
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

async function createTarget(url) {
  const response = await fetch(
    `${cdpBase}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`could not create target: ${response.status}`);
  }
  return response.json();
}

async function inspectTarget(target, viewport, url, testZoom) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  const events = {
    requests: [],
    responses: [],
    failures: [],
    exceptions: [],
  };
  const requestUrls = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request !== undefined) {
      pending.delete(message.id);
      if (message.error !== undefined) {
        request.reject(new Error(JSON.stringify(message.error)));
      } else {
        request.resolve(message.result ?? {});
      }
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      events.exceptions.push(
        message.params.exceptionDetails?.exception?.description ??
          message.params.exceptionDetails?.text ??
          "runtime exception",
      );
    }
    if (message.method === "Network.requestWillBeSent") {
      const requestUrl = message.params.request.url;
      requestUrls.set(message.params.requestId, requestUrl);
      if (requestUrl.startsWith(origin)) {
        events.requests.push({
          url: requestUrl,
          type: message.params.type ?? null,
          requestId: message.params.requestId,
        });
      }
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params.response;
      if (response.url.startsWith(origin)) {
        events.responses.push({
          url: response.url,
          status: response.status,
          type: message.params.type ?? null,
        });
      }
    }
    if (message.method === "Network.loadingFailed") {
      const failedUrl = requestUrls.get(message.params.requestId);
      if (failedUrl?.startsWith(origin)) {
        events.failures.push({
          url: failedUrl,
          errorText: message.params.errorText,
        });
      }
      requestUrls.delete(message.params.requestId);
    }
    if (message.method === "Network.loadingFinished") {
      requestUrls.delete(message.params.requestId);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const command = (method, params = {}) => {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (result.exceptionDetails !== undefined) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "Runtime.evaluate failed",
      );
    }
    return result.result?.value;
  };

  const snapshot = async () =>
    evaluate(`(() => {
      const game =
        window.__capturedPhaserGame ?? window.Phaser?.GAMES?.[0];
      const scene = game?.scene?.getScene?.("campus");
      const camera = scene?.cameras?.main;
      const debug = window.__campusDebug?.() ?? null;
      return {
        debug,
        phaserGlobal: {
          gamesType: typeof window.Phaser?.GAMES,
          gamesLength: Array.isArray(window.Phaser?.GAMES)
            ? window.Phaser.GAMES.length
            : null,
          phaserKeys: Object.keys(window.Phaser ?? {})
            .filter((key) => /game/i.test(key))
            .slice(0, 20),
        },
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          dpr: window.devicePixelRatio,
        },
        canvas: (() => {
          const canvas = document.querySelector("#app canvas");
          return canvas
            ? { width: canvas.width, height: canvas.height }
            : null;
        })(),
        camera: camera
          ? {
              scrollX: camera.scrollX,
              scrollY: camera.scrollY,
              width: camera.width,
              height: camera.height,
              zoom: camera.zoom,
            }
          : null,
        phaser: game?.loop
          ? {
              actualFps: game.loop.actualFps,
              fps: game.loop.fps,
              delta: game.loop.delta,
              frame: game.loop.frame,
            }
          : null,
        display: scene
          ? {
              children: scene.children?.list?.length ?? null,
              displayList: scene.sys?.displayList?.list?.length ?? null,
            }
          : null,
        diagnostics: document.getElementById("diag")?.textContent ?? "",
      };
    })()`);

  const frameSample = async () =>
    evaluate(`new Promise((resolve) => {
      const started = performance.now();
      let frames = 0;
      let previous;
      const intervals = [];
      const tick = (timestamp) => {
        frames += 1;
        if (previous !== undefined) intervals.push(timestamp - previous);
        previous = timestamp;
        if (timestamp - started >= ${frameSampleMs}) {
          const elapsed = timestamp - started;
          const meanInterval = intervals.length === 0
            ? null
            : intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
          resolve({
            frames,
            elapsedMs: elapsed,
            rafFps: elapsed > 0 ? (frames * 1000) / elapsed : null,
            intervalMeanMs: meanInterval,
            intervalMinMs: intervals.length ? Math.min(...intervals) : null,
            intervalMaxMs: intervals.length ? Math.max(...intervals) : null,
          });
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    })`, true);

  const heapSample = async () => {
    const runtimeHeap = await command("Runtime.getHeapUsage");
    let domCounters = null;
    try {
      domCounters = await command("Memory.getDOMCounters");
    } catch {
      // Memory domain is optional in the running Chromium.
    }
    const metrics = await command("Performance.getMetrics");
    const selectedMetrics = Object.fromEntries(
      (metrics.metrics ?? [])
        .filter(({ name }) =>
          [
            "JSHeapUsedSize",
            "JSHeapTotalSize",
            "Nodes",
            "LayoutCount",
            "RecalcStyleCount",
            "TaskDuration",
            "ScriptDuration",
            "LayoutDuration",
            "RecalcStyleDuration",
            "ThreadTime",
          ].includes(name),
        )
        .map(({ name, value }) => [name, value]),
    );
    const pageMemory = await evaluate(`performance.memory
      ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        }
      : null`);
    return {
      runtimeHeap: {
        usedSize: runtimeHeap.usedSize ?? null,
        totalSize: runtimeHeap.totalSize ?? null,
        embedderHeapUsedSize: runtimeHeap.embedderHeapUsedSize ?? null,
        backingStorageSize: runtimeHeap.backingStorageSize ?? null,
      },
      performanceMemory: pageMemory,
      performanceMetrics: selectedMetrics,
      domCounters,
    };
  };

  const countRequests = () => {
    const sameOrigin = events.requests;
    const chunkRequests = sameOrigin.filter((item) =>
      /\/maps\/chunks\/chunk\d+\.json(?:\?|$)/.test(item.url),
    );
    const masterRequests = sameOrigin.filter((item) =>
      /\/maps\/chunks\/master\.json(?:\?|$)/.test(item.url),
    );
    return {
      totalEvents: sameOrigin.length,
      uniqueUrls: new Set(sameOrigin.map((item) => item.url)).size,
      chunkEvents: chunkRequests.length,
      uniqueChunkUrls: new Set(chunkRequests.map((item) => item.url)).size,
      masterEvents: masterRequests.length,
      uniqueMasterUrls: new Set(masterRequests.map((item) => item.url)).size,
      assetEvents: sameOrigin.filter((item) =>
        /\/(?:maps|sprites|vendor)\//.test(item.url),
      ).length,
    };
  };

  const waitUntilReady = async () => {
    const started = Date.now();
    while (Date.now() - started < settleTimeoutMs) {
      try {
        const current = await snapshot();
        if (
          current.debug?.state !== undefined &&
          current.canvas !== null
        ) {
          return current;
        }
      } catch {
        // The scene is still starting.
      }
      await sleep(250);
    }
    throw new Error("campus debug state did not become ready");
  };

  const settle = async () => {
    const started = Date.now();
    let previousSignature = "";
    let stableCount = 0;
    let current = await snapshot();
    while (Date.now() - started < settleTimeoutMs) {
      current = await snapshot();
      const state = current.debug?.state;
      const signature = JSON.stringify({
        targets: sortedKeys(state?.targets),
        rendered: sortedKeys(state?.rendered),
        requesting: sortedKeys(state?.requesting),
        failed: state?.failed ?? [],
        camera: current.camera
          ? {
              scrollX: Math.round(current.camera.scrollX * 100) / 100,
              scrollY: Math.round(current.camera.scrollY * 100) / 100,
              width: current.camera.width,
              height: current.camera.height,
              zoom: current.camera.zoom,
            }
          : null,
      });
      const renderedKeys = sortedKeys(state?.rendered);
      const targetKeys = sortedKeys(state?.targets);
      const expectedKeys =
        current.camera !== null && current.debug?.player !== undefined
          ? expectedTargetKeys(current.debug.player, current.camera)
          : [];
      const settled =
        state !== undefined &&
        state.requesting.length === 0 &&
        state.failed.length === 0 &&
        sameKeys(targetKeys, expectedKeys) &&
        sameKeys(renderedKeys, targetKeys);
      if (settled && signature === previousSignature) {
        stableCount += 1;
      } else {
        stableCount = 0;
      }
      previousSignature = signature;
      if (stableCount >= 2) {
        return {
          snapshot: current,
          stable: true,
          elapsedMs: Date.now() - started,
        };
      }
      await sleep(250);
    }
    return {
      snapshot: current,
      stable: false,
      elapsedMs: Date.now() - started,
    };
  };

  try {
    await command("Runtime.enable");
    await command("Log.enable");
    await command("Network.enable");
    await command("Page.enable");
    await command("Performance.enable");
    await command("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        let phaserValue;
        const wrapPhaser = (value) => {
          if (!value?.Game || value.Game.__perfWrapped) return value;
          const OriginalGame = value.Game;
          function WrappedGame(...args) {
            const instance = Reflect.construct(
              OriginalGame,
              args,
              new.target,
            );
            window.__capturedPhaserGame = instance;
            return instance;
          }
          WrappedGame.prototype = OriginalGame.prototype;
          Object.setPrototypeOf(WrappedGame, OriginalGame);
          Object.defineProperty(WrappedGame, "__perfWrapped", {
            value: true,
          });
          value.Game = WrappedGame;
          return value;
        };
        Object.defineProperty(window, "Phaser", {
          configurable: true,
          get: () => phaserValue,
          set: (value) => {
            phaserValue = wrapPhaser(value);
          },
        });
      })();`,
    });
    await command("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    await command("Page.navigate", { url });
    await clickPlay(command, evaluate, settleTimeoutMs);
    await sleep(initialWaitMs);
    const ready = await waitUntilReady();
    if (ready.camera === null) {
      console.error(
        `[${viewport.name}] camera probe: ${JSON.stringify(ready)}`,
      );
      throw new Error("camera probe unavailable");
    }
    const initialRequestCounts = countRequests();
    const cases = [];

    for (const zoom of [testZoom]) {
      for (const position of positions) {
        await evaluate(`(() => {
          const game =
            window.__capturedPhaserGame ?? window.Phaser?.GAMES?.[0];
          const scene = game?.scene?.getScene?.("campus");
          if (!scene || !window.__campusCollisionTest) {
            throw new Error("performance hooks unavailable");
          }
          scene.cameras.main.setZoom(${zoom});
          window.__campusCollisionTest.setPlayerPosition(${position.x}, ${position.y});
          return true;
        })()`);
        const settled = await settle();
        const current = settled.snapshot;
        const debug = current.debug;
        const state = debug?.state;
        const player = debug?.player ?? { x: position.x, y: position.y };
        const camera = current.camera;
        const targetKeys = sortedKeys(state?.targets);
        const expectedKeys =
          camera === null ? [] : expectedTargetKeys(player, camera);
        const cachedKeys = sortedKeys(state?.cached);
        const renderedKeys = sortedKeys(state?.rendered);
        const beforeCounts = countRequests();
        const fps = await frameSample();
        const afterCounts = countRequests();
        const memory = await heapSample();
        const previousCase = cases.at(-1);
        const uniqueFailures = [...new Set(events.failures.map((item) => item.url))];
        cases.push({
          viewport: viewport.name,
          viewportPx: { width: viewport.width, height: viewport.height },
          zoom,
          position: { name: position.name, requestedX: position.x, requestedY: position.y },
          observedPlayer: player,
          camera,
          canvas: current.canvas,
          targetKeys,
          expectedTargetKeys: expectedKeys,
          targetCount: targetKeys.length,
          expectedTargetCount: expectedKeys.length,
          targetMatchesExpected: sameKeys(targetKeys, expectedKeys),
          cachedKeys,
          renderedKeys,
          requestingKeys: sortedKeys(state?.requesting),
          failed: state?.failed ?? [],
          cacheContainsTargets: subsetKeys(targetKeys, cachedKeys),
          renderedContainsOnlyCached: subsetKeys(renderedKeys, cachedKeys),
          renderedEqualsTargets: sameKeys(renderedKeys, targetKeys),
          rendererLayers: debug?.rendererLayers ?? null,
          collisionLayers: debug?.collisionLayers ?? null,
          markerRecords: debug?.markerRecords ?? null,
          particles3Diagnostics: debug?.particles3Diagnostics ?? null,
          display: current.display,
          fps: {
            raf: fps,
            phaserAfterSample: (await snapshot()).phaser,
          },
          memory,
          requests: {
            beforeSample: beforeCounts,
            afterSample: afterCounts,
            deltaFromPreviousCase: {
              totalEvents: afterCounts.totalEvents - (previousCase?.requests.afterSample.totalEvents ?? initialRequestCounts.totalEvents),
              chunkEvents: afterCounts.chunkEvents - (previousCase?.requests.afterSample.chunkEvents ?? initialRequestCounts.chunkEvents),
            },
            failedUrls: uniqueFailures,
          },
          settle: settled,
          runtimeExceptions: [...events.exceptions],
          diagnosticsText: current.diagnostics,
        });
        console.error(
          `[${viewport.name} zoom=${zoom} ${position.name}] ` +
            `target=${targetKeys.length}/${expectedKeys.length} ` +
            `cache=${cachedKeys.length} render=${renderedKeys.length} ` +
            `layers=${debug?.rendererLayers ?? "?"} ` +
            `fps=${fps.rafFps?.toFixed(1) ?? "?"} ` +
            `heap=${memory.runtimeHeap.usedSize ?? "?"} ` +
            `requests=${afterCounts.chunkEvents} ` +
            `match=${sameKeys(targetKeys, expectedKeys) && sameKeys(renderedKeys, targetKeys)}`,
        );
      }
    }

    return {
      viewport,
      zoom: testZoom,
      url,
      initial: {
        snapshot: ready,
        requestCounts: initialRequestCounts,
      },
      cases,
      events: {
        sameOriginRequestCount: events.requests.length,
        sameOriginResponseCount: events.responses.length,
        failures: events.failures,
        exceptions: events.exceptions,
      },
    };
  } finally {
    try {
      await command("Target.closeTarget", { targetId: target.id });
    } catch {
      // The target may already be closed.
    }
    ws.close();
  }
}

const allResults = [];
for (const viewport of viewports) {
  for (const zoom of zooms) {
    const query = new URLSearchParams({
      "collision-test": "1",
      "perf-baseline": `${viewport.name}-${zoom}-${Date.now()}`,
    });
    const url = `${appBase}/?${query.toString()}`;
    try {
      const result = await inspectTarget(
        await createTarget("about:blank"),
        viewport,
        url,
        zoom,
      );
      allResults.push(result);
    } catch (error) {
      allResults.push({
        viewport,
        zoom,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[${viewport.name} zoom=${zoom}] ERROR ${error}`);
    }
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  appBase,
  cdpBase,
  geometry: {
    chunkTiles: "28x28",
    grid: "5x5",
    tilePixels: "16x16",
    worldPixels: "2240x2240",
  },
  sampling: {
    initialWaitMs,
    settleTimeoutMs,
    frameSampleMs,
    viewports,
    zooms,
    positions,
    note: "Observed baseline only; no final performance threshold is inferred.",
  },
  results: allResults,
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

const summary = [];
for (const result of allResults) {
  if (result.error !== undefined) {
    summary.push({ viewport: result.viewport.name, error: result.error });
    continue;
  }
  for (const item of result.cases) {
    summary.push({
      viewport: item.viewport,
      size: `${item.viewportPx.width}x${item.viewportPx.height}`,
      zoom: item.zoom,
      position: item.position.name,
      player: `${Math.round(item.observedPlayer.x)},${Math.round(item.observedPlayer.y)}`,
      camera: item.camera
        ? `${item.camera.scrollX.toFixed(1)},${item.camera.scrollY.toFixed(1)} ${item.camera.width}x${item.camera.height} z=${item.camera.zoom}`
        : null,
      target: `${item.targetCount}/${item.expectedTargetCount}`,
      cache: item.cachedKeys.length,
      rendered: item.renderedKeys.length,
      requesting: item.requestingKeys.length,
      layers: item.rendererLayers,
      fps: item.fps.raf.rafFps === null ? null : Number(item.fps.raf.rafFps.toFixed(1)),
      heap: item.memory.runtimeHeap.usedSize,
      chunkRequests: item.requests.afterSample.chunkEvents,
      deltaChunks: item.requests.deltaFromPreviousCase.chunkEvents,
      targetMatch: item.targetMatchesExpected,
      renderMatch: item.renderedEqualsTargets,
      stable: item.settle.stable,
    });
  }
}
console.log(JSON.stringify({ outputPath, summary }, null, 2));

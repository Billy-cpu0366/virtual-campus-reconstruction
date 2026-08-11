const fs = require("node:fs/promises");
const path = require("node:path");

const defaultPuppeteer =
  "C:/Users/inertnet/maobu-resume/node_modules/.pnpm/" +
  "puppeteer@24.15.0_typescript@5.8.3/node_modules/puppeteer";
const puppeteer = require(process.env.PUPPETEER_MODULE || defaultPuppeteer);

const ORIGIN = "https://peteroravec.com/";
const CHROME = process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(
  "sample/analysis/layer-visual-evidence"
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const points = {
  spawn: { x: 1088, y: 304 },
  upperClear: { x: 1096, y: 1192 },
  upperLayer8: { x: 1096, y: 1208 },
  factoryRoof: { x: 360, y: 904 },
  bridgeApproach: { x: 1416, y: 952 },
  bridgeExitApproach: { x: 1784, y: 952 },
  particles3: { x: 1816, y: 1176 },
  footstepsStart: { x: 216, y: 1832 },
};

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  });

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      pageErrors.push(`console: ${message.text()}`);
    }
  });

  let hookMatches = 0;
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    try {
      if (request.url().includes("main-RV3Z53H4.js")) {
        const response = await fetch(request.url());
        let source = await response.text();
        const anchor =
          "this.game=new Phaser.Game(c),this.resizeGame()";
        hookMatches = source.split(anchor).length - 1;
        source = source.replace(
          anchor,
          "this.game=new Phaser.Game(c)," +
            "window.__poGame=this.game," +
            "window.__poGameScene=this.gameScene," +
            "this.resizeGame()"
        );
        await request.respond({
          status: 200,
          contentType: "application/javascript",
          headers: { "cache-control": "no-store" },
          body: source,
        });
        return;
      }
      await request.continue();
    } catch (error) {
      pageErrors.push(`intercept: ${String(error)}`);
      try {
        await request.continue();
      } catch {}
    }
  });

  const response = await page.goto(ORIGIN, {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await page.click("button.btn-play");
  await page.waitForFunction(
    () => Boolean(window.__poGameScene?.player),
    { timeout: 60000 }
  );

  let introComplete = false;
  try {
    await page.waitForFunction(
      () => window.__poGameScene?.isPlayerIntroComplete === true,
      { timeout: 90000 }
    );
    introComplete = true;
  } catch {
    pageErrors.push("intro did not complete within 90 seconds");
  }

  const records = [];
  const canvas = await page.$("canvas");
  if (!canvas) throw new Error("game canvas not found");

  async function warp(point) {
    await page.evaluate(({ x, y }) => {
      const scene = window.__poGameScene;
      const player = scene.player;
      player.setPosition(x, y);
      if (player.body?.reset) player.body.reset(x, y);
      scene.cameras?.main?.centerOn(x, y);
    }, point);
    await sleep(900);
  }

  async function snapshot(scenario, phase, fileName) {
    const state = await page.evaluate(({ scenario, phase }) => {
      const scene = window.__poGameScene;
      const player = scene?.player;
      const layer = (name) => {
        const tilemapLayer = scene?.tilemap?.getLayer(name)?.tilemapLayer;
        if (!tilemapLayer) return null;
        let collidingTiles = 0;
        tilemapLayer.forEachTile?.((tile) => {
          if (tile?.index !== -1 && tile?.collides) collidingTiles += 1;
        });
        return {
          name,
          visible: tilemapLayer.visible,
          alpha: tilemapLayer.alpha,
          depth: tilemapLayer.depth,
          collidingTiles,
        };
      };
      const depth450All = (scene?.children?.list || [])
        .filter((child) => child?.depth === 450)
        .map((child) => ({
          type: child.constructor?.name,
          texture: child.texture?.key || null,
          x: child.x,
          y: child.y,
          alpha: child.alpha,
          active: child.active,
        }));
      const depth450 = depth450All.filter((child) => child.active);
      const mapNames = (scene?.tilemap?.layers || []).map((x) => x.name);
      const regions = (scene?.particleRegions || []).map((region) => {
        const outline = region.outline || [];
        const xs = outline.map((point) => point.x);
        const ys = outline.map((point) => point.y);
        const bbox = xs.length ? {
          minX: Math.min(...xs), maxX: Math.max(...xs),
          minY: Math.min(...ys), maxY: Math.max(...ys),
        } : null;
        return {
          id: region.id || null,
          type: region.type || null,
          tileCount: region.tileCount,
          depth: region.depth,
          bbox,
          playerInBbox: Boolean(bbox && player &&
            player.x >= bbox.minX && player.x <= bbox.maxX &&
            player.y >= bbox.minY && player.y <= bbox.maxY),
        };
      });
      const areaEmitters = scene?.areaParticleEmitters;
      const emitterEntries = areaEmitters instanceof Map
        ? [...areaEmitters.entries()]
        : Object.entries(areaEmitters || {});
      const areaEmitterStates = emitterEntries.map(([key, value]) => {
        const emitter = value?.emitter || value;
        return {
          key: typeof key === "string" ? key : key?.id || String(key),
          type: value?.type || key?.type || null,
          active: emitter?.active,
          emitting: emitter?.emitting,
          visible: emitter?.visible,
          x: emitter?.x,
          y: emitter?.y,
          alive: emitter?.getAliveParticleCount?.(),
        };
      }).filter((emitter) => emitter.emitting || emitter.alive > 0);
      return {
        scenario,
        phase,
        capturedAt: new Date().toISOString(),
        probeAssisted: true,
        player: player && {
          x: player.x,
          y: player.y,
          depth: player.depth,
          velocityX: player.body?.velocity?.x,
          velocityY: player.body?.velocity?.y,
          active: player.active,
        },
        camera: scene?.cameras?.main && {
          scrollX: scene.cameras.main.scrollX,
          scrollY: scene.cameras.main.scrollY,
          zoom: scene.cameras.main.zoom,
        },
        introComplete: scene?.isPlayerIntroComplete,
        layers: [
          "layer5", "layer6", "layer7", "layer8", "layer9",
          "layer10", "roof_factory", "roof_factory2",
          "roof_concert", "roof_concert2",
          "bridge1_down_wall", "bridge1_up_wall",
          "bridge2_down_wall", "bridge2_up_wall",
          "particles", "particles2", "particles3", "footsteps",
        ].map(layer),
        bridgeState: {
          bridge1Down: scene?.isBridge1DownVisible,
          bridge2Down: scene?.isBridge2DownVisible,
        },
        mapHasParticles3: mapNames.includes("particles3"),
        mapHasFootsteps: mapNames.includes("footsteps"),
        particleEmitterCount: Array.isArray(scene?.particleEmitters)
          ? scene.particleEmitters.length
          : Object.keys(scene?.particleEmitters || {}).length,
        areaParticleEmitterCount: emitterEntries.length,
        activeAreaEmitterStates: areaEmitterStates,
        particleRegionCount: regions.length,
        playerRegions: regions.filter((region) => region.playerInBbox),
        depth450PoolCount: depth450All.length,
        depth450,
      };
    }, { scenario, phase });
    await canvas.screenshot({ path: path.join(OUT, fileName) });
    records.push({ ...state, screenshot: fileName });
    return state;
  }

  await warp(points.upperClear);
  await snapshot("upper-layer-occlusion", "before", "01-upper-before.png");
  await warp(points.upperLayer8);
  await snapshot("upper-layer-occlusion", "inside", "02-upper-inside.png");
  await warp(points.upperClear);
  await snapshot("upper-layer-occlusion", "after", "03-upper-after.png");

  await warp(points.spawn);
  await snapshot("factory-roof", "before", "04-roof-before.png");
  await warp(points.factoryRoof);
  await snapshot("factory-roof", "inside", "05-roof-inside.png");
  await warp(points.spawn);
  await snapshot("factory-roof", "after", "06-roof-after.png");

  await warp(points.bridgeApproach);
  await snapshot("bridge1", "before", "07-bridge-before.png");
  let bridgeUpObserved = false;
  await page.keyboard.down("ArrowRight");
  try {
    await page.waitForFunction(
      () => window.__poGameScene?.isBridge1DownVisible === false,
      { timeout: 5000 }
    );
    bridgeUpObserved = true;
  } catch {
    pageErrors.push("bridge1 up state not observed from entry zone");
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await sleep(400);
  await snapshot("bridge1", "entry", "08-bridge-entry.png");
  await warp(points.bridgeExitApproach);
  await snapshot("bridge1", "middle", "09-bridge-middle.png");
  let bridgeDownRestored = false;
  await page.keyboard.down("ArrowRight");
  try {
    await page.waitForFunction(
      () => window.__poGameScene?.isBridge1DownVisible === true,
      { timeout: 5000 }
    );
    bridgeDownRestored = true;
  } catch {
    pageErrors.push("bridge1 down state not restored from exit zone");
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await sleep(400);
  await snapshot("bridge1", "exit", "10-bridge-exit.png");

  await warp(points.particles3);
  await snapshot("particles3", "at-marker", "11-particles3.png");

  await warp(points.footstepsStart);
  const footBefore = await snapshot(
    "footsteps", "before-move", "12-footsteps-before.png"
  );
  await page.keyboard.down("ArrowRight");
  await sleep(1800);
  await page.keyboard.up("ArrowRight");
  await sleep(500);
  const footAfter = await snapshot(
    "footsteps", "after-move", "13-footsteps-after.png"
  );

  const manifest = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    origin: ORIGIN,
    httpStatus: response?.status(),
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    browser: await browser.version(),
    hook: {
      purpose: "Expose existing Angular-owned Phaser game and scene only",
      mainBundleAnchorMatches: hookMatches,
      changesPersistentFilesOnOrigin: false,
    },
    method: {
      probeAssisted: true,
      positionWarp: "player.setPosition + body.reset; no persistent origin change",
      warning:
        "Warp-assisted state is evidence of behavior at a coordinate, not natural path timing.",
    },
    introComplete,
    points,
    records,
    scenarioResults: {
      bridgeUpObserved,
      bridgeDownRestored,
    },
    footstepsDelta: {
      beforeActive: footBefore.depth450.filter((item) =>
        item.texture === "footprint" && item.active
      ).length,
      afterActive: footAfter.depth450.filter((item) =>
        item.texture === "footprint" && item.active
      ).length,
    },
    pageErrors,
  };
  await fs.writeFile(
    path.join(OUT, "observations.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await browser.close();
  console.log(JSON.stringify({
    output: OUT,
    records: records.length,
    introComplete,
    hookMatches,
    footstepsDelta: manifest.footstepsDelta,
    pageErrors: pageErrors.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

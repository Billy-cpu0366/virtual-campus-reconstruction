import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const url = process.env.NPC_VISUAL_AUDIT_URL ?? process.argv[2] ??
  "http://127.0.0.1:4175/";
const out = process.env.NPC_VISUAL_AUDIT_OUT ?? "/tmp/npc-visual-targeted.json";
const screens = process.env.NPC_VISUAL_AUDIT_SCREENS ?? "/tmp/npc-visual-targeted-screens";
const PROTESTER_SLOGANS = [
  "People, not machines!",
  "Jobs for humans!",
  "Human > machine",
];
function sleep(ms) {
  const remaining = auditDeadline - Date.now();
  if (remaining <= 0) return Promise.reject(new AuditTimeoutError("overall audit"));
  return withTimeout(new Promise((resolve) => setTimeout(resolve, ms)),
    Math.min(ms, remaining), "overall audit");
}
let socket;
let nextId = 0;
let gamesObjectId;
const pending = new Map();
const events = { console: [], exceptions: [], failedRequests: [], badResponses: [] };
const TOTAL_TIMEOUT_MS = Number(
  process.env.NPC_VISUAL_AUDIT_TIMEOUT_MS ?? 30_000,
);
const CDP_TIMEOUT_MS = Number(
  process.env.NPC_VISUAL_AUDIT_CDP_TIMEOUT_MS ?? 5_000,
);
const auditStartedAt = Date.now();
const auditDeadline = auditStartedAt + TOTAL_TIMEOUT_MS;
let phase = "initializing";
let phaseStartedAt = auditStartedAt;
let phaseProgress = "starting";
let heartbeat;
let watchdog;
let activeTargetId;

class AuditTimeoutError extends Error {
  constructor(label) {
    super(`audit timeout: ${label}`);
    this.name = "AuditTimeoutError";
  }
}

function setPhase(name, progress = name) {
  phase = name;
  phaseStartedAt = Date.now();
  phaseProgress = progress;
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AuditTimeoutError(label)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function command(method, params = {}, options = {}) {
  const remaining = auditDeadline - Date.now();
  if (!options.ignoreDeadline && remaining <= 0) {
    return Promise.reject(new AuditTimeoutError("overall audit"));
  }
  const timeoutMs = Math.min(
    options.timeoutMs ?? CDP_TIMEOUT_MS,
    options.ignoreDeadline ? (options.timeoutMs ?? CDP_TIMEOUT_MS) : remaining,
  );
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  const request = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  return withTimeout(request, Math.max(1, timeoutMs), `CDP ${method}`)
    .catch((error) => {
      pending.delete(id);
      throw error;
    });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exception?.description ?? result.text ?? "Runtime error");
  }
  return result.result?.value;
}
async function sceneCall(functionDeclaration, options = {}) {
  const result = await command("Runtime.callFunctionOn", {
    objectId: gamesObjectId,
    functionDeclaration,
    returnByValue: true,
    awaitPromise: true,
  }, options);
  if (result.exceptionDetails) {
    throw new Error(result.exception?.description ?? result.text ?? "Scene error");
  }
  return result.result?.value;
}
async function waitFor(expression, predicate, label, timeout = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await evaluate(expression);
    if (predicate(value)) return value;
    await sleep(50);
  }
  throw new Error(`timeout: ${label}`);
}
async function waitForScene(functionDeclaration, predicate, label, timeout = 5_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await sceneCall(functionDeclaration);
    if (predicate(value)) return value;
    await sleep(50);
  }
  throw new Error(`timeout: ${label}`);
}
async function waitForCameraCenter(x, y) {
  return waitForScene(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const view = scene?.cameras?.main?.worldView;
      if (!view) continue;
      return { x: view.x, y: view.y, width: view.width, height: view.height };
    }
    return null;
  }`, (view) => view !== null &&
    Math.abs(view.x + view.width / 2 - x) < 2 &&
    Math.abs(view.y + view.height / 2 - y) < 2, `camera center ${x},${y}`);
}
async function snapshot() {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const camera = scene?.cameras?.main;
      const view = camera?.worldView;
      if (!scene || !camera || !view) continue;
      const audit = globalThis.__npcVisualAudit ??=
        { nextId: 0, identities: new WeakMap() };
      const identity = (object) => {
        if (!object || typeof object !== "object") return null;
        let id = audit.identities.get(object);
        if (id === undefined) {
          id = "sprite-" + (++audit.nextId);
          audit.identities.set(object, id);
        }
        return id;
      };
      const capture = (runtime, halfSize) => [...(runtime?.sprites ?? new Map())]
        .filter(([, sprite]) =>
          sprite.x + halfSize >= view.x && sprite.x - halfSize <= view.x + view.width &&
          sprite.y + halfSize >= view.y && sprite.y - halfSize <= view.y + view.height)
        .map(([id, sprite]) => ({
          id: String(id), identity: identity(sprite), x: sprite.x, y: sprite.y,
          alpha: sprite.alpha, visible: sprite.visible, active: sprite.active,
          texture: sprite.texture?.key ?? null,
          frame: sprite.frame ? {
            name: sprite.frame.name, width: sprite.frame.width, height: sprite.frame.height,
            cutWidth: sprite.frame.cutWidth, cutHeight: sprite.frame.cutHeight,
          } : null,
          displayWidth: sprite.displayWidth, displayHeight: sprite.displayHeight,
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
      return {
        time: scene.time.now,
        view: { x: view.x, y: view.y, width: view.width, height: view.height },
        venue: capture(scene.venueCrowdRuntime, 32),
        route: capture(scene.routeCrowdRuntime, 24),
        static: capture(scene.staticCrowdRuntime, 24),
        bug: capture(scene.bugCrowdRuntime, 20),
        venueSpeech: scene.venueCrowdRuntime?.protestSpeechSnapshot ?? [],
        vehicle: scene.vehicleRuntime?.snapshot ?? null,
        vehicleCollisionCount: scene.vehicleColliders?.size ?? null,
        routeInstances: scene.routeCrowdRuntime?.snapshot?.instances ?? [],
        staticInstances: scene.staticCrowdRuntime?.snapshot?.instances ?? [],
      };
    }
    return null;
  }`);
}
async function center(x, y) {
  return sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.cameras?.main) continue;
      scene.cameras.main.stopFollow?.();
      scene.cameras.main.centerOn(${x}, ${y});
      return true;
    }
    return false;
  }`);
}
async function probePoliceCollision() {
  const setup = await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const car = scene?.vehicleRuntime?.policeCollisionTargets?.[0];
      if (!scene?.player || !car) continue;
      scene.cameras.main.stopFollow?.();
      scene.player.setPosition(car.x - 100, car.y);
      scene.player.setVelocity(0, 0);
      return { carX: car.x, carY: car.y, startX: scene.player.x };
    }
    return null;
  }`);
  assert.ok(setup, "police collision setup unavailable");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))");
  await sleep(800);
  await evaluate("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))");
  const result = await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const car = scene?.vehicleRuntime?.policeCollisionTargets?.[0];
      if (!scene?.player || !car) continue;
      return {
        carX: car.x, carY: car.y, startX: ${setup.startX},
        endX: scene.player.x, blockedRight: scene.player.body?.blocked?.right ?? false,
      };
    }
    return null;
  }`);
  await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.player) continue;
      scene.player.setPosition(1088, 304);
      scene.player.setVelocity(0, 0);
      return true;
    }
    return false;
  }`);
  assert.ok(result, "police collision result unavailable");
  assert.equal(result.blockedRight, true,
    `player was not blocked by police car: ${JSON.stringify(result)}`);
  assert.ok(result.endX < result.carX,
    `player crossed police car: ${JSON.stringify(result)}`);
  return result;
}
async function probeConcertParty() {
  assert.equal(await center(1_900, 632), true);
  await waitForCameraCenter(1_900, 632);
  const setRoofPosition = (x, y) => sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.player) continue;
      scene.player.setPosition(${x}, ${y});
      scene.updateConcertRoof?.();
      return scene.worldRenderer?.getRoofState?.("concert") ?? null;
    }
    return null;
  }`);
  const bottomOutside = await setRoofPosition(1_900, 900);
  const bottomInside = await setRoofPosition(1_900, 700);
  const sideOutside = await setRoofPosition(1_550, 632);
  const sideInside = await setRoofPosition(1_700, 632);
  await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene) continue;
      scene.player.setPosition(1_900, 632);
      scene.updateConcertRoof?.();
      scene.concertLightingRuntime?.update?.(
        scene.time.now,
        scene.cameras.main.worldView,
      );
      scene.venueCrowdRuntime?.update?.();
      return true;
    }
    return false;
  }`);
  await sleep(2_000);
  const party = await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene) continue;
      return {
        lighting: scene.concertLightingRuntime?.snapshot ?? null,
        concertActions: scene.venueCrowdRuntime?.concertActionSnapshot ?? [],
        roof: scene.worldRenderer?.getRoofState?.("concert") ?? null,
      };
    }
    return null;
  }`);
  assert.deepEqual(bottomOutside?.state, "visible");
  assert.deepEqual(bottomInside?.state, "faded");
  assert.deepEqual(sideOutside?.state, "visible");
  assert.deepEqual(sideInside?.state, "faded");
  assert.ok(party?.lighting?.active, "concert lighting is not active in the room");
  assert.deepEqual(party?.lighting?.objectCount, 11);
  assert.deepEqual(party?.lighting?.spotlightCount, 2);
  assert.deepEqual(party?.lighting?.colorLightCount, 2);
  assert.deepEqual(party?.lighting?.laserCount, 6);
  assert.ok((party?.concertActions ?? []).some((state) => state.actionCount > 0),
    "concert NPC actions did not advance");
  const partyScreen = await capture("party-room");
  const barrierStart = await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.player) continue;
      scene.player.setPosition(1_640, 632);
      scene.player.setVelocity(0, 0);
      scene.heldMovementKeys?.add?.("right");
      return { x: scene.player.x, y: scene.player.y };
    }
    return null;
  }`);
  await sleep(2_500);
  const barrier = await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.player) continue;
      return {
        x: scene.player.x,
        y: scene.player.y,
        velocityX: scene.player.body?.velocity?.x ?? null,
      };
    }
    return null;
  }`);
  await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene) continue;
      scene.heldMovementKeys?.delete?.("right");
      scene.player?.setVelocity?.(0, 0);
      return true;
    }
    return false;
  }`);
  assert.ok(barrierStart, "party barrier setup unavailable");
  assert.ok(barrier?.x < 1_900,
    `left party barrier was crossed: ${JSON.stringify(barrier)}`);
  return { bottomOutside, bottomInside, sideOutside, sideInside, party, partyScreen, barrierStart, barrier };
}

async function probeBugArea() {
  assert.equal(await center(240, 2_096), true);
  await waitForCameraCenter(240, 2_096);
  await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.player) continue;
      document.getElementById("content-close")?.click();
      scene.player.setPosition(240, 2_096);
      scene.stopPlayerMovement?.();
      return true;
    }
    return false;
  }`);
  await sleep(300);
  const bug = (await snapshot()).bug;
  const bugScreen = await capture("bug-area");
  assert.ok(bug.length > 0, "bug area has no visible NPCs");
  assert.ok(bug.every((item) => item.frame?.width === 38 &&
    item.frame?.height === 38 && item.frame?.cutWidth === 38 &&
    item.frame?.cutHeight === 38), "bug frame geometry drifted");
  assert.ok(bug.every((item) => Math.abs(item.displayWidth - 38 * 0.63) < 0.1 &&
    Math.abs(item.displayHeight - 38 * 0.63) < 0.1),
  "bug display scale drifted");
  return { sampleCount: bug.length, bugScreen };
}

async function capture(name, options = {}) {
  mkdirSync(screens, { recursive: true });
  const image = await command("Page.captureScreenshot", { format: "png" }, options);
  const path = join(screens, `${name}.png`);
  writeFileSync(path, Buffer.from(image.data, "base64"));
  return path;
}
function minCrossRegionDistance(instances) {
  const byRegion = new Map();
  for (const item of instances) {
    const list = byRegion.get(item.regionIndex) ?? [];
    list.push(item.position);
    byRegion.set(item.regionIndex, list);
  }
  const first = byRegion.get(38) ?? [];
  const second = byRegion.get(61) ?? [];
  let minimum = Infinity;
  for (const left of first) for (const right of second) {
    minimum = Math.min(minimum, Math.hypot(left.x - right.x, left.y - right.y));
  }
  return { minimum, count38: first.length, count61: second.length };
}
function assertIdentityContinuity(samples, owner) {
  let prior = new Map();
  for (const [index, sample] of samples.entries()) {
    const current = new Map();
    for (const item of sample[owner]) {
      const old = prior.get(item.id);
      if (old !== undefined) {
        assert.equal(item.identity, old, `${owner}:${item.id} identity changed at ${index}`);
      }
      assert.equal(item.visible, true, `${owner}:${item.id} invisible in viewport`);
      assert.equal(item.alpha, 1, `${owner}:${item.id} alpha changed in viewport`);
      current.set(item.id, item.identity);
    }
    prior = current;
  }
}

async function collectTimeoutEvidence(error) {
  phaseProgress = "timeout; pausing page and collecting evidence";
  let paused = false;
  let screenshot;
  if (socket?.readyState === 1 && gamesObjectId !== undefined) {
    try {
      paused = await sceneCall(`function () {
        for (const game of this) {
          const scene = game?.scene?.getScene?.("campus");
          if (!scene) continue;
          scene.scene.pause?.();
          return true;
        }
        return false;
      }`, { ignoreDeadline: true, timeoutMs: 1_000 });
    } catch {}
    try {
      screenshot = await capture("timeout", { ignoreDeadline: true, timeoutMs: 1_000 });
    } catch {}
  }
  const record = {
    passed: false,
    status: "TIMEOUT",
    error: String(error),
    phase,
    phaseProgress,
    phaseElapsedMs: Date.now() - phaseStartedAt,
    totalElapsedMs: Date.now() - auditStartedAt,
    timeoutMs: TOTAL_TIMEOUT_MS,
    paused,
    screenshot,
    events,
  };
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\\n`);
  console.error(JSON.stringify(record));
}

try {
  heartbeat = setInterval(() => {
    console.log(`[audit] phase=${phase} phaseMs=${Date.now() - phaseStartedAt} totalMs=${Date.now() - auditStartedAt} progress=${phaseProgress}`);
  }, 2_000);
  watchdog = setTimeout(() => {
    phaseProgress = "deadline reached; collecting timeout evidence";
    console.error(`[audit] watchdog deadline reached in phase=${phase}`);
  }, TOTAL_TIMEOUT_MS);
  setPhase("connect");
  const response = await fetch(`${cdpBase}/json/new?about:blank`, { method: "PUT" });
  assert.ok(response.ok, `CDP target: ${response.status}`);
  const target = await response.json();
  activeTargetId = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.consoleAPICalled" &&
        ["error", "warning"].includes(message.params.type)) {
      events.console.push(message.params.args?.map((arg) => arg.value ?? arg.description));
    }
    if (message.method === "Runtime.exceptionThrown") {
      events.exceptions.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text);
    }
    if (message.method === "Network.loadingFailed") {
      events.failedRequests.push({ url: message.params.url, errorText: message.params.errorText });
    }
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400 &&
        !message.params.response.url.endsWith("/favicon.ico")) {
      events.badResponses.push({ url: message.params.response.url, status: message.params.response.status });
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result ?? {});
  });
  setPhase("load", "enabling CDP and navigating");
  await Promise.all([command("Runtime.enable"), command("Page.enable"), command("Network.enable")]);
  await command("Page.navigate", { url });
  await waitFor("document.body?.dataset.appState", (state) => state === "READY", "READY");
  const proto = await command("Runtime.evaluate", { expression: "Phaser.Game.prototype" });
  const objects = await command("Runtime.queryObjects", { prototypeObjectId: proto.result.objectId });
  gamesObjectId = objects.objects.objectId;
  await evaluate("document.querySelector('#app-play')?.click()");
  setPhase("play", "waiting for PLAYING and crowd owners");
  await waitFor("document.body?.dataset.appState", (state) => state === "PLAYING", "PLAYING", 20_000);
  await waitForScene(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene) continue;
      return {
        routeStarted: scene.routeCrowdRuntime?.started ?? false,
        venueSprites: scene.venueCrowdRuntime?.spriteCount ?? 0,
      };
    }
    return null;
  }`, (value) => value !== null && value.routeStarted && value.venueSprites > 0,
  "crowd owners ready", 10_000);

  setPhase("stop-ai", "centering and sampling 50 frames");
  assert.equal(await center(1800, 1200), true);
  await waitForCameraCenter(1800, 1200);
  await waitForScene(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      const view = scene?.cameras?.main?.worldView;
      const sprites = [...(scene?.venueCrowdRuntime?.sprites ?? new Map())];
      if (!view) continue;
      return {
        view: { x: view.x, y: view.y, width: view.width, height: view.height },
        protesters: sprites.filter(([, sprite]) => sprite.texture?.key === "npc_protester_rising").length,
      };
    }
    return null;
  }`, (value) => value !== null && value.protesters > 0,
  "Stop AI venue ready", 5_000);
  const stopBefore = await snapshot();
  const stopBeforeScreen = await capture("stop-ai-before");
  const stopSamples = [];
  for (let index = 0; index < 50; index += 1) {
    phaseProgress = `sample ${index + 1}/50`;
    stopSamples.push(await snapshot());
    await sleep(50);
  }
  const stopAfterScreen = await capture("stop-ai-after");
  const protesters = stopSamples.flatMap((sample) => sample.venue);
  assert.ok(protesters.length > 0, "no Stop AI venue sprites in viewport");
  assert.ok(protesters.every((item) => item.texture === "npc_protester_rising"), "wrong Stop AI texture");
  assert.ok(protesters.every((item) => item.frame?.width === 64 && item.frame?.height === 64 &&
    item.frame?.cutWidth === 64 && item.frame?.cutHeight === 64 &&
    item.displayWidth === 64 && item.displayHeight === 64), "Stop AI frame geometry drifted");
  assertIdentityContinuity(stopSamples, "venue");
  const speeches = stopSamples.flatMap((sample) => sample.venueSpeech)
    .filter((speech) => speech.phase === "visible");
  assert.ok(speeches.length > 0, "no Stop AI protest slogan became visible");
  assert.ok(speeches.every((speech) => PROTESTER_SLOGANS.includes(speech.text)),
    "unexpected Stop AI slogan");
  const vehicle = stopBefore.vehicle;
  assert.ok(vehicle?.police?.length === 3, "three police vehicles were not created");
  assert.ok(vehicle.police.every((police) => police.collisionBodyCreated),
    "police collision body missing");
  assert.equal(stopBefore.vehicleCollisionCount, 3,
    "police colliders were not connected to the player");
  assert.equal(stopBefore.staticInstances.filter((item) => item.regionIndex === 64).length, 2,
    "Stop AI background crowd was not reduced to two instances");
  setPhase("police-collision", "driving player into police body");
  const policeCollision = await probePoliceCollision();

  setPhase("coffee-route", "controlled route replay");
  assert.equal(await center(1400, 960), true);
  await waitForCameraCenter(1400, 960);
  await sleep(300);
  const coffeeBefore = await snapshot();
  const coffeeBeforeScreen = await capture("coffee-before");
  phaseProgress = "running 60s logical route replay";
  const routeAudit = await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene?.routeCrowdRuntime?.started) continue;
      scene.scene.pause?.();
      const view = scene.cameras.main.worldView;
      const owners = ["drinkers:", "vertical-crowd:", "vertical-crowd-reverse:"];
      const firstReturning = {};
      const terminalGone = [];
      const identityBreaks = [];
      const identities = new WeakMap();
      let nextIdentity = 0;
      let prior = new Map();
      const samples = [];
      let minimumCombinedSpacing = Infinity;
      let maxRouteCountInScope = 0;
      let maxRouteCountInVisualZone = 0;
      const spacingViolations = [];
      const policeNpcViolations = [];
      const wallViolations = [];
      const startNow = scene.time.now;
      const identity = (sprite) => {
        if (!sprite || typeof sprite !== "object") return null;
        let value = identities.get(sprite);
        if (value === undefined) {
          value = "sprite-" + (++nextIdentity);
          identities.set(sprite, value);
        }
        return value;
      };
      const inView = (point) => point.x >= view.x && point.x <= view.x + view.width &&
        point.y >= view.y && point.y <= view.y + view.height;
      const police = [...(scene.vehicleRuntime?.policeCollisionTargets ?? [])];
      const wallGrid = scene.cache.json.get("walls-layer")?.grid ?? [];
      const nearPolice = (point) => police.some((car) =>
        Math.abs(point.x - car.x) <= 32 + 24 &&
        Math.abs(point.y - car.y) <= 24 + 24);
      const onWall = (point) => wallGrid[Math.floor(point.y / 16)]?.[
        Math.floor(point.x / 16)
      ] === 1;
      for (let elapsed = 0; elapsed <= 60_000; elapsed += 100) {
        scene.routeCrowdRuntime.update(startNow + elapsed);
        scene.bugCrowdRuntime?.update(startNow + elapsed);
        const instances = scene.routeCrowdRuntime.snapshot.instances.filter((item) =>
          owners.some((owner) => item.id.startsWith(owner)));
        for (const item of instances) {
          if (nearPolice(item.position) && policeNpcViolations.length < 20) {
            policeNpcViolations.push({ elapsed, owner: "route", id: item.id, position: item.position });
          }
          if (item.id.startsWith("vertical-crowd-reverse:") &&
            onWall(item.position) && wallViolations.length < 20) {
            wallViolations.push({ elapsed, owner: "route", id: item.id, position: item.position });
          }
        }
        for (const item of scene.bugCrowdRuntime?.snapshot.instances ?? []) {
          if (nearPolice(item.position) && policeNpcViolations.length < 20) {
            policeNpcViolations.push({ elapsed, owner: "bug", id: item.id, position: item.position });
          }
          if (onWall(item.position) && wallViolations.length < 20) {
            wallViolations.push({ elapsed, owner: "bug", id: item.id, position: item.position });
          }
        }
        const inSpacingScope = (point) => point.x >= 1_200 && point.x <= 1_600 &&
          point.y >= 800 && point.y <= 1_080;
        const routePoints = instances.map((item) => {
          const sprite = scene.routeCrowdRuntime.sprites?.get(item.id);
          if (!item.materialized || !item.visible || item.destroyed ||
              sprite?.visible === false) return null;
          const point = sprite === undefined
            ? item.position
            : { x: sprite.x, y: sprite.y };
          return inView(point) && inSpacingScope(point) ? point : null;
        }).filter((point) => point !== null);
        maxRouteCountInScope = Math.max(maxRouteCountInScope, routePoints.length);
        const visualPoints = routePoints;
        maxRouteCountInVisualZone = Math.max(maxRouteCountInVisualZone, visualPoints.length);
        const staticPoints = (scene.staticCrowdRuntime?.snapshot?.instances ?? [])
          .filter((item) => item.regionIndex === 38 || item.regionIndex === 61)
          .map((item) => item.position)
          .filter(inSpacingScope);
        const comparePoints = (left, right, kind) => {
          const distance = Math.hypot(left.x - right.x, left.y - right.y);
          minimumCombinedSpacing = Math.min(minimumCombinedSpacing, distance);
          if (distance < 56) spacingViolations.push({ elapsed, kind, distance, left, right });
        };
        for (let left = 0; left < routePoints.length; left += 1) {
          for (let right = left + 1; right < routePoints.length; right += 1) {
            comparePoints(routePoints[left], routePoints[right], "route-route");
          }
          for (const staticPoint of staticPoints) {
            comparePoints(routePoints[left], staticPoint, "route-static");
          }
        }
        const current = new Map();
        for (const item of instances) {
          const owner = owners.find((prefix) => item.id.startsWith(prefix));
          if (!owner) continue;
          const sprite = scene.routeCrowdRuntime.sprites?.get(item.id);
          const shown = item.visible && item.alpha === 1 && !item.destroyed &&
            inView(item.position) && sprite?.visible !== false && sprite?.alpha === 1;
          if (item.state === "returning" && shown && firstReturning[owner] === undefined) {
            firstReturning[owner] = { elapsed, id: item.id, position: item.position, generation: item.generation };
          }
          if (item.state === "gone" && item.visible && item.position.x >= 1250 &&
              item.position.x <= 1500 && item.position.y <= 1_000) {
            terminalGone.push({ elapsed, id: item.id, position: item.position });
          }
          if (shown && sprite) {
            const value = identity(sprite);
            const old = prior.get(item.id);
            if (old !== undefined && old !== value) identityBreaks.push({ elapsed, id: item.id, old, value });
            current.set(item.id, value);
          }
        }
        prior = current;
        if (elapsed % 1_000 === 0) samples.push({ elapsed, instances });
        if (maxRouteCountInVisualZone >= 10 &&
          firstReturning["vertical-crowd-reverse:"] !== undefined) break;
      }
      const configs = scene.routeCrowdRuntime.core?.options?.configs ?? [];
      const completionExitOwners = ["drinkers:", "vertical-crowd-reverse:"];
      const flags = configs.filter((config) => completionExitOwners.some((owner) => config.id + ":" === owner))
        .map((config) => ({ id: config.id, completionExit: config.completionExit, goBack: config.goBack, deleteAfterComplete: config.deleteAfterComplete }));
      return {
        view: { x: view.x, y: view.y, width: view.width, height: view.height },
        startNow, sampleCount: samples.length, firstReturning, terminalGone, identityBreaks,
        flags,
        final: scene.routeCrowdRuntime.snapshot.instances.filter((item) =>
          owners.some((owner) => item.id.startsWith(owner))),
        staticSpacing: minSpacing(scene.staticCrowdRuntime?.snapshot?.instances ?? []),
        policeNpcViolations,
        wallViolations,
        combinedSpacing: {
          minimum: Number.isFinite(minimumCombinedSpacing) ? minimumCombinedSpacing : null,
          maxRouteCountInScope,
          maxRouteCountInVisualZone,
          violations: spacingViolations.slice(0, 20),
          violationCount: spacingViolations.length,
        },
      };
    }
    return null;
    function minSpacing(instances) {
      const first = instances.filter((item) => item.regionIndex === 38);
      const second = instances.filter((item) => item.regionIndex === 61);
      let minimum = Infinity;
      for (const left of first) for (const right of second) {
        minimum = Math.min(minimum, Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y));
      }
      return { minimum: Number.isFinite(minimum) ? minimum : null, count38: first.length, count61: second.length };
    }
  }`);
  assert.ok(routeAudit, "route audit unavailable");
  for (const owner of ["vertical-crowd-reverse:"]) {
    assert.ok(routeAudit.firstReturning[owner], `${owner} never entered visible completion exit`);
  }
  assert.deepEqual(routeAudit.terminalGone, [], "completion-exit route held gone+visible at coffee endpoint");
  assert.deepEqual(routeAudit.identityBreaks, [], "route sprite identity changed while continuously visible");
  assert.deepEqual(routeAudit.policeNpcViolations, [],
    "mobile NPC entered a police collision rectangle");
  assert.deepEqual(routeAudit.wallViolations, [],
    "mobile NPC entered a blocked wall cell");
  assert.deepEqual(routeAudit.flags, [
    { id: "drinkers", completionExit: true, goBack: false, deleteAfterComplete: false },
    { id: "vertical-crowd-reverse", completionExit: true, goBack: false, deleteAfterComplete: false },
  ]);
  assert.ok(routeAudit.staticSpacing.minimum === null || routeAudit.staticSpacing.minimum >= 56,
    `coffee static regions 38/61 spacing ${routeAudit.staticSpacing.minimum} < 56`);
  assert.ok(routeAudit.combinedSpacing.minimum === null || routeAudit.combinedSpacing.minimum >= 56,
    `coffee route/static spacing ${routeAudit.combinedSpacing.minimum} < 56`);
  assert.equal(routeAudit.combinedSpacing.violationCount, 0,
    "coffee route/static spacing violations recorded");
  assert.ok(routeAudit.combinedSpacing.maxRouteCountInVisualZone >= 10,
    "coffee route replay did not keep ten NPCs in the camera view");
  const coffeeAfter = await snapshot();
  const coffeeAfterScreen = await capture("coffee-after");
  await sceneCall(`function () {
    for (const game of this) {
      const scene = game?.scene?.getScene?.("campus");
      if (!scene) continue;
      scene.scene.resume?.();
      return true;
    }
    return false;
  }`);
  const partyAudit = await probeConcertParty();
  const bugAudit = await probeBugArea();
  assert.equal(events.console.length, 0, "console errors or warnings recorded");
  assert.equal(events.exceptions.length, 0, "runtime exceptions recorded");
  assert.equal(events.failedRequests.length, 0, "failed network requests recorded");
  assert.equal(events.badResponses.length, 0, "bad network responses recorded");

  const result = {
    passed: true, url, stopBefore, stopSampleCount: stopSamples.length,
    stopAfter: stopSamples.at(-1), stopBeforeScreen, stopAfterScreen,
    policeCollision, coffeeBefore, coffeeAfter, coffeeBeforeScreen, coffeeAfterScreen,
    partyAudit, bugAudit, routeAudit, events,
  };
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, out, stopSampleCount: stopSamples.length,
    stopBeforeScreen, stopAfterScreen, coffeeBeforeScreen, coffeeAfterScreen, policeCollision,
    partyAudit: { roof: partyAudit.party.roof, lighting: partyAudit.party.lighting,
      concertActionCount: partyAudit.party.concertActions.length, partyScreen: partyAudit.partyScreen },
    bugAudit, routeAudit: { sampleCount: routeAudit.sampleCount,
      firstReturning: routeAudit.firstReturning, staticSpacing: routeAudit.staticSpacing,
      combinedSpacing: routeAudit.combinedSpacing }, events }));
  await command("Target.closeTarget", { targetId: target.id }, { ignoreDeadline: true, timeoutMs: 1_000 });
  activeTargetId = undefined;
  socket.close();
} catch (error) {
  if (error instanceof AuditTimeoutError) {
    await collectTimeoutEvidence(error);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  clearInterval(heartbeat);
  clearTimeout(watchdog);
  if (activeTargetId !== undefined && socket?.readyState === 1) {
    try {
      await command("Target.closeTarget", { targetId: activeTargetId },
        { ignoreDeadline: true, timeoutMs: 1_000 });
    } catch {}
  }
  socket?.close?.();
}

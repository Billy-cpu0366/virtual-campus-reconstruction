import assert from "node:assert/strict";

import { clickPlay } from "./browser-app-actions.mjs";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const positionalArgs = process.argv.slice(2).filter(
  (argument) => !argument.startsWith("--"),
);
const baseUrl =
  positionalArgs[0] ??
  process.env.SMOKE_BASE_URL ??
  "http://127.0.0.1:4175";
const rawSmokeUrl =
  positionalArgs[1] ?? process.env.SMOKE_URL ?? `${baseUrl}/`;
const waitMs = Number(process.env.SMOKE_WAIT_MS ?? "7000");
const cleanupStale = process.env.SMOKE_CLEANUP_STALE !== "false";
const bridgeTest =
  process.argv.includes("--bridge-test") ||
  process.env.SMOKE_BRIDGE_TEST === "true";
const smokeUrlObject = new URL(rawSmokeUrl);
smokeUrlObject.searchParams.set("collision-test", "1");
const smokeUrl = smokeUrlObject.toString();
const moveKey = process.env.SMOKE_MOVE_KEY ?? "ArrowDown";
const keyInfo = {
  ArrowUp: { code: "ArrowUp", windowsVirtualKeyCode: 38 },
  ArrowDown: { code: "ArrowDown", windowsVirtualKeyCode: 40 },
  ArrowLeft: { code: "ArrowLeft", windowsVirtualKeyCode: 37 },
  ArrowRight: { code: "ArrowRight", windowsVirtualKeyCode: 39 },
}[moveKey];
if (keyInfo === undefined) {
  throw new Error(`unsupported SMOKE_MOVE_KEY: ${moveKey}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${url}: ${response.status}`);
  }
  return response.json();
}

async function connectTarget(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) {
      return;
    }
    const request = pending.get(message.id);
    if (request === undefined) {
      return;
    }
    pending.delete(message.id);
    if (message.error !== undefined) {
      request.reject(new Error(JSON.stringify(message.error)));
    } else {
      request.resolve(message.result);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const command = (method, params = {}) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };

  return { socket, command };
}

async function evaluate(command, expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== undefined) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        "Runtime.evaluate failed",
    );
  }
  return result.result?.value;
}

async function holdDirection(command, key, code, windowsVirtualKeyCode, durationMs) {
  const before = await evaluate(
    command,
    "window.__campusDebug ? window.__campusDebug() : null",
  );
  const blocked = [];
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode,
  });
  try {
    const sampleCount = Math.max(1, Math.ceil(durationMs / 100));
    for (let index = 0; index < sampleCount; index += 1) {
      await sleep(100);
      const current = await evaluate(
        command,
        "window.__campusDebug ? window.__campusDebug() : null",
      );
      const blockedKey = key.replace("Arrow", "").toLowerCase();
      if (current?.body?.blocked?.[blockedKey]) {
        blocked.push(current.player);
      }
    }
  } finally {
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode,
    });
  }
  const after = await evaluate(
    command,
    "window.__campusDebug ? window.__campusDebug() : null",
  );
  return {
    before: before?.player,
    after: after?.player,
    blockedDirection: key.replace("Arrow", "").toLowerCase(),
    blockedSamples: blocked.length,
    lastBlockedPlayer: blocked.at(-1) ?? null,
  };
}

async function closeStalePages() {
  if (!cleanupStale) {
    return;
  }
  const targets = await jsonFetch(`${cdpUrl}/json/list`);
  for (const target of targets) {
    if (target.type !== "page" || target.url === "about:blank") {
      continue;
    }
    try {
      await fetch(`${cdpUrl}/json/close/${target.id}`);
    } catch {
      // A stale target can disappear between list and close.
    }
  }
}

await closeStalePages();
const target = await jsonFetch(
  `${cdpUrl}/json/new?${encodeURIComponent(smokeUrl)}`,
  { method: "PUT" },
);
const { socket, command } = await connectTarget(target.webSocketDebuggerUrl);
const errors = [];
const runtimeErrors = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        "runtime exception",
    );
  }
  if (message.method === "Network.loadingFailed") {
    runtimeErrors.push(
      `${message.params.errorText}: ${message.params.url}`,
    );
  }
});

try {
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Page.navigate", { url: smokeUrl });
  await clickPlay(
    command,
    (expression) => evaluate(command, expression),
    waitMs + 10000,
  );

  await sleep(waitMs);

  const debug = await evaluate(
    command,
    "window.__campusDebug ? window.__campusDebug() : null",
  );
  const title = await evaluate(command, "document.title");
  const readyState = await evaluate(command, "document.readyState");

  assert.equal(title, "Virtual Campus");
  assert.equal(readyState, "complete");
  assert.ok(debug !== null, "campus debug state is unavailable");
  assert.ok(debug.state !== undefined, "chunk coordinator state unavailable");
  assert.deepEqual(
    debug.state.failed,
    [],
    `world failed: ${JSON.stringify(debug.state.failed)}`,
  );
  assert.ok(
    debug.collisionLayers > 0,
    `no collision layers registered: ${JSON.stringify(debug)}`,
  );
  assert.deepEqual(debug.body, {
    width: 20,
    height: 8,
    offsetX: 14,
    offsetY: 36,
    blocked: debug.body.blocked,
  });
  assert.equal(typeof debug.body.blocked.up, "boolean");
  assert.equal(typeof debug.body.blocked.down, "boolean");
  assert.equal(typeof debug.body.blocked.left, "boolean");
  assert.equal(typeof debug.body.blocked.right, "boolean");
  assert.equal(debug.bridge1DownVisible, true);
  assert.equal(debug.bridge2DownVisible, true);

  const movement = await holdDirection(
    command,
    moveKey,
    keyInfo.code,
    keyInfo.windowsVirtualKeyCode,
    6000,
  );
  assert.ok(movement.before !== undefined, "player position unavailable");
  assert.ok(movement.after !== undefined, "player position lost after input");
  const movementDelta = ["up", "down"].includes(
    movement.blockedDirection,
  )
    ? movement.after.y - movement.before.y
    : movement.after.x - movement.before.x;
  const movementSign = ["up", "left"].includes(
    movement.blockedDirection,
  )
    ? -1
    : 1;
  assert.ok(
    movementDelta * movementSign >= 0,
    `player did not move ${movement.blockedDirection}: ${JSON.stringify(movement)}`,
  );
  assert.ok(
    movement.blockedSamples > 0,
    `player never reported blocked.${movement.blockedDirection}: ${JSON.stringify(movement)}`,
  );

  let bridgeTransitions = null;
  if (bridgeTest) {
    assert.equal(
      await evaluate(
        command,
        "Boolean(window.__campusCollisionTest)",
      ),
      true,
      "collision test hook is unavailable",
    );
    const setPlayerPosition = async (x, y) => {
      await evaluate(
        command,
        `window.__campusCollisionTest.setPlayerPosition(${x}, ${y})`,
      );
      await sleep(500);
      return evaluate(
        command,
        "window.__campusDebug ? window.__campusDebug() : null",
      );
    };
    const bridge1Up = await setPlayerPosition(1424, 960);
    assert.equal(
      bridge1Up.bridge1DownVisible,
      false,
      `bridge1 entry did not raise: ${JSON.stringify(bridge1Up)}`,
    );
    assert.equal(
      bridge1Up.player.depth,
      1650,
      `bridge1 raised depth mismatch: ${JSON.stringify(bridge1Up)}`,
    );
    const bridge1Down = await setPlayerPosition(1504, 872);
    assert.equal(
      bridge1Down.bridge1DownVisible,
      true,
      `bridge1 exit did not restore: ${JSON.stringify(bridge1Down)}`,
    );
    const bridge2Up = await setPlayerPosition(1008, 1392);
    assert.equal(
      bridge2Up.bridge2DownVisible,
      false,
      `bridge2 first zone did not raise: ${JSON.stringify(bridge2Up)}`,
    );
    assert.equal(
      bridge2Up.player.depth,
      1650,
      `bridge2 raised depth mismatch: ${JSON.stringify(bridge2Up)}`,
    );
    await setPlayerPosition(1008, 1456);
    const bridge2Down = await setPlayerPosition(1008, 1600);
    assert.equal(
      bridge2Down.bridge2DownVisible,
      true,
      `bridge2 second zone did not restore: ${JSON.stringify(bridge2Down)}`,
    );
    bridgeTransitions = {
      bridge1Up: bridge1Up.player,
      bridge1Down: bridge1Down.player,
      bridge2Up: bridge2Up.player,
      bridge2Down: bridge2Down.player,
    };
  }

  assert.deepEqual(runtimeErrors, [], `browser runtime errors: ${runtimeErrors}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        title,
        readyState,
        smokeUrl,
        moveKey,
        movement,
        bridgeTransitions,
        runtimeErrors,
        rendererLayers: debug.rendererLayers,
        collisionLayers: debug.collisionLayers,
        body: debug.body,
        bridge1DownVisible: debug.bridge1DownVisible,
        bridge2DownVisible: debug.bridge2DownVisible,
      },
      null,
      2,
    ),
  );
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
} finally {
  try {
    const messages = await command("Runtime.evaluate", {
      expression: "window.__campusDebug ? window.__campusDebug() : null",
      returnByValue: true,
    });
    if (messages.exceptionDetails !== undefined) {
      errors.push("debug evaluation failed during cleanup");
    }
  } catch {
    // The page may have closed after a navigation failure.
  }
  socket.close();
  try {
    await fetch(`${cdpUrl}/json/close/${target.id}`);
  } catch {
    // The target may already be closed.
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`browser collision smoke failed: ${error}`);
  }
  process.exitCode = 1;
}

import assert from "node:assert/strict";

const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4175";
const inputUrl = process.argv[2] ?? process.env.SMOKE_URL ?? `${baseUrl}/`;
const smokeUrl = new URL(inputUrl);
smokeUrl.searchParams.set("entry-autoplay", "1");
const url = smokeUrl.toString();
const waitMs = Number(process.env.SMOKE_WAIT_MS ?? "7500");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonFetch(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${endpoint}: ${response.status}`);
  }
  return response.json();
}

async function connectTarget(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  const events = { exceptions: [], failedRequests: [], badResponses: [] };

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const request = pending.get(message.id);
      if (request === undefined) return;
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
    if (message.method === "Network.loadingFailed") {
      events.failedRequests.push({
        url: message.params.url,
        errorText: message.params.errorText,
      });
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params.response;
      if (response.status >= 400 && !response.url.endsWith("/favicon.ico")) {
        events.badResponses.push({ url: response.url, status: response.status });
      }
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const command = (method, params = {}) => {
    const id = ++nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  const evaluate = async (expression) => {
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
  };

  return { socket, command, evaluate, events };
}

async function openViewport(viewport) {
  const target = await jsonFetch(
    `${cdpUrl}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  );
  const connection = await connectTarget(target);
  const { command } = connection;
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });
  await command("Emulation.setUserAgentOverride", {
    userAgent: viewport.mobile
      ? "Mozilla/5.0 (Linux; Android 13; Pixel 7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (X11; Linux x86_64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36",
    platform: viewport.mobile ? "Android" : "Linux x86_64",
    mobile: viewport.mobile,
  });
  await command("Emulation.setTouchEmulationEnabled", {
    enabled: viewport.mobile,
    ...(viewport.mobile ? { maxTouchPoints: 2 } : {}),
  });
  await command("Page.navigate", { url });
  const startedAt = Date.now();
  let playable = false;
  while (Date.now() - startedAt < waitMs + 10000) {
    playable = await connection.evaluate(
      "window.__campusDebug?.().entry?.snapshot?.status === 'playable'",
    );
    if (playable) break;
    await sleep(50);
  }
  if (!playable) throw new Error("mobile input entry did not become playable");
  return { target, ...connection };
}

async function readDebug(connection) {
  return connection.evaluate(
    "window.__campusDebug ? window.__campusDebug() : null",
  );
}

async function dispatchTouch(connection, type, touchPoints) {
  await connection.command("Input.dispatchTouchEvent", {
    type,
    touchPoints,
  });
  await sleep(100);
}

async function closeTarget(connection, target) {
  connection.socket.close();
  try {
    await fetch(`${cdpUrl}/json/close/${target.id}`);
  } catch {
    // The target may already be closed.
  }
}

const results = { desktop: null, mobile: null };
let desktop;
let mobile;
try {
  desktop = await openViewport({ width: 1280, height: 720, mobile: false });
  const desktopDebug = await readDebug(desktop);
  assert.ok(desktopDebug !== null, "test-hooks debug state is unavailable");
  assert.equal(desktopDebug.joystick.visible, false);
  assert.equal(desktopDebug.joystick.active, false);
  assert.equal(desktopDebug.playerRuntime.control.enabled, true);
  assert.equal(desktopDebug.playerRuntime.control.shutdown, false);
  assert.equal(
    desktopDebug.playerRuntime.position.x,
    desktopDebug.player.x,
  );
  assert.equal(
    desktopDebug.playerRuntime.position.y,
    desktopDebug.player.y,
  );
  results.desktop = {
    visible: desktopDebug.joystick.visible,
    device: desktopDebug.joystick.device,
  };

  mobile = await openViewport({ width: 390, height: 844, mobile: true });
  const mobileDebug = await readDebug(mobile);
  assert.ok(mobileDebug !== null, "mobile debug state is unavailable");
  await mobile.evaluate(`(() => {
    window.__pointerProbe = [];
    for (const type of ["pointerdown", "pointermove", "pointerup", "touchmove"]) {
      document.addEventListener(type, (event) => {
        window.__pointerProbe.push({
          type,
          pointerId: event.pointerId ?? null,
          clientX: event.clientX ?? null,
          clientY: event.clientY ?? null,
        });
      }, { passive: true });
    }
  })()`);
  assert.equal(mobileDebug.joystick.visible, true);
  assert.equal(mobileDebug.joystick.device, "mobile");
  assert.equal(mobileDebug.joystick.active, false);

  const canvasRect = await mobile.evaluate(`(() => {
    const rect = document.querySelector("#app canvas").getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
  const scaleX = canvasRect.width / 480;
  const scaleY = canvasRect.height / 270;
  const center = {
    x: canvasRect.left + mobileDebug.joystick.x * scaleX,
    y: canvasRect.top + mobileDebug.joystick.y * scaleY,
  };
  const horizontalMove = 20 * scaleX;
  await dispatchTouch(mobile, "touchStart", [
    { id: 1, x: center.x, y: center.y, radiusX: 1, radiusY: 1 },
  ]);
  const active = await readDebug(mobile);
  assert.equal(active.joystick.active, true);
  const ownerId = active.joystick.pointerId;
  assert.equal(typeof ownerId, "number");

  await mobile.command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  await sleep(150);
  const keyboardSuppressed = await readDebug(mobile);
  assert.equal(keyboardSuppressed.joystick.active, true);
  assert.equal(keyboardSuppressed.joystick.direction, null);
  assert.equal(keyboardSuppressed.playerVelocity.x, 0);
  assert.equal(keyboardSuppressed.playerVelocity.y, 0);

  await dispatchTouch(mobile, "touchEnd", []);
  const releasedFromCenter = await readDebug(mobile);
  assert.equal(releasedFromCenter.joystick.active, false);

  await dispatchTouch(mobile, "touchStart", [
    {
      id: 1,
      x: center.x,
      y: center.y,
      radiusX: 1,
      radiusY: 1,
    },
  ]);
  const pressed = await readDebug(mobile);
  assert.equal(pressed.joystick.active, true);
  assert.equal(pressed.joystick.direction, null);
  await dispatchTouch(mobile, "touchMove", [
    {
      id: 1,
      x: center.x + horizontalMove,
      y: center.y,
      radiusX: 1,
      radiusY: 1,
    },
  ]);
  const moved = await readDebug(mobile);
  const pointerProbe = await mobile.evaluate(
    "window.__pointerProbe ?? []",
  );
  assert.equal(
    moved.joystick.direction,
    "east",
    JSON.stringify({ moved, pressed, center, pointerProbe }),
  );
  assert.ok(moved.playerVelocity.x > 0);
  assert.equal(moved.playerVelocity.y, 0);
  assert.equal(moved.playerRuntime.control.enabled, true);
  assert.equal(moved.playerRuntime.control.status, "walking");
  assert.equal(moved.playerRuntime.control.visualLocked, false);

  await dispatchTouch(mobile, "touchStart", [
    {
      id: 2,
      x: center.x - horizontalMove,
      y: center.y,
      radiusX: 1,
      radiusY: 1,
    },
  ]);
  await dispatchTouch(mobile, "touchMove", [
    {
      id: 1,
      x: center.x + horizontalMove,
      y: center.y,
      radiusX: 1,
      radiusY: 1,
    },
    {
      id: 2,
      x: center.x - horizontalMove,
      y: center.y,
      radiusX: 1,
      radiusY: 1,
    },
  ]);
  const secondPointerIgnored = await readDebug(mobile);
  assert.equal(secondPointerIgnored.joystick.pointerId, ownerId);
  assert.equal(secondPointerIgnored.joystick.direction, "east");

  await mobile.command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  await dispatchTouch(mobile, "touchEnd", []);
  const released = await readDebug(mobile);
  assert.equal(released.joystick.active, false);
  assert.equal(released.joystick.direction, null);
  assert.equal(released.joystick.pointerId, null);

  await mobile.command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await sleep(150);
  const keyboardRestored = await readDebug(mobile);
  assert.equal(keyboardRestored.joystick.active, false);
  assert.ok(keyboardRestored.playerVelocity.x > 0);
  assert.equal(keyboardRestored.playerRuntime.control.status, "walking");
  await mobile.command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  results.mobile = {
    visible: moved.joystick.visible,
    device: moved.joystick.device,
    ownerId,
    direction: moved.joystick.direction,
    released: released.joystick,
    keyboardRestored: keyboardRestored.playerVelocity,
  };

  assert.deepEqual(desktop.events.exceptions, []);
  assert.deepEqual(desktop.events.failedRequests, []);
  assert.deepEqual(desktop.events.badResponses, []);
  assert.deepEqual(mobile.events.exceptions, []);
  assert.deepEqual(mobile.events.failedRequests, []);
  assert.deepEqual(mobile.events.badResponses, []);

  console.log(JSON.stringify({ ok: true, results }, null, 2));
} catch (error) {
  console.error(
    `browser mobile input smoke failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  if (desktop !== undefined) {
    await closeTarget(desktop, desktop.target);
  }
  if (mobile !== undefined) {
    await closeTarget(mobile, mobile.target);
  }
}

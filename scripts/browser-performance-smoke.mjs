import { writeFileSync } from "node:fs";

const cdpBase = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const url =
  process.argv[2] ??
  process.env.PERFORMANCE_SMOKE_URL ??
  "http://127.0.0.1:4175/";
const receiptPath = process.env.PERFORMANCE_RECEIPT;
const movementDurationMs = Number(
  process.env.PERFORMANCE_MOVEMENT_MS ?? 4000,
);

const targetResponse = await fetch(
  `${cdpBase}/json/new?${encodeURIComponent("about:blank")}`,
  { method: "PUT" },
);
if (!targetResponse.ok) {
  throw new Error(`could not create target: ${targetResponse.status}`);
}
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const runtimeEvents = { console: [], exceptions: [] };
let nextId = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result ?? {});
    return;
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    ["error", "warning"].includes(message.params.type)
  ) {
    runtimeEvents.console.push({
      type: message.params.type,
      args: message.params.args?.map((arg) => arg.value ?? arg.description),
    });
  }
  if (message.method === "Runtime.exceptionThrown") {
    runtimeEvents.exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text,
    );
  }
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitForState(expected, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if ((await evaluate("document.body?.dataset.appState")) === expected) {
      return Date.now() - startedAt;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${expected} timeout after ${timeoutMs}ms`);
}

function summarizePeriod(data) {
  const frameDeltas = data.raf.filter(Number.isFinite);
  const sorted = [...frameDeltas].sort((a, b) => a - b);
  return {
    frameCount: frameDeltas.length,
    medianFrameMs: sorted[Math.floor(sorted.length / 2)],
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
    maximumFrameMs: Math.max(...frameDeltas),
    framesOver34Ms: frameDeltas.filter((value) => value > 34).length,
    framesOver50Ms: frameDeltas.filter((value) => value > 50).length,
    longAnimationFrames: data.loaf,
    longTasks: data.longtask,
    inputEvents: data.keys,
    eventTiming: data.events,
  };
}

let result;
try {
  await Promise.all([
    command("Page.enable"),
    command("Runtime.enable"),
  ]);
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const perf = window.__performanceSmoke = {
        period: "boot",
        raf: [],
        loaf: [],
        longtask: [],
        events: [],
        keys: [],
      };
      perf.reset = (period) => {
        perf.period = period;
        perf.raf = [];
        perf.loaf = [];
        perf.longtask = [];
        perf.events = [];
        perf.keys = [];
      };
      perf.copy = () => ({
        period: perf.period,
        raf: [...perf.raf],
        loaf: [...perf.loaf],
        longtask: [...perf.longtask],
        events: [...perf.events],
        keys: [...perf.keys],
      });
      let previousFrame = performance.now();
      function sampleFrame(now) {
        perf.raf.push(now - previousFrame);
        previousFrame = now;
        requestAnimationFrame(sampleFrame);
      }
      requestAnimationFrame(sampleFrame);
      for (const type of ["long-animation-frame", "longtask", "event"]) {
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const row = {
                period: perf.period,
                entryType: entry.entryType,
                name: entry.name,
                startTime: entry.startTime,
                duration: entry.duration,
              };
              if (type === "long-animation-frame") {
                row.blockingDuration = entry.blockingDuration;
              }
              if (type === "event") {
                row.processingStart = entry.processingStart;
                row.processingEnd = entry.processingEnd;
                row.interactionId = entry.interactionId;
              }
              perf[
                type === "long-animation-frame"
                  ? "loaf"
                  : type === "event"
                    ? "events"
                    : "longtask"
              ].push(row);
            }
          }).observe(
            type === "event"
              ? { type, buffered: true, durationThreshold: 16 }
              : { type, buffered: true },
          );
        } catch (error) {
          perf[
            type === "long-animation-frame"
              ? "loaf"
              : type === "event"
                ? "events"
                : "longtask"
          ].push({ unsupported: String(error) });
        }
      }
      addEventListener("keydown", (event) => {
        perf.keys.push({
          period: perf.period,
          type: "keydown",
          key: event.key,
          eventTime: event.timeStamp,
          handledAt: performance.now(),
          delay: performance.now() - event.timeStamp,
        });
      }, true);
      addEventListener("keyup", (event) => {
        perf.keys.push({
          period: perf.period,
          type: "keyup",
          key: event.key,
          eventTime: event.timeStamp,
          handledAt: performance.now(),
          delay: performance.now() - event.timeStamp,
        });
      }, true);
    })()`,
  });
  await command("Page.navigate", { url });
  await waitForState("READY", 30000);

  await evaluate("window.__performanceSmoke.reset('entry')");
  await evaluate("document.querySelector('#app-play')?.click()");
  const entryDurationMs = await waitForState("PLAYING", 15000);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const entry = await evaluate("window.__performanceSmoke.copy()");

  await evaluate("window.__performanceSmoke.reset('movement')");
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await new Promise((resolve) => setTimeout(resolve, movementDurationMs));
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const movement = await evaluate("window.__performanceSmoke.copy()");

  const hookTypes = {
    debug: await evaluate("typeof window.__campusDebug"),
    entry: await evaluate("typeof window.__campusEntryTest"),
  };
  const entrySummary = {
    durationMs: entryDurationMs,
    ...summarizePeriod(entry),
  };
  const movementSummary = summarizePeriod(movement);
  const maximumInputDelay = Math.max(
    ...movementSummary.inputEvents.map((event) => event.delay),
  );
  const receipt = {
    url,
    build: "production",
    hookTypes,
    finalState: await evaluate("document.body?.dataset.appState"),
    entry: entrySummary,
    movement: movementSummary,
    maximumInputDelay,
    runtimeEvents,
  };
  result = {
    ...receipt,
    passed:
      hookTypes.debug === "undefined" &&
      hookTypes.entry === "undefined" &&
      receipt.finalState === "PLAYING" &&
      entrySummary.p95FrameMs <= 20 &&
      entrySummary.framesOver50Ms === 0 &&
      entrySummary.longAnimationFrames.length === 0 &&
      movementSummary.p95FrameMs <= 20 &&
      movementSummary.framesOver50Ms === 0 &&
      movementSummary.longAnimationFrames.length === 0 &&
      movementSummary.inputEvents.length >= 2 &&
      maximumInputDelay <= 16 &&
      runtimeEvents.console.length === 0 &&
      runtimeEvents.exceptions.length === 0,
  };
  if (receiptPath) {
    writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await command("Target.closeTarget", { targetId: target.id }).catch(
    () => undefined,
  );
  socket.close();
}

if (!result?.passed) process.exitCode = 1;

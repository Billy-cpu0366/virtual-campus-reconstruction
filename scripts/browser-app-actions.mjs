const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForAppStatus(
  evaluate,
  status,
  timeoutMs = 20000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await evaluate(`(() => ({
      status: document.body?.dataset.appState ?? null,
      generation: Number(document.body?.dataset.appGeneration ?? 0),
    }))()`);
    if (snapshot?.status === status) return snapshot;
    await sleep(50);
  }
  throw new Error(`timed out waiting for App status ${status}`);
}

export async function clickAppButton(
  command,
  evaluate,
  selector,
  expectedStatus,
  timeoutMs = 20000,
) {
  if (expectedStatus !== undefined) {
    await waitForAppStatus(evaluate, expectedStatus, timeoutMs);
  }
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLElement) || element.hidden) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      disabled: element instanceof HTMLButtonElement ? element.disabled : false,
    };
  })()`);
  if (point === null || point.disabled) {
    throw new Error(`App button is not clickable: ${selector}`);
  }
  await command("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await command("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  return point;
}

export async function clickPlay(command, evaluate, timeoutMs = 20000) {
  return clickAppButton(
    command,
    evaluate,
    "#app-play",
    "READY",
    timeoutMs,
  );
}

export async function clickRetry(command, evaluate, timeoutMs = 20000) {
  return clickAppButton(
    command,
    evaluate,
    "#app-retry",
    "ERROR",
    timeoutMs,
  );
}

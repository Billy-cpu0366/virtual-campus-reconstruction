import { afterEach, expect, it, vi } from "vitest";
import { fetchJson } from "../../game/fetchJson.js";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function pending(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

it.each(["headers", "body"])("%s 超时退出并清理定时器", async (phase) => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", (_: string, options: { signal: AbortSignal }) =>
    phase === "headers" ? pending(options.signal) : Promise.resolve({
      ok: true, json: () => pending(options.signal),
    }));
  const result = expect(fetchJson("/chunk.json", undefined, 100)).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("生命周期取消保留 AbortError", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", (_: string, options: { signal: AbortSignal }) => pending(options.signal));
  const controller = new AbortController();
  const result = expect(fetchJson("/chunk.json", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("正常响应返回 JSON 并清理 deadline", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ ready: true }) }));
  await expect(fetchJson("/master.json")).resolves.toEqual({ ready: true });
  expect(vi.getTimerCount()).toBe(0);
});

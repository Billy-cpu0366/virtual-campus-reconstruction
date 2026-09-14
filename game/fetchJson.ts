export const JSON_REQUEST_TIMEOUT_MS = 15_000;

/** One deadline covers both response headers and JSON body consumption. */
export async function fetchJson(
  url: string,
  signal?: AbortSignal,
  timeoutMs = JSON_REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const abort = (): void => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => {
    // TimeoutError remains retryable; lifecycle cancellation uses AbortError.
    controller.abort(new DOMException(`请求 ${url} 超时`, "TimeoutError"));
  }, timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`请求 ${url} 失败：HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/**
 * 递归冻结。
 *
 * 为什么需要它：配置对象在 src/ 里是 `Object.freeze` 过的，现有测试大量断言
 * `Object.isFrozen(config)` / `Object.isFrozen(config.startTiles[0])`。
 * 从 JSON 读出来的普通对象不满足这些断言，所以加载器必须自己冻一遍，
 * 而且**每一层都要冻**——只冻顶层的话 `startTiles[0]` 还是能改。
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

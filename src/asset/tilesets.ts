import type { DiscoveredTileset, TilesetEntry } from "./contract.js";
import { tilesetImageUrl } from "./urls.js";

// 固定加载 key（原站显式加载，FACT 见 SYS-ASSET 卡 §2）。
export const MAP_METADATA_KEY = "final-map-small";
export const MAP_ORIGINAL_KEY = "final-map-original";
export const TILESET_BASE_KEY = "exterior";

// 优化瓦片集命名前缀：名字含 exterior-small 的瓦片集会被动态发现。
const OPTIMIZED_TILESET_PREFIX = "exterior-small";

/**
 * 从地图元数据的 tilesets 里，发现需要动态加载的优化切块瓦片集。
 *
 * 原站事实（SYS-ASSET 卡 §1）：过滤名字含 exterior-small 的瓦片集，
 * 排除基础项 exterior-small 自身，其余按名字后缀构造加载 key
 * `exterior-{n}`，URL 为 `/assets/maps/{image}`。
 */
export function discoverOptimizedTilesets(
  tilesets: readonly TilesetEntry[],
): readonly DiscoveredTileset[] {
  const discovered: DiscoveredTileset[] = [];
  for (const tileset of tilesets) {
    const { name, image } = tileset;
    if (!name.includes(OPTIMIZED_TILESET_PREFIX)) {
      continue;
    }
    if (name === OPTIMIZED_TILESET_PREFIX) {
      continue;
    }
    discovered.push(
      Object.freeze({
        key: TILESET_BASE_KEY + name.slice(OPTIMIZED_TILESET_PREFIX.length),
        url: tilesetImageUrl(image),
      }),
    );
  }
  return discovered;
}

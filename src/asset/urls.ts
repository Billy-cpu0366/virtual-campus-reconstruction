import { chunkFileName } from "../chunk/coordinates.js";
import type {
  ChunkCoordinate,
  ChunkGeometry,
} from "../chunk/coordinates.js";

// 原站资源 URL 约定（FACT，见 SYS-ASSET 卡 §2）。
// 地图 / 分块 / 切块瓦片都以 /assets/maps 为根。
export const MAP_BASE_URL = "/assets/maps";

export function mapJsonUrl(): string {
  return `${MAP_BASE_URL}/final_map.json`;
}

export function mapMetadataUrl(): string {
  return `${MAP_BASE_URL}/final_map_small.json`;
}

export function chunkMasterUrl(): string {
  return `${MAP_BASE_URL}/chunks/master.json`;
}

export function chunkFileUrl(
  coordinate: ChunkCoordinate,
  geometry: ChunkGeometry,
): string {
  return `${MAP_BASE_URL}/chunks/${chunkFileName(coordinate, geometry)}`;
}

export function tilesetImageUrl(image: string): string {
  return `${MAP_BASE_URL}/${image}`;
}

export function independentLayerUrl(fileName: string): string {
  return `${MAP_BASE_URL}/${fileName}`;
}

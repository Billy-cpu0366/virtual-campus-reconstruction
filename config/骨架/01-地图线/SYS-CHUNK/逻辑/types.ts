/** 地图分块运行时参数；数值来自原有 CampusScene 与 chunk 模块。 */
export interface ChunkConfigs {
  readonly updateIntervalMs: number;
  readonly playerNeighborhoodRadius: number;
  readonly cameraPadding: number;
  readonly maxAttempts: number;
}

// SYS-ASSET 确定性 CORE 的公共类型。
// 只承载纯数据形状；JSON 解析与 I/O 归加载层（本 CORE 不含）。

export interface TilesetEntry {
  readonly name: string;
  readonly image: string;
}

export interface DiscoveredTileset {
  readonly key: string;
  readonly url: string;
}

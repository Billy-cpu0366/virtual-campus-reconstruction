# 当前可玩雏形运行资源

本目录只提供 `WI-RENDER-PLAYABLE-001` 当前雏形所需的最小资源。

资源从只读证据镜像逐文件复制；`final_map.json` 仅规范化了行尾空白，地图数据未改变。来源为：

`sample/original-public-build/mirror/assets/`

当前提供：

- `js/phaser.min.js`
- `maps/final_map.json`
- `maps/playable-map.json`
- `maps/exterior-final.webp`
- `maps/collisions-objects.png`
- `sprites/player.webp`

`final_map.json` 保留原始地图数据；当前雏形实际加载 `playable-map.json`，其中去掉了 Phaser 尚未接入的外置粒子瓦片集引用，并将粒子 GID 清零，因此只显示已有的普通地图图层。

原站完整资源、master/chunk 分块资源和其他内容仍以 `sample/` 为证据源；本目录不代表完整运行时已经实现动态分块或全部系统。

---
title: 可玩雏形跳过未接入特效瓦片集
type: task-todo
created: 2026-09-01
---

# 范围

在 `WI-RENDER-PLAYABLE-001` 范围内，让当前雏形使用已有普通地图和玩家资源正常运行；保留 `sample/` 与原始 `final_map.json` 不变，不实现粒子、动态特效或其他后续系统。

## 步骤

- [x] 生成去除外置粒子瓦片集引用、并清零粒子 GID 的运行时地图副本。
- [x] 让 Phaser 雏形加载运行时地图副本。
- [x] 更新资源说明与资源存在性测试。
- [x] 运行 typecheck、test、build、Vite 资源检查和浏览器验收。
- [ ] 检查 diff，只提交本轮相关文件并正常推送。

## 验收

- 页面显示已有校园地图和玩家，不因未接入粒子瓦片集崩溃。
- 原始 `sample/` 证据和 `public/assets/maps/final_map.json` 保持不变。
- 粒子、NPC、碰撞和其他未授权系统仍不实现。

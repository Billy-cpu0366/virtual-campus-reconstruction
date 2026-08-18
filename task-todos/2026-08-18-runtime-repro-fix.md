---
title: 当前可玩雏形可复现性与文档漂移修复
type: task-todo
created: 2026-08-18
---

# 范围

只修复当前 `WI-RENDER-PLAYABLE-001` 范围内的可复现性和已确认文档漂移，不实现后续 chunk 流式加载、真实碰撞、摇杆、动态 roof/bridge、完整玩家状态机或内容系统。

## 步骤

- [x] 统一当前雏形使用的运行时资源路径为 `/assets/...`。
- [x] 从只读 `sample/` 镜像提供当前雏形所需的最小运行资源，并保留来源可追溯性。
- [x] 清理 `package-lock.json` 中未声明且与 Phaser 3 vendor 方案冲突的 Phaser 4 残留。
- [x] 更新 `src/README.md` 和当前深度公式文档漂移。
- [x] 同步 `task_plan.md`、`决策记录.md` 和当前工作项状态。
- [x] 运行 typecheck、test、build、状态一致性检查和本地 Vite 资源 smoke test。
- [x] 检查 diff，只提交本轮相关文件；已提交 `8973de8`。
- [x] 正常推送当前分支；`origin/main` 已更新至 `8973de8`。

## 禁止范围

- 不修改 `sample/` 证据内容。
- 不实现后续运行时系统。
- 不修改旧 Phaser 项目的行为设计。
- 不 force-push，不改写 Git 历史。

## 验收

- 当前页面请求的 Phaser、地图 JSON、瓦片和玩家 sprite 均从 `/assets/...` 返回正确 MIME/内容。
- TypeScript、测试、构建和状态一致性检查通过；若环境导致测试失败，记录根因。
- 文档不再把 `src/chunk` 写成唯一正式入口；玩家 depth 文档统一采用 SYS-LAYER 已接受公式。

---
work-item: WI-MAP-RUNTIME-COMPLETION-001
parent: WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001
status: integration-ready-for-preview
branch: impl/map-runtime-completion
authorization: DEC-MAP-RUNTIME-COMPLETION-001
updated: 2026-08-21
result-commit: 5290eca
---

# M1 地图运行时收口实施包

> 本文件是地图执行窗口的有界任务卡；动态状态仍只以根 `task_plan.md` 为准。

## 目标

在不实现车辆/NPC/动态 FX 的前提下，修正 raw particles 图层事实与运行时差距，保持安全的 24 层对称生命周期，并补资源和回归验证。

## 必须实现

1. `particles` / `particles2` 使用公开 `tileset-particles`，只显示已证实 GID `69355–69359`。
2. GID `69360` 保持 UNKNOWN；不得猜语义或静默当成已解决。
3. `particles3` 保留 marker 和未消费诊断；不关闭 `Q-LAYER-002`。
4. 24 层继续按当前重构合同对称 apply/remove；不复制原站只卸载 11 层的路径。
5. cars 只保留 marker/坐标输出；不创建路线或车辆。
6. footsteps 保留数据来源；不创建 footprint Sprite。
7. 通过白名单资源脚本从只读 `sample/` 生成/校验粒子运行资源；`public/` 不提交。
8. 验证资源失败、apply/remove、shutdown、目标集合和当前环境 baseline 无明显退化。

## 允许文件

```text
src/asset/
src/chunk/
src/world/
src/layer/
game/PhaserWorldRenderer.ts
game/PhaserWorldMutationScheduler.ts
scripts/prepare-runtime-assets.mjs
scripts/check-runtime-assets.mjs
scripts/sanitize-runtime-maps.mjs
tests/asset/
tests/chunk/
tests/world/
tests/layer/
task-todos/WI-MAP-RUNTIME-COMPLETION-001-执行报告.md
```

## 禁止

- 不修改 `game/CampusScene.ts`、`package.json`、共享 browser Smoke 或权威状态文档。
- 不修改 `sample/`、旧 Phaser 或远端 Git。
- 不实现车辆、NPC、trajectory 粒子、footprint Sprite、抗议者。
- 不替换现有 exterior atlas 为 16 张 exterior-small。
- 不制定最终 FPS/GPU/纹理内存阈值。
- 不自行 merge/push。

## 客观检查

```text
npm run typecheck
npm test -- --run
npm run prepare:runtime
npm run check:runtime
npm run build
npm run build:test-hooks
npm run check:perf-baseline-evidence
```

窗口必须新增与改动匹配的地图单元测试。浏览器共享接线和完整 Smoke 由 Main 在 integration 分支执行。

## 停止条件与交接

- 允许范围实现完成且检查通过后停止。
- 若粒子资源/GID 与当前 sanitizer 合同冲突，停止并报告，不扩大资源范围。
- 返回实际 diff、测试结果、失败/销毁边界、UNKNOWN 和执行报告路径，标记 ready-for-preview 后停止。
- 不自行 commit；Human 接受实际结果后，按 Main 指令使用明确文件路径提交并回传提交 ID。

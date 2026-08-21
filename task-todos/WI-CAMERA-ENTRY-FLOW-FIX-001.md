---
work-item: WI-CAMERA-ENTRY-FLOW-FIX-001
status: active
work-item-type: integration-bugfix
branch: integration/map-gameplay-p0
authorization: DEC-CAMERA-ENTRY-FLOW-FIX-001
updated: 2026-08-21
---

# 相机进入流程阻断修复

## Human 问题与授权

- 发现：进入可玩场景后自动播放约111秒航拍，玩家不可见且控制被锁。
- 产品判断：航拍属于未来进入游戏前流程，不应在已进入游戏后自动运行。
- Human 原文：`禁用掉现在。开始修复`。

## 目标

1. production 进入 `CampusScene` 后立即显示玩家并保持硬跟随；
2. 玩家控制默认可用，不发生航拍控制锁；
3. 不删除已验证的相机航拍能力；仅允许显式 test-hooks 查询参数启动，以继续验证该能力；
4. 未来开始页/进入按钮接线另立工作项，本次不实现 UI。

## 允许文件

- integration `game/CampusScene.ts`
- integration `scripts/browser-camera-smoke.mjs`
- integration 相机集成报告
- 根 `task_plan.md`、`决策记录.md`、`工作日志.md` 和本任务卡

## 禁止

- 修改 `sample/`、相机核心时序、地图/玩家核心或资源；
- 新增开始页、按钮、弹窗、session 状态或内容线；
- 删除航拍能力或把 test-hooks 暴露到 production；
- merge、push 或继续 GitHub 交付。

## 验收

- 普通 production 启动不调用航拍，玩家立即位于相机视口内，控制可用；
- test-hooks 无 `camera-smoke` 参数时同样不自动航拍；
- 显式 `camera-smoke` 参数仍覆盖航拍运行、控制锁/恢复和分块预载；
- typecheck、全测试、production/test-hooks build、direct-entry/camera 及既有浏览器回归通过；
- Human 在本地实时预览确认后才关闭本工作项并恢复 GitHub handoff。

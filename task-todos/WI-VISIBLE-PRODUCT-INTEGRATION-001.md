---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: main-integration
status: ready-for-human-visual-gate
branch: integration/visible-product-wave
worktree-path: .pi/worktrees/visible-product-integration
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: preview-and-human-visual-only
worktree-receipt: integration-0fadf309-clean
human-visual-gate-required: true
updated: 2026-08-22
---

# Main：产品入口与最终集成

## P1任务

- 调查原站页面→Loading→Play→Phaser Scene的真实触发链。
- 查清正常入口的短相机过渡、最终构图和控制交接；六点111秒序列只登记为存在但用途/触发UNKNOWN，禁止接入正常入口。
- 形成Loading、秒级入场、首个内容引导、NPC/FX首屏关系的可视验收候选。
- Main审查其他三路报告并在P2冻结共享接口和文件所有权。

## P1交付

一份产品入口调查设计报告和一份P2统一设计候选；Human确认视觉目标前不得写正式功能代码。

## P1/P2交接

P1报告`b5708b42`已并入root`1b4bc03`。Human已接受3秒相机+5秒火车、480×270逻辑画面、Memo 6引导；P2范围见[实现包](WI-VISIBLE-PRODUCT-INTEGRATION-001-P2-实现包.md)。设计clean提交前不得写代码。

## P2.1共享owner

Main当前clean、未写P3代码。authority提交后先产出单独shared contract/resolver提交；不得混入入口、真实正文或04 DOM实现。该commit同步到03/04后，Main再恢复自身P3入口。

## 后续Main所有权

P2通过后独占`game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、共享browser smoke和integration merge。按独立件→内容线→旁支顺序串行合并，Human视觉Gate通过前不得关闭文档或远端交付。

---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: main-integration
status: active-p1-recon
branch: integration/visible-product-wave
worktree-path: .pi/worktrees/visible-product-integration
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: recon-design-only
worktree-receipt: verified-clean-at-baseline
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

## 后续Main所有权

P2通过后独占`game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、共享browser smoke和integration merge。按独立件→内容线→旁支顺序串行合并，Human视觉Gate通过前不得关闭文档或远端交付。

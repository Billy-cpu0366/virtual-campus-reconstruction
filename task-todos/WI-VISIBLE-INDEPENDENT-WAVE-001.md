---
work-item: WI-VISIBLE-INDEPENDENT-WAVE-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 04-independent
status: ready-for-worktree-creation
branch: feature/04-independent-visible-wave
worktree-path: .pi/worktrees/04-independent-visible
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: recon-design-only
updated: 2026-08-22
---

# 04独立件：Loading与正式UI波

## P1任务

- 调查原站Loading/Play/Retry页面、真实加载进度和失败恢复。
- 调查正式Game UI视觉、Escape/focus、响应式和图片失败。
- 用现有玩家与未来真实NPC/路线检查Entity复用条件；不预建公共框架。
- 给出桌面/移动端可见验收目标和App状态机候选。

## P1交付

只提交一份调查设计报告；明确Loading状态、UI边界、失败/清理、实现候选和UNKNOWN。不得写正式功能代码。

## 后续候选边界

P2通过后可候选新增`src/app/**`、扩展`src/game-ui/**`及对应测试/新适配器。不得修改Main共享入口；Entity无两个真实消费者前继续NO-GO。

---
work-item: WI-VISIBLE-INDEPENDENT-WAVE-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 04-independent
status: ready-for-p4-integration
branch: feature/04-independent-visible-wave
worktree-path: .pi/worktrees/04-independent-visible
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: wait-main-serial-integration
worktree-receipt: foundation-db0fd9d1-rich-c1156cd8-clean
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

## P1/P2交接

P1报告`d4d84837`已并入root`15e434c`。Human已接受真实Loading/Play及重构ERROR/Retry；P2范围见[实现包](WI-VISIBLE-INDEPENDENT-WAVE-001-P2-实现包.md)。设计clean提交前不得写代码。

## P2.1暂停收据

04已修改`src/game-ui/dom-modal.ts`、`src/game-ui/index.ts`并新增`src/app/**`和`src/game-ui/app-shell.ts`，尚未测试/提交；未修改`src/content/contract.ts`。必须保留现场，不得reset/clean/stash/覆盖；authority提交后先把非富内容App/UI foundation做成可验证提交，再同步Main共享契约。

## 后续候选边界

P2通过后可候选新增`src/app/**`、扩展`src/game-ui/**`及对应测试/新适配器。不得修改Main共享入口；Entity无两个真实消费者前继续NO-GO。

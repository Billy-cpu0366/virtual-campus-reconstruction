---
work-item: WI-VISIBLE-SIDE-WAVE-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 05-side
status: ready-for-p4-integration
branch: feature/05-side-visible-wave
worktree-path: .pi/worktrees/05-side-visible
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: wait-main-serial-integration
worktree-receipt: implementation-0c049130-clean
updated: 2026-08-22
---

# 05旁支：NPC、路线与FX可见波

## P1任务

- 从公开证据中选择确实可实现的一个NPC、一段路线行为和一个FX。
- 查清资源、创建、更新、地图/分块关系、所有权、失败和销毁。
- 明确三者是否真的共享生命周期；不预设Entity框架。
- 给出玩家首屏或短路径内可见的验收场景。

## P1交付

只提交一份调查设计报告；必须提出有证据的可见实现候选。证据不足时标记阻塞并更换候选，不能以no-code报告冒充板块完成。

## P1/P2交接

P1报告`035017ae`已并入root`d7238e3`。P2实现sprayer、crowdTrain和factory smoke，见[实现包](WI-VISIBLE-SIDE-WAVE-001-P2-实现包.md)。设计clean提交前不得写代码。

## 后续候选边界

P2通过后可候选新增`src/npc/**`、`src/route/**`、`src/fx/**`、新Phaser适配器及对应测试。不得修改Main共享入口、地图核心或创建通用Entity registry。

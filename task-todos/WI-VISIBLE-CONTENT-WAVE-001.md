---
work-item: WI-VISIBLE-CONTENT-WAVE-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 03-content
status: active-p3-implementation
branch: feature/03-content-visible-wave
worktree-path: .pi/worktrees/03-content-visible
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: p3-bounded-implementation
worktree-receipt: verified-clean-at-baseline
updated: 2026-08-22
---

# 03内容线：可见内容波

## P1任务

- 核对About、Projects、Memo等公开正文、图片、链接与双语证据。
- 调查首个内容点怎样被玩家发现，不以test hook传送代替真人路径。
- 复核动态marker、内容失败和teardown残余UNKNOWN。
- 形成至少三类可见内容的实现候选和桌面/移动端验收场景。

## P1交付

只提交一份调查设计报告；区分FACT/INFERRED/DECISION候选/UNKNOWN，并列出允许文件、测试和停止条件。不得写正式功能代码。

## P1/P2交接

P1报告`0a5091db`已并入root`fbec3e2`。Human已选择Memo 6首引导；P2范围见[实现包](WI-VISIBLE-CONTENT-WAVE-001-P2-实现包.md)。设计clean提交前不得写代码。

## 后续候选边界

P2通过后可候选修改`src/content/**`、必要`src/zone/**`/`src/interact/**`、对应测试和公开内容派生资源。不得修改Main共享入口；不得猜未公开内容。

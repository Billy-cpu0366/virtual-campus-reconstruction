---
work-item: WI-GITHUB-HANDOFF-V1-001
status: active-windows-readonly-audit-request-ready
work-item-type: delivery-infrastructure
authorization: DEC-GITHUB-HANDOFF-V1-001
updated: 2026-08-23
protocol-commit: 0a105dc
---

# GitHub 交付中转协议 v1 首次对齐任务

> 本卡 `status` 只描述该有界任务自身；当前阶段和 Gate 唯一以根 `task_plan.md` 为准。

## 目标

完成 Windows 正式仓库一次性审计与历史对齐，建立 Git bundle 双向桥，并用地图+玩家+相机统一成果完成首次真实 delivery 分支 push 收据。

## 当前阶段

`windows-readonly-audit-request-ready`

Human 于 2026-08-23 明确要求推进首次历史对齐，并把结果交给 Windows 终端 Pi 处理。可整段发送的请求已落盘到 `task-todos/WI-GITHUB-HANDOFF-V1-001-WINDOWS-AUDIT-REQUEST.md`。本轮只授权 Windows 正式仓库只读审计和一次 `fetch origin --prune`；不授权处理 dirty、reconciliation、commit、push、PR、merge或修改`main`。

此前 WIP 快照目标仍只允许非保护 WIP 分支，不代表产品通过；在外部审计收据返回并经 Human 接受无损方案前，不恢复实际交付。

外部 Pi 已报告：

- 正式路径正确并读取 `AGENTS.md`；
- 当前分支 `main`；
- 3个 tracked 文档修改及未跟踪 `task-todos/`；
- fetch 前远端引用显示 ahead 18 / behind 4；
- 未执行 fetch、复制、应用、测试、commit 或 push。

以上只作为待复核输入；fetch 后哈希、分叉和 dirty 明细仍为 `UNKNOWN`。

## alpha.3 Adapter 接入

Human 于 2026-08-23 接受把独立 `pi-git-handoff` 接入本项目；落盘前因完整 delivery ref 回归修复，versioned 合同晋升为 alpha.3，范围仅为 adapter 与预演合同：

- 项目 adapter：`03-执行层/git-handoff.adapter.v1.json`；
- `refs/pi-handoff/canonical/main` 是固定 WSL canonical ref，但当前尚不存在；
- profiles 只定义 `wip/<delivery-id>` 与 `delivery/<delivery-id>`，不授权实际 push；
- 外部检查固定为状态一致性、typecheck、测试和 build；
- 2026-08-23 adapter 落盘轮次未运行 prepare、external checks、fetch 或 push；该轮次已关闭。后续 `DEC-GITHUB-HANDOFF-WINDOWS-AUDIT-RESUME-001` 只对 Windows 只读审计新增一次 `fetch origin --prune` 授权，不开放其他外部动作。

adapter 只在首次审计、历史对齐和 canonical bundle 入站完成后才能用于真实 handoff；它不得自动处理已知 Windows dirty 或 main 分叉。alpha.3 静态接入已通过 runtime 解析、17 项 Package 测试、outbox ignore、状态一致性与独立复核，但仍是 `remote-unverified`。

## 允许

- 外部 Pi 只读检查路径、origin、status、diff、未跟踪文件、提交图和 cherry 等价；
- `git fetch origin --prune`；
- 生成短审计报告和 SHA-256；
- 项目侧维护本协议、任务卡、决策、计划和日志。

## 禁止

以下禁令针对审计中的 Windows 正式仓库；项目侧协议/状态文档仍须按治理规则本地提交，不能只留在聊天或脏工作树。

- 应用旧 `wave1-first-wave.diff`；
- pull、reset、clean、stash、覆盖、切换覆盖、merge、rebase、commit、push；
- 未经 Human 决定处理 dirty 内容或冲突；
- 修改 `src/`、`game/`、`sample/` 或旧 Phaser；
- 在正式 `main` 直接开发或交付。

## 下一 Gate

外部 Pi 按 `task-todos/WI-GITHUB-HANDOFF-V1-001-WINDOWS-AUDIT-REQUEST.md` 返回 `AUDIT-RESULT-V1`：正式 HEAD、origin/main、merge-base、ahead/behind、dirty tracked/untracked、local-only/remote-only、cherry 等价和潜在冲突。

Main 根据收据提出无损保护与 reconciliation 方案；Human 接受后才进入首次对齐实现。

## 完成标准

1. dirty 内容有明确 Human 处置与可复核保存点；
2. local/remote 分叉在隔离 reconciliation worktree 收敛并通过项目检查；
3. WSL 与 Windows 共享 canonical Git 基线；
4. 统一 delivery bundle 的 manifest/hash/文件范围通过；
5. 正式仓库实际 diff 经 Human Preview；
6. delivery 分支 push 后远端 commit/tree 核对；
7. `delivery-receipt.json` 回写并通过独立复核；
8. 协议状态从 `accepted-unverified` 晋升 `verified`。

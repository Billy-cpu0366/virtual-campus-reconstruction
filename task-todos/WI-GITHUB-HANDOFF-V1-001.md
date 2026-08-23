---
work-item: WI-GITHUB-HANDOFF-V1-001
status: active-reconciliation-plan-gate
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

`reconciliation-plan-human-gate`

Human 已转交 Windows 外部 Pi 的完整 `AUDIT-RESULT-V1`，原始结构化收据保存在 `task-todos/WI-GITHUB-HANDOFF-V1-001-WINDOWS-AUDIT-RESULT-V1.md`，SHA-256 为 `21b76920f6a1928a608dc94226a4b9b341322fba090b64329d5fecfe75b262da`。该收据属于 `human-relayed / external-runtime-unverified-by-wsl`，不能冒充 WSL 独立验证。

报告结论：canonical remote 精确匹配且唯一一次 fetch 成功；Windows local main 与 origin/main 为 ahead 18 / behind 4，存在 3 个原因未明的 tracked `.M`、1 个 untracked 文件，以及 8 个双方共同修改的权威路径。外部 Pi 已按 Gate 停止，未处理 dirty、reconciliation、commit 或 push。

WSL 本地对象核对保存在 `task-todos/WI-GITHUB-HANDOFF-V1-001-WSL-CORRELATION-V1.md`：Windows local HEAD 对象缺失；reported origin/main 对象存在，但与当前 WSL HEAD 无共同 merge-base且根提交不同。因此不能直接 fast-forward、普通 merge或假定 Windows 18 个本地提交已被当前 WSL 吸收。

此前 WIP 快照目标仍只允许非保护 WIP 分支，不代表产品通过；Human 接受 preservation/reconciliation 方案前，不恢复实际交付。

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
- 已消费的一次 `git fetch origin --prune` 仅作为审计历史；未取得新授权前不得再次 fetch；
- 生成和登记审计报告、SHA-256 与 WSL 本地对象相关性；
- 项目侧维护本协议、任务卡、决策、计划和日志。

## 禁止

以下禁令针对审计中的 Windows 正式仓库；项目侧协议/状态文档仍须按治理规则本地提交，不能只留在聊天或脏工作树。

- 应用旧 `wave1-first-wave.diff`；
- pull、reset、clean、stash、覆盖、切换覆盖、merge、rebase、commit、push；
- 未经 Human 决定处理 dirty 内容或冲突；
- 修改 `src/`、`game/`、`sample/` 或旧 Phaser；
- 在正式 `main` 直接开发或交付。

## 下一 Gate

Main 根据审计收据和 WSL 本地对象核对提出最小无损 preservation/reconciliation 方案；Human 接受后才生成下一份 Windows 执行包。未接受前，不授权复制 dirty、生成 bundle、写 WSL inbox、导入 refs、创建 worktree、merge、commit 或 push。

## 完成标准

1. dirty 内容有明确 Human 处置与可复核保存点；
2. local/remote 分叉在隔离 reconciliation worktree 收敛并通过项目检查；
3. WSL 与 Windows 共享 canonical Git 基线；
4. 统一 delivery bundle 的 manifest/hash/文件范围通过；
5. 正式仓库实际 diff 经 Human Preview；
6. delivery 分支 push 后远端 commit/tree 核对；
7. `delivery-receipt.json` 回写并通过独立复核；
8. 协议状态从 `accepted-unverified` 晋升 `verified`。

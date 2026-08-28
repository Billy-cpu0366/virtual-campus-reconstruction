---
work-item: WI-GITHUB-HANDOFF-V1-001
status: active-wip-snapshot-external-preview-request-ready
work-item-type: delivery-infrastructure
authorization: DEC-GITHUB-HANDOFF-V1-001
updated: 2026-08-23
protocol-commit: 0a105dc
---

# GitHub 交付中转协议 v1 首次对齐任务

> 本卡 `status` 只描述该有界任务自身；当前阶段和 Gate 唯一以根 `task_plan.md` 为准。

## 目标

把当前 WSL 已提交成果完整运输到 GitHub 全新非保护 WIP 分支并生成远端收据；Windows 正式仓库历史对齐保留为未来 main/PR 集成任务，不作为当前 WIP 备份前置。

## 当前阶段

`wip-snapshot-external-preview-request-ready`

Human 已转交 Windows 外部 Pi 的完整 `AUDIT-RESULT-V1`，原始结构化收据保存在 `task-todos/WI-GITHUB-HANDOFF-V1-001-WINDOWS-AUDIT-RESULT-V1.md`，SHA-256 为 `21b76920f6a1928a608dc94226a4b9b341322fba090b64329d5fecfe75b262da`。该收据属于 `human-relayed / external-runtime-unverified-by-wsl`，不能冒充 WSL 独立验证。

报告结论：canonical remote 精确匹配且唯一一次 fetch 成功；Windows local main 与 origin/main 为 ahead 18 / behind 4，存在 3 个原因未明的 tracked `.M`、1 个 untracked 文件，以及 8 个双方共同修改的权威路径。外部 Pi 已按 Gate 停止，未处理 dirty、reconciliation、commit 或 push。

WSL 本地对象核对保存在 `task-todos/WI-GITHUB-HANDOFF-V1-001-WSL-CORRELATION-V1.md`：Windows local HEAD 对象缺失；reported origin/main 对象存在，但与当前 WSL HEAD 无共同 merge-base且根提交不同。因此不能直接 fast-forward、普通 merge或假定 Windows 18 个本地提交已被当前 WSL 吸收。

Human 已明确当前只要求把 WSL 完整成果备份到新的非保护 WIP 分支，不要求可直接合并 `main`。因此 reconciliation 不再是当前前置；审计收据只证明 remote 身份和 Windows 正式工作树不得被触碰。alpha.4 snapshot profile 已通过28项本地测试、schema duplicate-key scan、真实离线bundle与最终独立安全终审。当前 WSL delivery readiness 已通过 typecheck、32文件/168测试、build、临时preview browser smoke和状态一致性；prepare 已生成新的不可变 outbox，等待 Windows external Preview。

## Alpha.7 Windows 兼容修复（已接受）

`vc-wip-snapshot-20260828-01` 的 alpha.4 artifact、adapter 和 Preview 请求保持冻结；Windows 原生 package validation 曾因 `python3` alias、路径格式、symlink 权限和长 fixture 路径失败，故不得继续使用该请求生成 Preview。Human 于 2026-08-28 选择`升级 alpha.7（推荐）`。

alpha.7 仅修复 package 验证入口与跨平台测试，并将项目 adapter 的 required version 同步为 `0.1.0-alpha.7`。新 package commit 后必须从原 delivery commit 之上生成新的 delivery-id、bundle、manifest、prepare receipt、SHA256SUMS 和新的 Windows Preview 请求；不复用或改写 alpha.4 的冻结 payload。此修复不授权 push、PR、merge、main 更新或 Windows 正式仓库 dirty 处理。

## alpha.3 初始 Adapter 接入历史

Human 于 2026-08-23 接受把独立 `pi-git-handoff` 接入本项目；落盘前因完整 delivery ref 回归修复，versioned 合同晋升为 alpha.3，范围仅为 adapter 与预演合同：

- 项目 adapter：`03-执行层/git-handoff.adapter.v1.json`；
- alpha.3 使用的 `refs/pi-handoff/canonical/main` 未建立，因此 canonical-only prepare 保持 STOP；
- alpha.3 曾定义 `wip` 与 `review`；当前 alpha.4 adapter 只保留显式 `wip` snapshot profile，不授权 `review` 或实际 push；
- 外部检查固定为状态一致性、typecheck、测试和 build；
- 2026-08-23 adapter 落盘轮次未运行 prepare、external checks、fetch 或 push；该轮次已关闭。后续 `DEC-GITHUB-HANDOFF-WINDOWS-AUDIT-RESUME-001` 只对 Windows 只读审计新增一次 `fetch origin --prune` 授权，不开放其他外部动作。

上述 alpha.3 canonical-only 约束已由当前 snapshot 决定收窄：未来 integrated route 仍需历史对齐，但 alpha.4 WIP snapshot 只绑定 `refs/remotes/audit/main` 的审计身份并允许不相连历史。alpha.3 已通过17项测试；alpha.4 必须重新完整验证，不能继承其真实远端状态。

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

`verification-delivery` 已核对 current WSL commit、clean 工作树、实际文件范围、历史 ignored outbox 不冲突和 WIP 边界。根 `npm test` 曾误收集 `packages/pi-git-handoff/tests/` 的 Node test 和 `.pi/worktrees/` 副本，已通过 `vite.config.ts` 排除规则修复；typecheck、32文件/168测试、build与临时preview browser smoke均已通过。

已准备 delivery：

```text
delivery-id: vc-wip-snapshot-20260823-01
commit: e3c86dd3e4c5be49fa50bfadaaea7fa4e8b8f000
tree: 63e074e5e43774274b7227c4401a68e55dba3774
target: wip/vc-wip-snapshot-20260823-01
history-mode: snapshot
artifact-index-sha256: eda0bdef7a8f3ea7a501b1f9395d4af3c9bbe1e1f110920d2a9e63af7694f875
outbox: .pi/handoff/outbox/vc-wip-snapshot-20260823-01/
```

bundle、所有 SHA256SUMS 和 prepare receipt 已本地 PASS；Windows external Preview 请求位于 `task-todos/WI-GITHUB-HANDOFF-V1-001-WIP-SNAPSHOT-PREVIEW-REQUEST.md`。请求、Preview 与 receipt 是 payload 冻结后产生的控制面记录，刻意不反写 delivery commit；payload 只以其冻结的 commit/tree 和 artifact hash 为准。Preview 返回前不授权 push，Human token 前不得创建或更新远端分支。

## 完成标准

1. alpha.4 manifest 明确标记 `history-mode: snapshot` 和不可直接合并 main 风险；
2. WSL prepare 只读取已确认的 remote-base identity，不要求其为 delivery 祖先；
3. Windows 正式工作树 dirty 不被修改，外部导入与检查只发生在仓库外 staging；
4. 目标 `wip/<delivery-id>` 在验证和 push 前均必须不存在；
5. bundle、manifest、adapter/hash、文件范围和 external checks 通过；
6. Human 接受精确 Preview/token 后才 push；
7. push 后远端 commit/tree 精确核对并回写版本化 receipt；
8. 结果只声明 WIP snapshot remote-verified，不声明 main 集成、PR 可合并或产品验收。

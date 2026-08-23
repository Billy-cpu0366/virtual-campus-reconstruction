---
tags: [虚拟校园, 执行层, GitHub, 交付]
type: delivery-protocol
status: accepted
persistence: persisted
maturity: unverified
updated: 2026-08-23
---

# GitHub 交付中转协议 v1

> 本文件是 WSL 隔离开发成果进入 Windows 正式仓库与 GitHub 的项目级权威流程。动态阶段仍只写根 `task_plan.md`。

## 1. 目标与角色

### 目标

让 Human 日常只需三步：

```text
WSL：生成 delivery-id
Windows 外部 Pi：接管 delivery-id
Human：审查后确认推送
```

不再让 Human 手工搬运多段 Git 命令或普通 diff。

### 固定角色

- **WSL Pi**：实现、测试、浏览器验证、形成统一 delivery 分支并生成离线交付包；可保留 canonical `origin` URL 仅作身份核对，但没有凭据且禁止 fetch/push 等远端 Git。
- **Windows 外部 Pi**：唯一正式仓库与 GitHub 执行方；主动从 WSL 拉取交付包，在隔离 worktree 复核并按授权 push。
- **Human**：决定 dirty 内容、冲突和最终正式仓库 Preview Gate；不负责检查流程完整性。

## 2. 固定边界

- Windows 正式仓库：`D:\复盘\虚拟校园项目重构`。
- canonical remote：`https://github.com/Billy-cpu0366/virtual-campus-reconstruction.git`。
- WSL 交付出口：`.pi/handoff/outbox/<delivery-id>/`。
- WSL 基线入口：`.pi/handoff/inbox/<sync-id>/`。
- Windows 中转区：`C:\Users\inertnet\.pi\agent\github-handoff\<project>\<delivery-id>\`。
- alpha.3 项目 adapter：`03-执行层/git-handoff.adapter.v1.json`；外部隔离 staging 与中转区分离，固定为 `C:\Users\inertnet\.pi\agent\github-handoff-staging\virtual-campus-reconstruction`。
- `main` 必须保持 clean 并只跟随 `origin/main`；不在 `main` 上开发、commit 或直接 push。
- 不执行 `reset`、`clean`、覆盖、擅自 `pull`、force-push；不自动创建/合并 PR。
- `task_plan.md` 仍是项目动态状态唯一权威；handoff 包只负责运输和收据，不建立第二套项目状态。

## 3. 一次性历史对齐

当前 WSL 与 GitHub 尚未共享可靠交付基线，Windows 正式仓库又报告 dirty 和 main 分叉。因此 v1 首次启用必须先完成：

1. 外部 Pi 完整读取正式仓库 `AGENTS.md`。
2. 只读核对路径、canonical `origin`、分支、dirty 文件。
3. 允许 `git fetch origin --prune`；禁止 pull。
4. 记录 fetch 后的 `HEAD`、`origin/main`、merge-base、ahead/behind、local-only、remote-only 和 cherry 等价结果。
5. dirty 内容只登记文件、diff 摘要和未跟踪文件 SHA-256；未经 Human 决定不 add、stash、删除或覆盖。
6. Human 接受保护方案后，为 dirty 内容建立明确保存点；不得把未知修改混进交付。
7. 从 `origin/main` 在仓库外创建 reconciliation worktree，吸收经接受的本地提交与远端提交；冲突必须停在 Human Gate。
8. 在 reconciliation 基线上应用本次地图+玩家+相机+权威文档统一交付，完成正式仓库验证和 Preview Gate。
9. push delivery 分支并核对远端后，由 Windows 生成 canonical Git bundle 送回 WSL。
10. WSL 导入为只读 `canonical/main`；旧 WSL 历史保留，不 reset 或删除。以后新工作只从 canonical 基线开分支。

首次对齐完成前，旧 `wave1-first-wave.diff` 已过期，不得应用。

## 4. 正常入站：GitHub → WSL

每个新工作周期开始前：

1. Windows 外部 Pi 核对正式仓库 clean、origin 和 `origin/main`。
2. fetch 后从确定的 canonical commit 生成 `canonical-main.bundle`。
3. 生成包含 commit、tree、remote 和 SHA-256 的入站 manifest。
4. 外部 Pi 通过 `wsl.exe` 主动复制到 WSL inbox；WSL 不主动写 Windows 路径。
5. WSL 校验 SHA-256 并导入本地 canonical ref。
6. 实现分支必须从该 ref 创建；基线不匹配立即停止。

## 5. 正常出站：WSL → GitHub

WSL 完成有界工作后：

1. 分支实现、Main 接线、权威文档和验证收据必须汇总到一个统一 delivery 分支；不得让“代码在 integration、文档在另一个 master”成为最终交付状态。
2. 运行工作项要求的 typecheck、测试、build、状态一致性、CRLF-aware diff 和浏览器 Gate。
3. 第一层 Gate：Human 接受 WSL 实际预览后，允许 WSL 创建仅供 bundle 运输的本地 delivery commit；这不授权 Windows commit 或 push。
4. 基于共同 canonical 历史生成 Git bundle，而不是普通补丁。
5. 生成不可变 outbox；内容变化必须使用新 delivery-id，不覆盖旧包。

alpha.3 标准 outbox：

```text
.pi/handoff/outbox/<delivery-id>/
├── delivery.bundle
├── manifest.v1.json
├── files.txt
├── prepare-receipt.v1.json
├── logs/
├── SHA256SUMS
└── README.md
```

`manifest.v1.json` 与 prepare receipt 按 `packages/pi-git-handoff/schemas/` 校验，至少绑定 adapter SHA-256、canonical base commit/tree、delivery ref/commit/tree、目标分支、实际文件、Human readiness authority 和未授权 push 边界。检查结果不由 `prepare` 执行；本地 readiness 仍由 `verification-delivery` 证明，Windows 隔离 staging 再执行 adapter 的 external checks。

## 6. Windows 接管与验证

Human 对外部 Pi 只需说：

```text
接管 delivery-id：<id>，按 GitHub 交付中转协议执行。
```

外部 Pi 必须：

1. 主动把 outbox 拉到 Windows 中转区并验证所有 SHA-256。
2. 核对正式路径、origin、main、dirty 和 fetch 后基线。
3. 只有正式仓库 clean、adapter 字节一致且 canonical base 精确匹配后，才允许 alpha.3 external executor 在仓库外 staging 导入 bundle；首次历史对齐仍按第 3 节单独完成，不能让 executor 自动处理 dirty 或分叉。
4. 从 bundle 导入明确 ref；禁止用不明 patch 猜测应用。
5. 比较实际文件清单、commit/tree 和 manifest。
6. 在隔离 staging 重跑 adapter external checks。
7. 第二层 Gate：展示正式仓库实际 diff、检查、风险、目标远端和 executor 生成的精确 confirmation token；Human 确认前不得 push/PR/merge。bundle 内已存在的 WSL 本地 commit 只作待审输入。
8. Human 接受该次精确 Preview 后，只把已验证 commit push 到 adapter profile 派生的非保护分支。
9. push 成功后重新读取远端 ref，核对 commit/tree 并生成版本化 push receipt。

## 7. 自动纠偏与停止条件

可自动处理：

- 中转目录、SHA-256、bundle ref、依赖安装、CRLF 检查和明确的机械路径问题。

必须停止：

- 正式仓库 dirty 未获 Human 处置；
- remote 不匹配；
- canonical base 不匹配或出现未知分叉；
- bundle/manifest/hash 不一致；
- 实际文件超范围；
- merge 冲突、状态文档冲突或测试失败；
- 需要 reset、clean、覆盖、force-push 或语义猜测。

失败时保留现场和收据，不用破坏性命令“恢复干净”。

## 8. 交付收据

alpha.3 按以下不可变证据链记录：

```text
prepare-receipt.v1.json
  -> verify-receipt.v1.json
  -> push-receipt.v1.json
```

收据至少绑定 delivery-id、adapter/artifact 哈希、canonical base、delivery commit/tree、实际文件、检查结果、Human Gate authority、push 目标和远端核对；失败或停止使用新 attempt，不覆盖旧收据。项目权威文档只吸收已接受、可复核的最终收据。

## 9. 当前成熟度

- `accepted`：Human 于 2026-08-21 回复“ok”，接受 Git bundle 双向中转架构、正式 main 保护，以及 WSL 本地预览与 Windows 正式仓库最终预览两层 Gate。
- `persisted`：本协议、决定记录和工作项状态已由提交 `0a105dc` 进入项目仓库。
- `adapter-accepted`：Human 于 2026-08-23 接受 `03-执行层/git-handoff.adapter.v1.json` 的路径、refs、profiles、检查和固定 STOP；本行所在结果提交负责落盘。
- `local-static-verified`：alpha.3 adapter runtime 解析、17 项 Package 测试、outbox ignore、状态一致性、diff 检查与最终独立复核 PASS；未运行 adapter commands 或真实外部流程。
- `unverified`：尚未完成 Windows 正式仓库审计、首次 reconciliation、canonical bundle 入站、alpha.3 真实往返和远端 push。
- 只有首次完整交付收据通过后，v1 才能标为 `verified` 并候选安装到 Windows 全局 Pi workflow。

## 10. alpha.3 Adapter 预演与固定 STOP

当前 adapter 是稳定映射，不记录当前工作项、阶段或 Human Gate。`task_plan.md` 仍是动态状态唯一权威，也不新增 `.ai-workflow/project.yaml`。

预演顺序：

1. 只做 schema/runtime 读取，确认 package 版本、路径格式、remote、refs、checks 和 policy 可被 alpha.3 接受；不得自动执行 checks。
2. 确认 `.pi/handoff/outbox` 被 Git ignore，Windows 中转 artifact 与 external staging 不重叠。
3. 当前 WSL 没有 `refs/pi-handoff/canonical/main`，因此首次 Windows 审计和 canonical bundle 入站完成前，`prepare` 必须 STOP；不得把当前 `master` 猜成 canonical base。
4. `WI-GITHUB-HANDOFF-V1-001` 记录的 Windows dirty、main 分叉和 fetch 后身份仍未解决；adapter 不提供 reset、clean、pull、rebase、自动 reconciliation 或旁路。
5. 只有一个已提交、clean、通过 `verification-delivery` 且 Human 接受的成果，才能选择 `wip` 或 `review` profile 生成新 delivery-id。
6. 本轮只落盘 adapter 与预演合同，不运行 prepare、external checks、fetch、push、PR 或 merge。

Windows 路径存在性、实际 `origin`、凭据、Git object format 和 checks 可执行性保持 `UNKNOWN`，只能在后续单独授权的外部只读 Gate 中验证。

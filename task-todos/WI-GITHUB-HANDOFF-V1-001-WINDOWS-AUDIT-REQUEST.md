---
type: external-audit-request
status: ready-for-external-execution
work-item: WI-GITHUB-HANDOFF-V1-001
authorization: DEC-GITHUB-HANDOFF-WINDOWS-AUDIT-RESUME-001
created: 2026-08-23
source-wsl-commit: 4c92f2d4d6188a0441eb68f38fb86d1f4caf5a7d
---

# Windows 正式仓库首次只读审计请求

> 这是跨环境执行任务包，不是第二套项目状态。动态状态仍以根 `task_plan.md` 为准，Git 中转边界以 `03-执行层/GitHub交付中转协议.md` 和 `task-todos/WI-GITHUB-HANDOFF-V1-001.md` 为准。

## 给 Windows 外部 Pi 的整段消息

```text
接管虚拟校园项目首次 Git 历史对齐的只读审计。

目标：核实 Windows 正式仓库、canonical origin、fetch 后 main 分叉与 dirty 现场，返回固定审计收据；本轮只调查，不处理、不提交、不推送。

权威身份：
- Windows 正式仓库：D:\复盘\虚拟校园项目重构
- 唯一 canonical remote：https://github.com/Billy-cpu0366/virtual-campus-reconstruction.git
- 预期 remote 名：origin
- 远端 base：origin/main
- WSL 已提交的 alpha.3 adapter 基线：4c92f2d4d6188a0441eb68f38fb86d1f4caf5a7d

执行前必须完整读取 Windows 正式仓库自己的 AGENTS.md。随后只读核对实际路径、origin、当前分支、HEAD、工作树和未跟踪文件。origin URL 必须与上面完全一致；不一致立即 STOP。

本轮明确允许：
1. 读取 Git 状态、refs、提交图、diff 元数据和对象身份；
2. 执行一次 git fetch origin --prune；
3. 计算 fetch 后 HEAD 与 origin/main 的 commit/tree、merge-base、ahead/behind、local-only、remote-only 和 cherry 等价；
4. 登记 tracked dirty 的文件名、状态与 diff 摘要；登记 untracked 文件名、大小和 SHA-256；
5. 只读判断潜在冲突和下一步无损保护需求。

本轮明确禁止：
- pull、reset、clean、stash、add、checkout/switch 覆盖、restore、merge、rebase、commit、push；
- 修改、删除、移动或覆盖任何 tracked/untracked 文件；
- 创建 PR、merge PR、更新 main、force-push；
- 读取或输出凭据、token、.env 内容、credential helper 内容或带认证信息的 URL；
- 自动处理 dirty、分叉或冲突；
- 运行 pi-git-handoff prepare/verify-push、项目测试、build 或依赖安装。

若 fetch 因网络或凭据失败，保留现场并返回 STOPPED；不要改 remote、不要尝试替代凭据或绕过。

请返回一个完整的 AUDIT-RESULT-V1，至少包含：
- observed-at；
- repository-path 与 path-match；
- remote-name、sanitized remote URL 与 remote-match；
- fetch：PASS/FAIL/STOPPED、是否更新 refs、错误摘要；
- current-branch；
- HEAD commit/tree；
- origin/main commit/tree；
- merge-base；
- ahead/behind；
- tracked dirty：文件、状态、diff --stat 摘要；
- untracked：文件、大小、SHA-256；
- local-only commits：hash、subject；
- remote-only commits：hash、subject；
- cherry-equivalent 结果；
- potential-conflicts；
- 当前仓库是否满足 clean/exact-base 条件；
- STOP 条件与未解决风险；
- recommended-next-action，只提建议，不执行。

最后明确声明本轮是否执行过任何仓库内容修改、commit、push、PR 或 merge。完成后停止，把整份 AUDIT-RESULT-V1 原样交还给 WSL/Main Pi；不要继续 reconciliation。
```

## Handoff 指针

```yaml
project: virtual-campus-reconstruction
outcome: 建立 Windows/GitHub 与 WSL 的共同 canonical Git 基线
route: Git bundle 双向中转首次历史对齐
phase: windows-readonly-audit-request-ready
accepted-decisions:
  - DEC-GITHUB-HANDOFF-V1-001
  - DEC-PI-GIT-HANDOFF-VC-ADAPTER-001
  - DEC-GITHUB-HANDOFF-WINDOWS-AUDIT-RESUME-001
persisted-state: task-todos/WI-GITHUB-HANDOFF-V1-001.md
changed-files: []
checks:
  - WSL alpha.3 adapter local-static-verified at 4c92f2d
open-risks:
  - Windows dirty 明细尚未复核
  - fetch 后 ahead/behind 与 merge-base 尚未复核
  - refs/pi-handoff/canonical/main 尚未在 WSL 建立
next-action: Windows 外部 Pi 返回 AUDIT-RESULT-V1
read-first:
  - AGENTS.md
  - 03-执行层/GitHub交付中转协议.md
  - task-todos/WI-GITHUB-HANDOFF-V1-001.md
```

## Main 接收门禁

收到结果后，Main 只做证据核对和无损 reconciliation 方案；在 Human 接受该方案前，不授权 Windows 保存 dirty、创建 worktree、合并、提交、生成 canonical bundle 或推送。

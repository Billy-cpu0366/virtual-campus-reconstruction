---
type: external-snapshot-preview-request
status: ready-for-external-preview
work-item: WI-GITHUB-HANDOFF-V1-001
authorization: DEC-GITHUB-HANDOFF-WIP-SNAPSHOT-ROUTE-001
created: 2026-08-24
delivery-id: vc-wip-snapshot-20260823-01
source-wsl-commit: e3c86dd3e4c5be49fa50bfadaaea7fa4e8b8f000
---

# Windows 外部 Pi：WIP Snapshot Preview 接管请求

> 本请求只授权 external verify 和精确 Preview；**没有**授权 push。Windows 正式仓库工作树不得被修改。本请求与后续 Preview/receipt 是 payload 冻结后产生的控制面记录，故不追加入已冻结的 delivery commit；payload 身份永远以本文件列出的 commit/tree 和 artifact hash 为准。

## 给 Windows 外部 Pi 的整段消息

```text
接管虚拟校园项目 WIP snapshot 的 external Preview，不要 push。

交付身份：
- delivery-id：vc-wip-snapshot-20260823-01
- WSL delivery commit：e3c86dd3e4c5be49fa50bfadaaea7fa4e8b8f000
- WSL delivery tree：63e074e5e43774274b7227c4401a68e55dba3774
- target branch：wip/vc-wip-snapshot-20260823-01
- history mode：snapshot（与 main 历史不相连；不能直接作为可合并 main 的 PR）
- canonical remote：https://github.com/Billy-cpu0366/virtual-campus-reconstruction.git
- expected remote base：abd465b8bfddac363bf1e4b13ceb63ddb18ccef9 / 119eb2c0b3d6d946fbe33e6aa1e84c4d01e19ab3
- artifact index SHA-256：eda0bdef7a8f3ea7a501b1f9395d4af3c9bbe1e1f110920d2a9e63af7694f875
- adapter SHA-256：1128138529fb75f68e59d826b6cc6e271c059d49e21da258248d97dae038d778
- required package version：0.1.0-alpha.4

先完整读取 Windows 正式仓库的 AGENTS.md；不要修改该仓库。

从 WSL 复制以下三项到 Windows 中转区；复制后不得修改其内容：
1. `.pi/handoff/outbox/vc-wip-snapshot-20260823-01/`
2. `packages/pi-git-handoff/`（alpha.4 external executor）
3. `03-执行层/git-handoff.adapter.v1.json`

Windows 运行时 adapter 必须与上述 SHA-256 完全一致；artifact 必须通过其 SHA256SUMS。先在复制出的 package 目录运行 `npm run validate`，确认 alpha.4 executor 完整；不得修改 package、adapter 或 artifact。

只允许：
- 读取 Windows 正式仓库路径、origin、object format 和工作树状态；正式仓库 dirty 是预期现场，snapshot 不得处理它；
- external executor 只在 `C:\Users\inertnet\.pi\agent\github-handoff-staging\virtual-campus-reconstruction` 下创建新的隔离 staging，且必须与正式仓库路径分离；
- executor 为 identity/base 核对执行 remote refresh，并在 staging 导入 bundle、重跑 adapter external checks、生成 verify receipt 和 Preview。

明确禁止：
- 修改 Windows 正式仓库或其 tracked/untracked 内容；
- reset、clean、stash、add、restore、checkout/switch 覆盖、merge、rebase、commit；
- push、PR、merge、更新 main、force-push；
- 覆盖任何已存在的 `wip/vc-wip-snapshot-20260823-01`；
- 读取/输出凭据、access token、.env 或认证 URL；executor 生成的 `confirmationToken` 不是凭据，必须按本请求返回。

用复制出的 alpha.4 executor运行：
node scripts/verify-push.mjs --external --adapter <copied-adapter> --artifact <copied-outbox>

不要提供 `--confirm-token` 或 `--interactive`。它必须停在 `push-authorization-required`，并返回完整 Preview 与 confirmationToken。

返回 EXTERNAL-SNAPSHOT-PREVIEW-V1，包含：
- adapter/artifact/package 校验结果和 SHA-256；
- Windows 正式仓库路径、sanitized origin、object format、dirty 状态（只读）；
- fetch/remote-base commit/tree 核对；
- staging 路径，确认不与正式仓库重叠；
- verify receipt 路径与 SHA-256；
- delivery commit/tree、文件数、external checks；
- target branch 不存在的核对；
- 完整 Preview 和 confirmationToken；
- 未解决风险：snapshot 不可直接合并 main、正式仓库 dirty 未处理；
- 明确声明未执行 push、PR、merge、commit 或正式仓库内容修改。

完成 Preview 后停止。不要自行继续 push；等待 Human 确认精确 token。
```

## 当前本地证据

| 项目 | 值 |
|---|---|
| prepare receipt | `prepare-receipt.v1.json`，status `PASS` |
| SHA256SUMS | 全部 payload `OK` |
| Git bundle | verify `PASS`，完整历史，SHA-1 |
| manifest file count | 763 |
| local readiness | typecheck、32 文件/168 测试、build、browser smoke、状态一致性均 PASS |
| snapshot risk | `snapshot delivery is not directly mergeable into main` |

## Main 接收 Gate

收到 `EXTERNAL-SNAPSHOT-PREVIEW-V1` 后，只展示 exact Preview、checks、目标分支、风险和 token。Human 明确确认该 token 前，不授权 push；确认后也只允许 alpha.4 create-only lease 创建这个新 WIP 分支。

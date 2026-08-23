---
type: local-correlation-result
status: local-object-verified
work-item: WI-GITHUB-HANDOFF-V1-001
source-audit: task-todos/WI-GITHUB-HANDOFF-V1-001-WINDOWS-AUDIT-RESULT-V1.md
source-audit-sha256: 21b76920f6a1928a608dc94226a4b9b341322fba090b64329d5fecfe75b262da
checked: 2026-08-23
---

# WSL 对 Windows 审计哈希的本地对象核对 V1

> 本文件只证明当前 WSL Git 对象库的本地可见关系，不独立证明 Windows 或 GitHub 运行时事实。

## 当前 WSL

- HEAD：`978c0a691d1ed5846f1f1336084fb48931bc906a`
- tree：`831fca972dfc9598d209786b72fc7e542b35b13c`
- root commit：`c8b2fa426a250dfabbc884aec739a1f3a5798e61`

## 报告对象可用性

| 对象 | WSL 状态 |
|---|---|
| Windows local HEAD `71a554304a56006071860dfc02b0a6c2744cc242` | absent |
| reported origin/main `abd465b8bfddac363bf1e4b13ceb63ddb18ccef9` | present，位于 `refs/remotes/audit/main` |
| Windows local/remote merge-base `4f980c5645072cf716e45efc089979c35696503f` | present |

## 历史关系

- 当前 WSL HEAD 与 reported origin/main 双向均不是祖先。
- `git merge-base HEAD <reported-origin-main>` exit `1`，没有共同 merge-base。
- reported origin/main root：`810c9c16dec3a3805926a4d46db9186e5f4ce996`，与当前 WSL root 不同。
- 因 Windows local HEAD 对象缺失，WSL 不能判断其 18 个 local-only commits 是否被当前 WSL 历史以改写或语义等价方式吸收。

## 结论

1. 不能把 reported origin/main 直接设为当前 WSL HEAD 的普通祖先，也不能执行普通 fast-forward/merge 假装历史已共享。
2. 不能仅凭提交标题决定丢弃 Windows 18 个本地提交。
3. reconciliation 前必须先取得包含 Windows local main 与 origin/main 的离线 Git bundle，以及 3 个 tracked `.M` 和 1 个 untracked 文件的原始字节保全证据。
4. 后续若连接两套独立历史，必须使用显式、经 Human 接受的 reconciliation 方案，并在隔离 worktree 中逐项处理语义；禁止重写或 force-push 既有历史。

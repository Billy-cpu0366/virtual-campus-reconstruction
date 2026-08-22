---
work-item: WI-VISIBLE-CONTENT-WAVE-001
phase: P3-parallel-implementation
status: active-p3-implementation
p2-design-commit: c21f7ce8ddeafc071aa77988d69fe2d1b538637e
authorization: DEC-VISIBLE-WAVE-P2-001
branch: feature/03-content-visible-wave
parent-report: 0a5091db237ca7cd6be6a4b8ef24da6ac43abf97
---

# 03内容线：P2批准的P3实现包

## 目标

交付真实英文About、Projects、Memo内容，并让Memo 6成为正常Play后的首个真人可发现内容。不得只交payload或test hook。

## 冻结行为

- payload逐字绑定P1报告中的公开HTML/Bundle证据；不猜Slovak正文。
- Memo 6使用`card6_base.webp`和公开正文；方向引导非阻塞，不传送、不自动打开modal。
- 正常路线候选左36格、上7格；以实际碰撞和`distance < 30`为准。
- 保持single-active、manual suppression、visited receipt、图片失败保正文、关闭/离开/重入和teardown。
- About/Projects/Memo三类内容都必须可呈现；正常路径门禁至少覆盖Memo 6。

## P2.1前置修正

03已在实现前正确停止。Main共享contract/resolver commit被cherry-pick并验证clean前，本包不再授权写功能代码；恢复后仍只写03 owner，不修改resolver/UI。

## 允许文件

- `src/content/**`
- 明确需要的`src/zone/**`、`src/interact/**`
- `tests/content/**`、`tests/zone/**`、`tests/interact/**`
- 已批准公开内容资源的独占目录；不得修改`sample/`
- 本任务执行报告

禁止Main共享入口、`src/game-ui/**`、API/权威文档和通用抽象。

## 检查与交付

定向测试覆盖payload、资源状态、`<30`、manual close/re-entry、图片失败和destroy；再跑typecheck、全测试、build和CRLF-aware范围检查。只提交允许文件，返回commit/tree/parent/clean。完成后停在ready-for-integration，不push。

---
title: 发布前预览确认门禁落盘
type: task-todo
status: completed
version: v1.3.0
created: 2026-08-18
updated: 2026-08-18
decision-ref: DEC-HUMAN-PREVIEW-GATE-001
related-decision-ref: DEC-PR-DELIVERY-END-001
branch: docs/git-pr-workflow
---

# 发布前预览确认门禁 Todo

> 本文件记录本次非简单治理任务的执行与等待状态；规则正文以 `AGENTS.md` 和 `03-执行层/README.md` 为准。本轮先向任务请求者展示经校验的最终效果和验证结果，明确认可发布前不提交本轮规则修改、不 push、不更新 PR。

## 任务体量与范围

- 判定：非简单治理任务。
- 目标：把 Git/PR 流程补成“完成修改与校验 → 向任务请求者展示最终效果和验证结果 → 明确认可发布 → 才 commit、push、创建或更新 PR → Codex 到此停止”。
- 写入范围：`AGENTS.md`、`03-执行层/README.md`、`决策记录.md`、`task_plan.md`、本 Todo。
- 明确不改：`sample/`、`src/`、`tests/`、系统卡、历史归档正文和既有未跟踪快捷方式。
- 发布边界：本轮预览阶段不 push、不更新 Draft PR #2、不合并 `main`。

## Todo

- [x] 判断任务体量并确认这是现有 Git/PR 规范的追加门禁。
- [x] 检查工作区和分支，识别并保留不属于本任务的未跟踪快捷方式。
- [x] 拉取最新 `main`，将其本地合入 `docs/git-pr-workflow`，保留上游运行时记录与现有 Git 规则。
- [x] 机械枚举 Markdown，定位所有现役 commit、push、PR 和 Human 确认口径。
- [x] 创建本 Todo，记录范围、步骤、验证与暂停点。
- [x] 更新 `AGENTS.md` 的发布前预览确认门禁、批准失效条件和最终汇报要求。
- [x] 更新 `03-执行层/README.md` 的权威分步流程与发布命令顺序。
- [x] 在 `决策记录.md` 登记 `DEC-HUMAN-PREVIEW-GATE-001` 并接入既有 Git/PR 决定。
- [x] 在 `task_plan.md` 同步长期门禁，不改变当前实现工作项。
- [x] 根据 Human 澄清移除特定身份和 PR 后续流程，明确验证只用于发布前确认、Codex 交付止于 PR。
- [x] 更新受影响正式文档的版本、日期与修订记录。
- [x] 运行规则唯一性、状态一致性、Markdown、Git diff 与变更范围检查。
- [x] 整理最终 diff、行为效果、验证结果和待发布范围，供本轮发布前预览。
- [x] 任务请求者已明确回复“可以发布”（2026-08-18）。
- [x] 获得发布批准后，确认批准后无实质内容漂移，允许 commit 本轮文件。
- [x] 获得发布批准后，push `docs/git-pr-workflow` 并更新 Draft PR #2；PR 更新后停止，不处理或规定后续流程。

## 当前证据

- 最新 `origin/main`：`abd465b`；包含其他成员的运行时修复提交。
- 当前规范分支：`docs/git-pr-workflow`。
- 本地同步提交：`0156eaa`（合入最新 `main`）；发布时发现远端存在等价合并提交 `5e5767d`，已在保留预览内容的前提下安全整合。
- 规则提交：`a589ff7`（`docs: gate PR publishing on preview approval`）。
- 远端整合提交：`34b8ee0`；合并前后5份本轮文档的实质 diff 为 0。
- 既有远端 PR：Draft PR #2 已更新：`https://github.com/Billy-cpu0366/virtual-campus-reconstruction/pull/2`。
- 工作区残留：一个未跟踪 `.lnk` 快捷方式，不属于本任务，保持原样。

## 验证结果

- `git diff --check`：PASS；仅有 LF/CRLF 转换提示，无空白错误。
- `python scripts/check-state-consistency.py`：PASS；当前工作项保持 `WI-RENDER-PLAYABLE-001`，16 张执行卡无漂移。
- 规则覆盖：`AGENTS.md`、执行层操作手册、决策记录和 `task_plan.md` 均已写入“先展示并明确认可，后暂存/commit/push/PR”的顺序。
- 批准有效性：已明确规定实质内容变化、冲突处理改变内容、验证结论变化或范围扩大时必须重新展示和批准。
- PR 交付边界：验证结果只在发布前展示给任务请求者；明确认可发布后，Codex 完成分支提交、推送和 PR 创建/更新即停止，PR 后续流程不在本任务范围内。
- Git 范围：规则提交只包含计划内5个文档；既有未跟踪快捷方式未暂存、未提交。
- 远端状态：`docs/git-pr-workflow` 已推送至 `origin/docs/git-pr-workflow`；Draft PR #2 的标题和说明已同步本轮最终口径。
- 变更范围：本轮实质修改只涉及计划内 5 个文档；既有未跟踪快捷方式保持原样。
- 发布批准：任务请求者已在查看上述效果和验证结果后明确回复“可以发布”；批准范围与当前实质 diff 一致。

## 修订记录

| 版本 | 日期 | 修改内容 |
|---|---|---|
| v1.3.0 | 2026-08-18 | 记录任务请求者批准、规则提交、远端分支安全整合、push 成功与 Draft PR #2 更新证据；任务交付完成并止于 PR。 |
| v1.2.0 | 2026-08-18 | 根据 Human 澄清改为共享中性口径：验证只用于发布前确认，Codex 交付止于创建/更新 PR，不指定个人身份；PR 后续流程不在本任务范围内。 |
| v1.1.0 | 2026-08-18 | 完成规则修改和本地校验，状态转为等待任务请求者发布前预览确认；尚未暂存、commit、push 或更新 PR。 |
| v1.0.0 | 2026-08-18 | 创建发布前预览确认门禁 Todo，明确预览阶段暂停 commit/push/PR 更新。 |

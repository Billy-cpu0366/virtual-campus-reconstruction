---
title: Git 功能分支与 PR 协作规范落盘
type: task-todo
status: in-progress
version: v1.0.0
created: 2026-08-18
updated: 2026-08-18
decision-ref: DEC-GIT-PR-WORKFLOW-001
branch: docs/git-pr-workflow
---

# Git 功能分支与 PR 协作规范落盘 Todo

> 本文件只记录本次非简单治理任务的范围、步骤和验证证据；Git 协作规则的权威正文仍是 `AGENTS.md` 与 `03-执行层/README.md`，Human 决定登记在 `决策记录.md`。

## 任务体量与范围

- 判定：非简单治理任务。
- 原因：需要替换现役 Git 交付流程，消除“直接提交或推送 main”的旧口径，并同步 AI 入口、操作手册、Human 决策和动态计划说明。
- 写入范围：`AGENTS.md`、`03-执行层/README.md`、`决策记录.md`、`task_plan.md`、本 Todo。
- 明确不改：`sample/`、`src/`、`tests/`、系统卡、历史归档正文和旧 Phaser 项目。
- Git 终态：只在 `docs/git-pr-workflow` 提交和推送；创建 PR 供 Human 检查；不自行合并到 `main`。

## Todo

- [x] 分析任务体量、规则归属、替代关系和验收标准。
- [x] 执行 `git status` 与 `git branch --show-current`，确认起始工作区干净且位于 `main`。
- [x] 拉取最新 `origin/main`，基于最新 `main` 创建 `docs/git-pr-workflow`。
- [x] 机械枚举 Markdown，并搜索现役 Git 提交、推送、分支与 PR 规则。
- [x] 创建本轮 Todo，记录范围、步骤、验证和 Git 计划。
- [x] 更新 `AGENTS.md` 的任务启动、main 保护、分支、提交、推送、PR 和多人同步规则。
- [x] 更新 `03-执行层/README.md` 的权威 Git 操作流程。
- [x] 在 `决策记录.md` 登记 `DEC-GIT-PR-WORKFLOW-001`，明确其替代旧决定中的直接交付口径。
- [x] 在 `task_plan.md` 同步长期协作约束，不改变当前实现工作项。
- [x] 更新全部受影响正式文档的版本、日期与修订记录。
- [x] 运行规则唯一性、状态一致性、Markdown、Git diff 与变更范围检查。
- [ ] 更新本 Todo 为完成状态并记录验证结果。
- [ ] 只提交本轮文件并推送 `docs/git-pr-workflow`。
- [ ] 创建或明确交付 Pull Request；不自行合并 `main`。

## 当前证据

- 起始状态：`main...origin/main`，工作区无未提交修改。
- 远端同步：`git pull --ff-only origin main` 返回 `Already up to date.`。
- 当前任务分支：`docs/git-pr-workflow`。
- 变更前冲突面：`AGENTS.md`、`03-执行层/README.md`、`决策记录.md`、`task_plan.md` 存在未明确限定为功能分支的 commit/push 口径；现已统一替换或标明替代关系。
- 历史记录：`migration-history/` 与 `task-todos/2026-08-17-ai-execution-workflow.md` 记录当时直接推送 `main` 的事实，只作为历史证据，不改写。

## 验证结果

- `git diff --check`：PASS；只有 LF/CRLF 转换提示，无空白错误。
- `python scripts/check-state-consistency.py`：PASS；当前工作项保持 `WI-SYS-CAMERA-CORE-001`，16 张执行卡无状态漂移。
- 分支保护：当前分支为 `docs/git-pr-workflow`，不是 `main`。
- 规则唯一性：`DEC-GIT-PR-WORKFLOW-001` 在仍生效决定表中恰好一行；现役文档中的 `git push origin main` 只出现在明确禁止语境。
- 文档元数据：`AGENTS.md` 与执行层操作手册升级为 `v2.0.0`；`决策记录.md` 与 `task_plan.md` 升级为 `v1.1.0`；日期和修订记录均已同步到 2026-08-18。
- Git 范围：只涉及计划内 5 个文档；`sample/`、`src/`、`tests/`、系统卡与历史归档正文无修改。
- Markdown：本轮规则正文未新增 Markdown 链接；既有链接目标不受本次修改影响。

## 修订记录

| 版本 | 日期 | 修改内容 |
|---|---|---|
| v1.0.0 | 2026-08-18 | 创建本轮 Todo，记录 Git 启动检查、功能分支、PR 规则替代范围与交付计划。 |

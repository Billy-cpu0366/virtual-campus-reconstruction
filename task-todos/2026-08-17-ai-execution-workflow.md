---
title: AI 任务执行与交付闭环规则落盘
type: task-todo
status: in-progress
version: v1.0.0
created: 2026-08-17
updated: 2026-08-17
decision-ref: DEC-AI-EXEC-WORKFLOW-001
---

# AI 任务执行与交付闭环规则落盘 Todo

> 本文件只记录本次非简单任务的执行清单与验证结果，不替代 `task_plan.md` 的动态状态，也不替代 `AGENTS.md` 和 `03-执行层/README.md` 的长期规则。

## 任务体量

- 判定：非简单治理任务。
- 原因：需要同时更新 AI 规则、操作手册、Human 决策记录、动态计划说明、文档版本与修订信息，并完成 Git 提交和远端推送。
- 写入范围：`AGENTS.md`、`03-执行层/README.md`、`决策记录.md`、`task_plan.md`、本 Todo 文档。
- 明确不改：`sample/`、`src/`、`tests/`、旧 Phaser 项目和历史归档正文。

## Todo

- [x] 分析任务体量、规则归属和受影响文档。
- [x] 创建本轮 Todo 文档并声明非权威边界。
- [x] 更新 `AGENTS.md` 的强制启动与交付规则。
- [x] 更新 `03-执行层/README.md` 的任务分级、Todo、分步执行、校验、文档版本、提交和推送流程。
- [x] 在 `决策记录.md` 登记 Human 决定 `DEC-AI-EXEC-WORKFLOW-001`。
- [x] 在 `task_plan.md` 同步本决定的长期效力，不改变既有当前实现工作项。
- [x] 运行文档结构、链接、状态一致性和 Git 范围检查。
- [ ] 更新本 Todo 为完成状态，并记录验证结果和修订信息。
- [ ] 只提交本轮相关文件并正常推送 `origin/main`。

## 验证结果

- `git diff --check`：PASS（仅有工作区 LF/CRLF 提示，无空白错误）。
- `python scripts/check-state-consistency.py`：PASS，当前工作项保持 `WI-SYS-CAMERA-CORE-001`，16 张执行卡无漂移。
- 正式文档元数据：`AGENTS.md`、`03-执行层/README.md`、`决策记录.md`、`task_plan.md` 均已包含 `version: v1.0.0`、`updated: 2026-08-17` 和修订记录。
- 决策唯一性：`DEC-AI-EXEC-WORKFLOW-001` 在仍生效决定表中恰好一行。
- 链接：本轮新增内容未新增 Markdown 链接；操作手册原有带圆括号文件名的目标 `03-内容线/02-世界交互(弹窗).md` 已确认存在。
- Git 范围：只有计划内 5 个文件有变更；`sample/`、`src/`、`tests/` 和历史归档无变化。

## 修订记录

| 版本 | 日期 | 修改内容 |
|---|---|---|
| v1.0.0 | 2026-08-17 | 创建本轮 Todo，记录任务体量、范围、步骤和交付闭环。 |

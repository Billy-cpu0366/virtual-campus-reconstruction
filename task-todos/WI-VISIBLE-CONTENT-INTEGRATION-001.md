---
work-item: WI-VISIBLE-CONTENT-INTEGRATION-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 03-content
phase: P4-selective-integration-audit
status: accepted-read-only-audit
authorization: DEC-CONTENT-ENGLISH-INTEGRATION-001
root-branch: master
root-baseline-commit: a2042acb6f1466ec7f8209e3531e6da57b974c1b
root-baseline-tree: 0f4c48fccd2a60aece9eb1de98b1b1f7fdff13a1
candidate-branch: integration/visible-product-wave
candidate-commit: 1d163939c6b57cc9dcdab9d3dd98dd5c2c7e187e
candidate-tree: e051be264b4ce152e238406da806191f82968abd
merge-base: 638d4c60347d6adf323e612b61595e73afb2bd05
human-gate: route-accepted-awaiting-implementation-scope
updated: 2026-08-28
---

# 已验收英文内容选择性集成

## 已接受路线

Human选择“选择性集成英文内容”，接受先建立独立集成工作项；不接受把`integration/visible-product-wave`整条历史分支直接合并到根`master`。

## 目标

从根`master`建立可审查的内容集成方案，只把已通过Human Gate的About、Projects、Memo1–6及其必要运行时依赖带入；保持NPC、相机、车辆、动效和其他未授权范围的边界。

## 当前阶段：只读依赖审计

- **基线说明**：根工作树保留5个既有未跟踪文件（3张PNG、2个规则脚本），本任务不读取其内容、不修改、不纳入提交；它们不属于本次审计变更。

1. 对照根基线`0cbf995`和候选`1d16393`的提交、文件与运行时入口；
2. 划分内容最小依赖闭包、Main共享接线、候选中无关历史改动；
3. 检查是否存在必须一起移植的`CampusScene`、入口、构建资源、测试或运行时依赖；
4. 形成实现包：允许文件、禁止文件、移植顺序、验证命令、停止条件和剩余风险；
5. 审计完成后停在`implementation-authorization`，由Main复核并另行进入代码实现Gate。

## 允许读取

- 根`master`当前跟踪文件及其Git历史；
- 候选worktree`.pi/worktrees/visible-product-integration`及其Git历史；
- 已落盘的内容任务卡、SYS-ZONE、SYS-INTERACT、SYS-GAME-UI、总账、`task_plan.md`和决定记录；
- 为确认依赖所需的公开证据索引，不修改任何证据。

## 禁止操作

- 审计阶段不得写入或修改根/候选的`src/`、`game/`、`public/`、`tests/`、`sample/`；
- 不得`merge`、`cherry-pick`、`reset`、`clean`、覆盖既有未跟踪文件或切换他人工作树；
- 不得把NPC、相机、车辆、动效、完整UI、Slovak、CV/Contact/Tech带入内容授权；
- 不得执行push、PR、远端同步或修改`main`。

## 输出与客观检查

- 输出一份短审计报告，列出文件路径、提交来源、最小依赖闭包和排除项；
- `git diff --stat/name-status`、候选与根工作树状态、merge-base和提交关系可复核；
- 明确所有不能在当前证据下安全选择的依赖，并转为UNKNOWN；
- 若发现内容无法与未授权owner隔离，立即停止并报告冲突，不扩大范围。

## 下一道门

只有依赖审计、实现包和范围差异经Main复核后，才能提出代码实现授权；实现完成后还必须通过定向/全量自动验证和新的普通production Human Gate。候选不会自动合并到根`master`。

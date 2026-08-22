---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
status: active-p1-parallel-recon
phase: p1-parallel-recon
authorization: DEC-THREE-BOARD-VISIBLE-WAVE-001
code-baseline: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
code-baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
p0-plan-commit: 3f0fc0fcf4cbc6d906ab022f2b7061ab373e8f7e
p0-plan-tree: 9c2e8b0b854a09d068c6de8e91ef9178f484c4f8
worktree-baseline-status: verified-clean
human-visual-gate-required: true
documentation-close-status: blocked-by-visual-gate
updated: 2026-08-22
---

# 三板块可见成果并行波

## 目标

03内容线、04独立件、05旁支作为三个一级板块并行推进；Main另设产品入口/integration worktree。下一版必须让Human直接看到Loading/Play、秒级相机入场、实际内容、NPC/路线和FX变化。

## 固定约束

- 六点约111秒camera sequence不能作为正常入口；其原站真实触发保持UNKNOWN。
- `sample/`只读；不猜未公开内容或资源。
- 四个worktree从同一immutable代码基线创建。
- P1只调查设计；P2由Main冻结接口、文件所有权和视觉目标。P2 Human Gate通过前不写正式功能代码。
- A/B/C不修改`game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`或共享browser smoke；这些归Main integration。
- no-code/调查报告不能冒充板块可见交付。
- 自动检查不能替代Human视觉Gate；Human通过前不得关闭文档。
- 不push、不PR、不操作Windows正式仓库。

## 四个worktree

| 角色 | 分支 | 路径 | P1任务 |
|---|---|---|---|
| 03内容线 | `feature/03-content-visible-wave` | `.pi/worktrees/03-content-visible` | 实际内容、图片/链接/双语证据、首个内容点可发现性 |
| 04独立件 | `feature/04-independent-visible-wave` | `.pi/worktrees/04-independent-visible` | Loading/Play/Retry、正式Game UI、Entity真实复用审计 |
| 05旁支 | `feature/05-side-visible-wave` | `.pi/worktrees/05-side-visible` | 选择有公开证据的NPC、路线和FX最小可见纵切片 |
| Main入口集成 | `integration/visible-product-wave` | `.pi/worktrees/visible-product-integration` | 原站入口触发链、短相机过渡、正常构图和最终共享接线 |

## P0创建收据

- 计划提交：`3f0fc0fcf4cbc6d906ab022f2b7061ab373e8f7e`，tree=`9c2e8b0b854a09d068c6de8e91ef9178f484c4f8`，root clean。
- 03内容、04独立件、05旁支、Main integration四个worktree均为`8ae7692b45b16f4b0ce6e96faa448197734db3b0`，tree=`c825bb6a99f363e30a665d58d4a2eadf7b18f537`，状态clean。
- P0 Gate PASS，当前进入P1四路并行调查。

## 阶段

1. **P0 PLAN/WORKTREE**：本计划落盘、验证、Human创建四个clean worktree。
2. **P1 PARALLEL RECON**：四路并行提交FACT/INFERRED/UNKNOWN、可见目标、失败路径和实现候选。
3. **P2 MAIN DESIGN**：Main合并报告，冻结接口/所有权/验收；Human一次性确认Loading、相机、内容引导和NPC/FX目标。
4. **P3 PARALLEL IMPLEMENT**：三个板块并行实现；Main入口线实现共享状态机和相机过渡。
5. **P4 BRANCH REVIEW**：每路定向测试、两build、范围和独立审查。
6. **P5 MAIN INTEGRATION**：Main串行合并并完成共享接线。
7. **P6 AUTOMATED VERIFY**：全量测试和真实浏览器回归。
8. **P7 HUMAN VISUAL GATE**：Human先看实际效果；失败则退回，不关闭文档。
9. **P8 AUTHORITY CLOSE**：仅Human通过后回写系统卡/总账/状态并本地提交。

## 本轮成功标准

- 页面有真实Loading/Play/Retry，不以空白画布代替。
- 正常入口是秒级过渡，不触发111秒序列；最终镜头构图由Human接受。
- 玩家能发现并打开至少About、Projects、Memo三类实际证据支持内容。
- 场景中至少有一个真实NPC、一段可见路线行为和一个真实FX。
- production/test-hooks、生命周期、桌面/移动端和旧地图/玩法回归通过。
- Human明确签署视觉通过后才允许P8。

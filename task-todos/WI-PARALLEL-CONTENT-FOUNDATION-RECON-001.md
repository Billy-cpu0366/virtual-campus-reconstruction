---
work-item: WI-PARALLEL-CONTENT-FOUNDATION-RECON-001
status: active-window-preparation
work-item-type: parallel-investigation
branch-owner: master
authorization: DEC-PARALLEL-CONTENT-FOUNDATION-RECON-001
updated: 2026-08-21
---

# 内容与实体基础三窗口并行调查计划

## 1. 目标

并行查清三个彼此独立、但会影响下一阶段内容纵切片的系统：

- 窗口 A：`SYS-INTERACT` 世界交互与弹窗状态；
- 窗口 B：`SYS-GAME-UI` 游戏 UI 的呈现与响应式边界；
- 窗口 C：`SYS-ENTITY` 玩家/NPC/车辆的创建、更新与销毁边界。

本工作项只调查并形成设计输入，不写正式代码、不晋升系统状态、不预授权后续实现。

## 2. 为什么开三个窗口

三个调查可以独立取证：

- A 负责“什么时候打开/关闭、状态怎么变”，不决定 UI 长什么样；
- B 负责“DOM/Phaser 怎么呈现、移动端怎么显示”，不决定业务状态；
- C 负责“运行对象归谁创建和销毁”，不碰弹窗与 UI。

正式实现不能三线并行：A/B 最终会共同争用 `CampusScene`、控制门和页面 DOM；C 后续会与 NPC/Route 争用实体所有权。因此本轮只并行调查，Main 汇总后再决定实现顺序。

## 3. 窗口与 worktree

| 窗口 | 分支 | worktree | 唯一写入产物 |
|---|---|---|---|
| A INTERACT | `recon/content-interact` | `.pi/worktrees/content-interact-recon` | `task-todos/WI-PARALLEL-CONTENT-FOUNDATION-RECON-001-窗口A-SYS-INTERACT调查报告.md` |
| B GAME-UI | `recon/game-ui` | `.pi/worktrees/game-ui-recon` | `task-todos/WI-PARALLEL-CONTENT-FOUNDATION-RECON-001-窗口B-SYS-GAME-UI调查报告.md` |
| C ENTITY | `recon/entity-lifecycle` | `.pi/worktrees/entity-lifecycle-recon` | `task-todos/WI-PARALLEL-CONTENT-FOUNDATION-RECON-001-窗口C-SYS-ENTITY调查报告.md` |

三个 worktree 必须从同一个 clean 规划提交创建。当前运行时参考固定为相机入口修复提交 `798eda6`；窗口可用 `git show 798eda6:<path>` 只读核对实现，不把 integration 分支改成调查分支。

## 4. 文件所有权

### 调查窗口

- 只读 `sample/` 白名单证据、当前系统卡、API 契约、内容索引和提交 `798eda6` 的必要实现；
- 只写自己的一份调查报告；
- 不修改系统卡、总账、API、`task_plan.md`、决策记录、其他报告、`src/`、`game/`、资源或测试；
- 各窗口完成客观检查后可提交自己的报告分支，不 merge、不 push。

### Main 独占

- 三份窗口任务卡与总计划；
- `task_plan.md`、`决策记录.md`、`工作日志.md`；
- `03-执行层/` 系统卡、`00-总账.md`；
- `02-接口层/API契约表.md`；
- 报告复核、冲突裁决、设计候选整合与 Human Gate。

## 5. 执行流程

```text
Main 固化 clean 规划基线
  → 同时创建 A/B/C 三个 worktree
  → 三窗口按各自白名单只读调查
  → 每窗只提交一份 FACT/INFERRED/UNKNOWN 报告
  → Main 检查提交范围和证据定位
  → Human Gate 1：接受/退回三份调查结论
  → Main 跨报告对账接口、状态和生命周期
  → 形成三张系统卡的设计候选（仍不写代码）
  → Human Gate 2：逐系统接受设计
  → accepted 后同步决策/卡/总账/API/task_plan并提交
  → 再独立选择实现工作项
```

## 6. 交接合同

每份报告必须包含：

1. Scope 与停止条件；
2. `FACT / INFERRED / UNKNOWN` 表；
3. 证据文件、可定位位置和查证方法；
4. 原站状态/生命周期流程图；
5. 与另外两系统的输入输出，但不擅自冻结真实函数签名；
6. 失败、关闭、销毁与重复触发路径；
7. 设计候选及其代价/风险，明确标记 `PROPOSED`；
8. 仍需 Human 决定的问题；
9. 文件范围、检查命令和 commit 收据。

没有直接证据时保持 UNKNOWN；不得为了让三条线“看起来能拼起来”而补猜。

## 7. Main 汇总时的接口边界

- `SYS-ZONE → SYS-INTERACT`：只沿用已冻结的 `menuId`、进入/离开、visited/手动关闭语义；真实签名待设计 Gate。
- `SYS-INTERACT → SYS-GAME-UI`：A 提出状态需求，B 提出呈现能力；由 Main 对账，任何窗口不能单方面冻结。
- `SYS-INTERACT / GAME-UI → 玩法控制门`：是否暂停、何时恢复必须有原站证据或明确重构 DECISION。
- `SYS-ENTITY → NPC/ROUTE`：只有直接证据证明稳定共享生命周期后，才允许提出通用实体抽取；本轮不实现。

## 8. Gate 与停止条件

### 启动 Gate

- 相机入口修复 `798eda6` 已通过 typecheck、36文件/192测试、两种 build、CRLF-aware diff，且 Human 实时预览通过；
- 本计划与三个窗口包已提交；
- 三个 worktree 从同一个 commit 创建并 clean。

### 窗口停止条件

- 需要读取未公开资源、source map、私有路径或扩大网络采集；
- 证据同时落入另一窗口且会导致重复结论；
- 必须修改权威卡/API/代码才能继续；
- 发现现有文档与公开证据直接冲突；
- 达到本窗口问题清单后停止，不顺手调查下一系统。

## 9. 本轮不做

- 不实现 Zone/Interact/Game UI/Entity/NPC/Route/FX；
- 不创建开始页或把航拍重新接回入口；
- 不恢复 GitHub push、PR 或 merge；
- 不同时开启三个正式实现窗口；
- 不把调查报告当作 accepted 设计或项目事实源。

## 10. 调查后的推荐实施顺序（仅候选）

```text
内容纵切片：SYS-ZONE runtime
  → SYS-INTERACT runtime
  → SYS-GAME-UI
  → 一个真实作品弹窗闭环

旁支基础：SYS-ENTITY
  → SYS-NPC
  → SYS-ROUTE
  → SYS-FX
```

最终顺序必须依据三份报告和 Human Gate 重新确认。

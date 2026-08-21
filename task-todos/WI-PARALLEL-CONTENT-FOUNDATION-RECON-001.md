---
work-item: WI-PARALLEL-CONTENT-FOUNDATION-RECON-001
status: active-parallel-investigation
work-item-type: parallel-investigation
branch-owner: master
authorization: DEC-PARALLEL-CONTENT-FOUNDATION-RECON-001
definition-commit: db1f878
shared-baseline: 42e445d
updated: 2026-08-21
---

# 内容与实体基础三窗口并行调查与设计计划

## 1. 目标

并行查清并形成三个彼此独立、但会影响下一阶段内容纵切片的详细设计：

- 窗口 A：`SYS-INTERACT` 世界交互与弹窗状态；
- 窗口 B：`SYS-GAME-UI` 游戏 UI 的呈现与响应式边界；
- 窗口 C：`SYS-ENTITY` 玩家/NPC/车辆的创建、更新与销毁边界。

本工作项完成调查、详细设计候选与 Main 权威合并，不写正式代码、不预授权后续实现。Human 已预授权 Main 在客观复核通过后直接完成设计落盘，无需在报告和设计之间再次等待确认。

## 2. 为什么开三个窗口

三个调查可以独立取证：

- A 负责“什么时候打开/关闭、状态怎么变”，不决定 UI 长什么样；
- B 负责“DOM/Phaser 怎么呈现、移动端怎么显示”，不决定业务状态；
- C 负责“运行对象归谁创建和销毁”，不碰弹窗与 UI。

正式实现不能三线并行：A/B 最终会共同争用 `CampusScene`、控制门和页面 DOM；C 后续会与 NPC/Route 争用实体所有权。因此本轮只并行调查与设计，Main 汇总后确定候选实现顺序，但不会启动实现。

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
- 报告复核、冲突裁决、设计整合与本轮预授权关闭。

## 5. 执行流程

```text
Main 固化 clean 规划基线
  → 同时创建 A/B/C 三个 worktree
  → 三窗口按各自白名单只读调查并完成七格设计候选
  → 每窗只提交一份 FACT/INFERRED/UNKNOWN 调查＋设计报告
  → Main 检查提交范围、证据定位和设计完整性
  → 不合格报告由 Main 直接退回对应窗口修正
  → Main 跨报告对账接口、状态和生命周期，客观裁决冲突
  → Main 写入三张系统卡/API/总账/决策/task_plan
  → 状态一致性、链接和独立复核通过后提交并关闭设计项
  → 回到工作项选择；实现仍须独立授权
```

## 6. 交接合同

每份报告必须包含：

1. Scope 与停止条件；
2. `FACT / INFERRED / UNKNOWN` 表；
3. 证据文件、可定位位置和查证方法；
4. 原站状态/生命周期流程图；
5. 与另外两系统的输入输出，但不擅自冻结真实函数签名；
6. 失败、关闭、销毁与重复触发路径；
7. 完整七格设计候选、代价与风险，在窗口报告中标记 `PROPOSED`；
8. 窗口建议的技术决定；Main 可在本轮预授权内接受、修订或保持 UNKNOWN；
9. 文件范围、检查命令和 commit 收据。

没有直接证据时保持 UNKNOWN；不得为了让三条线“看起来能拼起来”而补猜。

## 7. Main 汇总时的接口边界

- `SYS-ZONE → SYS-INTERACT`：只沿用已冻结的 `menuId`、进入/离开、visited/手动关闭语义；真实签名待设计 Gate。
- `SYS-INTERACT → SYS-GAME-UI`：A 提出状态需求，B 提出呈现能力；由 Main 对账，任何窗口不能单方面冻结。
- `SYS-INTERACT / GAME-UI → 玩法控制门`：是否暂停、何时恢复必须有原站证据或明确重构 DECISION。
- `SYS-ENTITY → NPC/ROUTE`：只有直接证据证明稳定共享生命周期后，才允许提出通用实体抽取；本轮不实现。

## 8. 预授权、Gate 与停止条件

Human 原文：`等到三个方案设计完了你就不需要我同意自己进行审查没问题之后自己设计方案三个并行也是分别在三个窗口，最后到主窗口合并。`

该预授权允许：三个窗口完成调查＋设计报告；Main 退回修订、技术裁决、写入三张系统卡/API/总账/决策并创建本地设计提交。

该预授权不允许：写功能代码、创建实现分支、merge 运行时代码、恢复航拍入口、push/PR/远端同步，或对无证据产品内容做猜测。

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
- 不把原始调查报告直接当作项目事实源；只有经 Main 证据复核并写入权威卡的结论才成为本轮已授权设计。

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

最终候选顺序由 Main 依据三份报告完成技术判断并写入关闭报告；真正实现仍需新的明确授权。

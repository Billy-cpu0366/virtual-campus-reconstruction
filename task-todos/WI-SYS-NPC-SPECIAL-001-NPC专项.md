---
work-item: WI-SYS-NPC-SPECIAL-001
type: system-special-project
system: SYS-NPC
issue-class: systemic-failure
active-route: systemic-flow
status: b0-evidence-authorized
phase: b0-evidence-and-contract
decision: DEC-SYS-NPC-PHASE-A-001
updated: 2026-08-25
---

# SYS-NPC 专项

## 目标

把当前分散在盘点报告、群众实施包、多轮修正审计和局部代码中的 NPC 知识收敛为一套可执行、可追溯的 SYS-NPC 权威合同。先回答每类 NPC 从哪里来、何时创建、如何移动和动作、何时显示/回收、如何交互与销毁，再决定分批修复；不继续按视觉症状追加局部补丁。

## 触发与当前结论

- Human 明确反馈：第三轮群众修复后仍有很多毛病，并接受建立完整 SYS-NPC 专项。
- 第三轮 candidate `ef9f004`、`70aefe4`、`76beaf0`、`ea87512`仅为 automated-verified，Human visual rejected；保留为代码与失败证据，不删除、不覆盖、不作为正确基线。
- 当前实现不是统一 NPC runtime，而是 sprayer、route crowd、static special、static crowd、bug crowd、venue/protest、dancing crowd 等独立 owner 由 `CampusScene` 并列驱动。
- 完整 SYS-NPC 尚未确认；ghost、rat attack、birds 等公开候选未实施，若干仅有资源证据的对象保持 UNKNOWN。

## 权威来源顺序

1. `sample/original-public-build/mirror/chunk-WMFY56ZM.js` 中可定位的创建、更新、触发、路径、动画、视口和销毁链。
2. `sample/original-public-build/mirror/assets/maps/particle-trajectories.json`、`walls-layer.json`及公开 sprite 资源。
3. 可重放的原站公开运行行为；不能重放时保持 UNKNOWN。
4. 当前 integration candidate 代码与自动探针只证明“我们现在怎样实现”，不证明原站事实或产品正确。
5. Human 视觉反馈决定重构产品是否可接受；与公开事实冲突时并列记录并经过 Human Gate，不改写 FACT。

## Phase A：只读机制与覆盖审计（已完成，待Human Gate）

### A1. Owner 全量清单

至少覆盖并分别核对：

- sprayer；
- 常规路线群众与 `crowd-train`；
- `crowd` / `crowd_up` 区域静态群众；
- concert、protesters_rising；
- bug、hazmat；
- reading、eating、cat licking；
- dancing NPC、rat attack；
- ghost；
- birds；
- 仅有资源或创建链不足的 UNKNOWN 对象。

每项必须标记 `FACT / INFERRED / DECISION / UNKNOWN`，不得仅按贴图名推断角色。

### A2. 每个 owner 的固定机制表

每类 NPC 必须逐格说明：

1. 配置与资源来源；
2. 出生/激活条件和数量语义；
3. 初始位置、随机性与稳定身份；
4. 路径、速度、等待、朝向和动作状态机；
5. 视口、region、path或事件生命周期；
6. 与地图、墙、火车、玩家和其他系统的接口；
7. 完成、回收、取消、场景 shutdown 和失败路径；
8. 当前代码位置、覆盖状态和可重复验证证据。

### A3. 逐 owner 差异表

建立一张 Main-owned 差异表，对每个 owner 同时记录：公开机制、当前代码、Human 观察、根因、证据强度和建议处理。相同根因聚类，不按截图中的每个 NPC 建独立补丁。

### A4. 正式权威收敛

- 重写 `03-执行层/05-旁支/01-NPC.md` 七格主体，使其覆盖完整 SYS-NPC，而不是以 sprayer 为主体、群众只在摘要出现。
- 更新 `03-执行层/00-总账.md` 的 SYS-NPC 状态与差距。
- `task-todos/` 保存调查过程和实施包，不成为第二套当前系统定义。
- 历史 05-B/05-D 文档保留为来源，并明确 superseded/accepted/failed 状态。

## Phase A 交付物与 Gate

已交付：

- [Phase A机制与覆盖审计](WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)：完整owner/六状态矩阵、每owner机制表、公开Bundle→失败candidate统一差异表、RC-NPC-1..6根因聚类；
- [SYS-NPC卡候选](../03-执行层/05-旁支/01-NPC.md)：七格已扩展为完整owner家族，明确FACT/INFERRED/DECISION/UNKNOWN；
- 推荐`B0→B1→B2→B3→B4→B5`批次、每批验收、成本与风险；
- candidate对照固定为`.pi/worktrees/visible-product-integration` clean HEAD `ea87512`；根`master`没有NPC实现，不把历史自动PASS冒充根基线。

Human Gate结果：Human选择`接受并开始B0 (Recommended)`，已接受owner家族、六状态、RC-NPC-1..6与`B0→B5`顺序，并仅授权B0只读补证。Phase A 未修改 `src/`、`game/`、测试、运行资源或失败candidate。

## Phase A.1：B0证据与合同收口（已授权）

- 重放或追查train正常离站调用链与10人配置的可观察关系；
- 补rat触发/路径/完成、ghost正常入口、birds正常入口与销毁链；
- 核对route worker/候选路径和铁路/不可站区域的数据流，区分FACT与重构DECISION；
- 更新每owner六状态台账，证据不足继续保持UNKNOWN；
- 只读公开证据和clean失败candidate，不修改任何实现、测试、运行资源或`sample/`。

## 后续阶段（B1-B5仅 proposed，未授权）

- Phase B：按 Human 接受的 owner 批次修复核心机制和 Phaser presentation；每批先失败证据，再最小实现与专项回归。
- Phase C：固定场景重放与 owner 级 Human 视觉验收；不等全部 NPC 做完才首次验收。
- Phase D：完整 NPC 联合回归、性能和场景 shutdown；最后一次 Human 整体验收。
- Phase E：只有至少两个真实 owner 显示稳定共同合同后，单独提出复用方案；默认不建立通用 NPC/Entity 框架。

## 固定边界

- 不修改 `sample/`、玩家、地图、相机、30FPS或远端。
- 不改变火车既有路线、scale和timing；NPC 与火车的已证实接口可在专项内审计。
- 不删除或重写第三轮 candidate 来隐藏失败；它是当前实现对照和回归来源。
- 不把配置人数等同于成功布点人数，不把一次截图的精确坐标/人物/朝向冻结为 FACT。
- 自动测试、计数和production probe不能代签Human视觉。

## 当前入口

- 正式系统卡候选：[`03-执行层/05-旁支/01-NPC.md`](../03-执行层/05-旁支/01-NPC.md)
- Phase A统一审计：[`SYS-NPC Phase A机制与覆盖审计`](WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)
- 全量盘点：[`05-B NPC盘点报告`](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05B-NPC盘点报告.md)
- 群众公开模型：[`05-D-2实施包`](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05D2-公开群众模型实施包.md)
- 多轮失败审计：[`05-D-1人群源码审计`](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05D1-人群源码审计.md)
- 动态状态：[`task_plan.md`](../task_plan.md)
- 接受决定：[`DEC-SYS-NPC-SPECIAL-001`](../决策记录.md)

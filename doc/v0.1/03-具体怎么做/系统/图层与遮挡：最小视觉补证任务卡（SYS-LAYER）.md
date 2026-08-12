---
title: 图层与遮挡：最小视觉补证任务卡（SYS-LAYER）
type: work-item-task-card
status: active
version: v0.1
work-item-id: WI-SYS-LAYER-VISUAL-EVIDENCE-001
work-item-level: level-1
work-item-type: investigation
work-item-status: active
node-refs: SYS-LAYER
question-refs: Q-LAYER-001
authorization-ref: DEC-SYS-LAYER-VISUAL-EVIDENCE-001
current-gate: none
gate-status: not-applicable
main-definition: false
updated: 2026-08-11
---

# 图层与遮挡：最小视觉补证任务卡（SYS-LAYER）

> **一句话：只去原站看5个会影响图层设计验收的场景，留下最少但可重复的截图与运行状态；不扩大采集、不写正式代码。**

> 本任务已由Human授权，并在`WI-SYS-WORLD-LAYER-DESIGN-001`完成后由`task_plan.md`激活。当前只允许执行本文的5场景证据调查。

## 1. 目标

为`Q-LAYER-001`补充静态Bundle无法证明的最小运行证据：玩家、基础层、roof、bridge、particles和footsteps在真实原站中的可见关系与动态时序。

原站公开入口：`https://peteroravec.com/`。

## 2. 只允许检查的5个场景

1. 玩家从普通地面移动到`layer6`至`layer10`形成的上方遮挡区域；
2. 玩家进入和离开factory或concert roof区域；
3. 玩家从桥下切换到桥上，再反向离开；
4. 玩家到达包含`particles3`标记的位置；
5. 玩家到达包含footsteps标记的位置并移动。

若某个场景不能由既有地图坐标和公开运行页面可靠到达，记录`UNVERIFIED`及最小阻塞，不通过猜路径扩大探索。

## 3. 每个场景最小记录

- 原站URL、采集时间和视口；
- 玩家世界坐标；
- 必要时记录玩家depth；
- 相关图层的名称、visible、alpha、depth和碰撞状态；
- 进入前、进入后、离开后的必要截图；
- 观察结果标为`FACT`，无法访问的内部状态标为`UNKNOWN`。

截图只能证明可见结果；没有可访问运行对象时，不从截图反推内部depth或类结构。

## 4. 允许路径

| 路径 | 用途 |
|---|---|
| `sample/analysis/layer-visual-evidence/` | 新增本轮截图、最小JSON观测记录和清单 |
| `sample/tools/capture-layer-visual-evidence.cjs` | 只有确定性重复操作确有需要时才新增或修改 |
| `doc/v0.1/03-具体怎么做/系统/图层与遮挡：从原站查到了什么（SYS-LAYER 调查记录）.md` | 回写FACT与残余UNKNOWN |
| `doc/v0.1/03-具体怎么做/系统/图层与遮挡：24层怎样显示和清理（SYS-LAYER）.md` | 只在证据要求修正已接受设计时回写；不能静默改变DECISION |
| `doc/v0.1/04-怎么验证与还差什么/图层与遮挡：怎样验证做对了（SYS-LAYER 验证计划）.md` | 记录场景结果 |
| `doc/v0.1/04-怎么验证与还差什么/原站实际表现是什么（行为基准）.md` | 按项目协议登记可重复BASE行为 |
| `doc/v0.1/04-怎么验证与还差什么/原站和旧版本差在哪（证据与差距）.md` | 按项目协议同步旧复刻差距证据入口 |
| `doc/v0.1/05-还不清楚什么/还缺哪些答案（未知问题队列）.md` | 关闭或收窄`Q-LAYER-001` |
| `doc/v0.1/谁确认过什么（来源与决策记录）.md` | 决定和验证基线 |
| `doc/v0.1/04-怎么验证与还差什么/文档有没有对齐（治理检查报告）.md` | 结构与语义复验 |
| `findings.md` | 非权威发现记录 |
| `progress.md` | 非权威进度记录 |
| `task_plan.md` | 当前阶段、结果和关闭状态 |

## 5. 明确禁止

- 不访问私有资源、source map、未公开源码或猜测URL；
- 不刷新或重写`sample/original-public-build/mirror/`；
- 不递归采集整站资源或建立新的全站Network快照；
- 不修改旧Phaser项目、正式`src`或当前地图数据；
- 不接入Phaser/Vite，不实现图层、玩家、碰撞或渲染；
- 不把浏览器页面中的临时改值写成原站FACT；
- 不因单个场景不可达而扩大到其他功能调查。

## 6. 执行顺序

1. 用既有地图数据确定5个场景的最小候选坐标；
2. 先人工或浏览器工具确认原站可访问和Play可进入；
3. 每次只验证一个场景，保存最小截图与JSON记录；
4. Main核对截图、状态与Bundle静态规则能否互相解释；
5. 更新调查记录、验证计划和`Q-LAYER-001`；
6. 运行治理检查和独立客观复核；
7. 停在Human证据结论审查，不自动进入代码实现。

## 7. 退出标准

- 5个场景分别得到`VERIFIED`或有证据的`UNVERIFIED`；
- 每条FACT都能定位到截图、JSON记录和公开原站入口；
- `Q-LAYER-001`被关闭或明确收窄；
- 没有扩大公开镜像、修改旧项目或写正式代码；
- 复用观察仍为“未发现”，除非出现第二个独立真实场景；
- 工作项结果进入clean Git基线并停在Human审查。

## 8. 当前结果

| 场景 | 状态 | 证据 |
|---|---|---|
| layer8遮挡 | VERIFIED | `01-upper-before.png`至`03-upper-after.png`和observations |
| factory roof | VERIFIED | `04-roof-before.png`至`06-roof-after.png`和observations |
| bridge1 | VERIFIED | `07-bridge-before.png`至`10-bridge-exit.png`和observations |
| particles3位置 | VERIFIED_WITH_RESIDUAL_UNKNOWN | `11-particles3.png`；运行表现已记录，直接消费者链转`Q-LAYER-002` |
| footsteps | VERIFIED | `12-footsteps-before.png`、`13-footsteps-after.png`和active footprint 0→5 |

证据目录：`sample/analysis/layer-visual-evidence/`。clean结果提交`f1652629d436ce7f8a7821c760036fdf071ef397`已通过自动检查、Main画面审查和独立客观复核。当前停在Human证据结论审查，尚未关闭工作项。

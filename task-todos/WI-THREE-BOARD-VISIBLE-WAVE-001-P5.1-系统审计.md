---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.1-systemic-audit
status: reopened-after-r7-human-rejection
issue-class: systemic-failure
candidate-commit: 1e24fd1e9e4cfa7e06ed8db0243b4f214364569c
candidate-tree: 657101daa0419409ea046a3716badd9d6fd57a61
authority: DEC-P5.1-SYSTEMIC-REPAIR-001
updated: 2026-08-23
---

# P5.1 系统补救：完整差异审计与根因包

> 这是本轮唯一 Main 差异表。表面症状不再各建调查任务；修复方案经一次 Human Gate 接受前不写产品代码。

## 1. 审计边界

- 冻结 candidate：`0fadf309`，Human 视觉 Gate 仍为 FAIL。
- expected 来源：原站公开 HTML/Bundle、`sample/analysis/layer-visual-evidence/`、已接受 P2 目标与 P5 Human 结果。
- actual 来源：candidate 正常 production 路径、受控慢网、桌面/移动截图、真人键盘路径，以及只作量化辅助的 test-hooks。
- 正常路径证据：`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/`。
- 不把 WSL headless 表现代替 Human 真实硬件结果；不修改原站 30 FPS FACT；不补猜 particles3/69360。

## 2. 统一差异表

| ID | expected source | candidate actual evidence | 严重度 | 根因簇 | 状态/UNKNOWN |
|---|---|---|---|---|---|
| D-LOAD-01 | 原站白色全屏 `#init-load`、`peter-oravec.gif`、进度条/整数百分比、100% 后网格揭示再显示 Play；`sample/original-public-build/mirror/index.html:259-278`，P5 Human 收据 | 当前为深色壳；慢网 0% 保持约 2s，随后直接 83%→91%→100%，100% 后仍约 3s 才 READY；见 `loading-00/83/100/ready.png` 和 `loading-slow-receipt.json` | Critical | RC-1 | confirmed mismatch |
| D-LOAD-02 | Loading/Play/Error 壳不裁切，响应式只约束壳布局 | `DomAppUi.applyViewport()` 把 `100dvh`/实际高度直接写到 loading section、Play button、error section；READY 时 Play 按钮铺满面板高度；candidate `src/game-ui/app-shell.ts:316-339` | Critical | RC-1 | confirmed root cause |
| D-LOAD-03 | 100% 应表示 Scene/world 已可稳定揭示 | Phaser preload 百分比先到 100%，随后 master/chunk/world mutation 继续；当前没有“资源→world ready→揭示”分阶段合同 | Major | RC-1/RC-2 | confirmed boundary gap；原站每一百分比插值算法 UNKNOWN |
| D-ENTRY-01 | Play 后约 3s 镜头落玩家、约 5s 控制放行，过程中不见 chunk 装配 | shell 在 `ENTERING_GAME` 立即隐藏；相机移动期间 500ms 重算 targets，Tilemap mutation 每 rAF 只做一个。Human 看到 chunk reveal；WSL 快环境未复现 reveal | Critical | RC-2 | Human actual confirmed；硬件相关 mutation 时长 UNKNOWN |
| D-ENTRY-02 | 480×270 逻辑画面应在固定桌面/移动视口稳定适配 | 相同 candidate 曾出现全屏 1920×1080 canvas，也出现 776.875×437 canvas 居中；移动 375×667 为 375×210.94、上下大面积留黑。见正常路径和 mobile receipts | Major | RC-2 | resize/init race 为 INFERRED；需实现前固定 viewport contract |
| D-MOVE-01 | Human 实际移动应连续；原站物理 30 FPS FACT 保持不变 | rAF 约 60Hz且无 long frame，但 2.2s 真人 ArrowRight 中 133 render frame 只有 67 个位置；66 帧位置不变，下一帧跳 4.6667px；camera scroll 同步每隔一帧跳 4/5px。见 `movement-frame-receipt.json` | Critical | RC-3 | candidate stepping confirmed；原站是否用视觉插值 UNKNOWN，不能直接改 physics FPS |
| D-PERF-01 | Human 报告卡顿必须由正常路径 trace 解释 | WSL 正常桌面和移动 rAF 均约 60Hz、无 >34ms frame，未复现 Human 硬件 long frame；现有27-case主要静止/test-hook采样 | Critical | RC-3/RC-5 | environment conflict；需在 Human 路径收集 LoAF/input latency，不得用 WSL PASS 否认 |
| D-TRAIN-01 | 火车在正常入口形成明确可见移动且不破坏玩家主体 | WSL production 在 3–8s 火车几乎占满画面；test-hooks 量化 train display/collision width≈1470.875 logical px，视口仅480；5s 已开放控制但玩家仍被列车遮蔽，约17s才重新成为主体。Human 另报告未见火车 | Critical | RC-2/RC-4 | source scale/route 是 FACT；Human/WSL 可见结果冲突，说明适配/时序不稳定，不等于应擅自改原站参数 |
| D-NPC-01 | sprayer 是当前波的 Human 可见 NPC 结果 | 正常真人路径能看到四人并按300ms级联逃跑；但唯一产品引导只指向 Memo 6，sprayer 路线没有提示，且入口阶段被巨大火车遮挡。见 `sprayer-trigger-*.png` | Major | RC-4 | object/runtime confirmed；discoverability failed |
| D-FX-01 | factory smoke 在入口或短路径至少可见2s | owner/emitter 已创建，但入口 test receipt 中 smoke 一直 `paused/visible=false/emitting=false`；固定 anchor 不在最终玩家视口，当前引导也不去 factory | Major | RC-4 | 3s camera 中精确 screen-time 尚未量化；正常截图未观察到 smoke |
| D-ROOF-01 | factory roof 进入/离开 300ms alpha 1→0→1，并露出内部；`sample/analysis/layer-visual-evidence/04-06` | renderer 有 `setRoofState` 和300ms元数据，但 candidate production 无任何调用方；应用仅 `setAlpha`，没有真实 tween；SYS-LAYER 卡仍把区域来源列 TBD | Critical | RC-4 | confirmed missing consumer；精确区域合同仍待证据收敛 |
| D-CONTENT-01 | Memo 6 由正常 Play + 真人移动发现并打开真实内容 | 正常 `left≈4.1s + up≈1.2s` 可打开真实 Memo 6 modal，无请求/运行错误；见 `memo6-modal.png` | Pass with gaps | RC-4 | 功能路径 confirmed；视觉仍有重复标题、guide未抑制、与原站 chrome 不一致 |
| D-FX-02 | 已确认原站 footsteps 0→5；其他动态人群/particles 保持证据边界 | candidate 仅保留 footsteps/particles3 marker/diagnostic，无 Sprite 消费者；原站 particles3→人群链仍为 `Q-LAYER-002`，69360 为 `Q-LAYER-003` | Major | RC-4 | footsteps confirmed missing；particles3/69360 UNKNOWN，禁止补猜 |
| D-PARITY-01 | Human 要求逐场景差异总表，不只修已点名四处 | 原站证据截图有持续 HUD/顶部导航/地图/对话、密集 NPC、火/抗议人群/脚印等；candidate 当前只有底部文字 guide、单一 modal、四sprayer/一列车/一smoke owner | Major | RC-4/RC-5 | confirmed scope completeness gap；完整16系统仍均未达到 full verified |
| D-VERIFY-01 | 自动 Gate 必须证明正常入口肉眼可见 | 既有 entry/side/layer Smoke 主要检查 debug 状态、对象计数、时间和初始 roof alpha；未固定截图、screen bounds、可见时长、移动位置连续性 | Critical | RC-5 | confirmed process root cause |

## 3. 根因聚类

### RC-1：App UI 把“壳的响应式所有权”写到了内容子节点

- **已确认根因**：`DomAppUi.applyViewport()` 直接拉伸 loading/Play/error。
- **影响**：Loading混乱、READY按钮巨高、移动端同样失真；局部 CSS 修补不足以修复所有状态。

### RC-2：入口可见性不是原子事务

- **已确认事实**：shell 隐藏、相机3s移动、train5s、target重算、chunk mutation和viewport resize分属不同owner，没有一个“画面已完整可揭示”的统一屏障。
- **影响**：慢设备可见chunk装配；不同viewport下train/玩家/画布结果不稳定。
- **禁止误修**：不能恢复111秒序列；不能用“全加载25块后永不卸载”掩盖动态生命周期。

### RC-3：物理正确不等于视觉连续

- **已确认事实**：30Hz位置每隔一个60Hz render frame跳一次；WSL无long frame，但Human仍报告卡顿。
- **建议方向**：保留原站30Hz physics FACT，单独设计玩家/相机视觉插值，并增加正常路径 LoAF/input-latency 收据。
- **UNKNOWN**：原站具体插值实现和Human硬件主要长帧来源。

### RC-4：对象生命周期完成，但产品编排和消费者不完整

- 火车存在却过度遮挡/不同环境可见结果冲突；sprayer可运行但不可发现；smoke不在入口可见区；roof没有区域消费者；footsteps没有视觉消费者。
- 这不是五个生命周期Bug，而是同一“存在→入口→视口→视觉强度→销毁”合同缺失。

### RC-5：自动验证观测层级错误

- 自动门禁证明状态和teardown，却没有证明正常路径截图、screen bounds、可见时长和移动连续性。
- 这是“自动全绿但Human FAIL”的直接流程根因。

## 4. 整体修复包候选

### 方案 A：完整证据补救（推荐）

一次 Human Gate 接受后，连续执行以下包，中间不再逐症状请求确认：

1. **R1 App/Loading**：恢复公开证据支持的白色 init-load、仓库内 `peter-oravec.gif`、真实分阶段进度与100%后揭示；修正 viewport owner，不再拉伸子节点。
2. **R2 入口原子性**：冻结桌面/移动viewport合同；在隐藏壳前完成入口camera corridor所需chunk render并等待scheduler idle；Play期间不暴露装配，不恢复111秒序列。
3. **R3 视觉平滑与性能证据**：保留30Hz物理，加入有界render interpolation；正常production路径记录玩家/camera位置连续性、LoAF、input latency和chunk mutation预算。
4. **R4 可见系统编排**：按screen bounds和连续可见时长验收train/sprayer/smoke；解决train与玩家/NPC遮挡、sprayer发现路径、smoke入口可见窗口；保持原站路线/scale FACT，任何主动偏离单独标DECISION。
5. **R5 roof与确认FX**：先收敛factory区域证据，再接300ms真实tween；实现有直接证据的footsteps消费者；particles3/69360继续UNKNOWN，不伪造人群。
6. **R6 证据支持的视觉完整性**：把当前公开截图已确认、且Phase 1范围内的HUD/导航/地图/对话与动态密度差异纳入同一修复波；资源或行为证据不足的行保持阻塞，不补猜。
7. **R7 门禁重建**：新增无test-hook正常production截图序列、桌面/移动screen-bounds、真人Memo/sprayer/roof路径和移动连续性门禁；全回归后只交一次Human整体验收。

**代价**：范围最大，需要跨 SYS-APP/GAME-UI/CHUNK/WORLD/CAMERA/PLAYER/ROUTE/NPC/LAYER/FX；预计多批实现与Main串行集成。

**主要风险**：原站部分动态消费者仍UNKNOWN；Human硬件性能根因可能需第二份现场trace。UNKNOWN不应被“看起来像”替代。

### 方案 B：当前纵切片补救

只执行 R1–R5 与 R7，修当前P5明确路径；HUD/持续人口和更广视觉密度进入后续工作项。

**代价**：更快、更可控。

**风险**：即使当前七项修好，与原站整体观感仍会有明显差距，可能再次触发Human完整性FAIL。

### 方案 C：只救入口

只修 Loading、viewport、chunk reveal和移动平滑。

**不推荐**：会保留NPC/roof/FX/整体密度缺口，违反本次系统性路线的完整性目标。

## 5. 推荐与 Gate

Main推荐 **方案 A**。理由：Human已明确要求系统补救和逐场景差异总表；方案B仍可能重复“自动正确、整体看起来没变化”的失败。

Human已选择**方案A：完整证据补救**。R1–R7已实施并完成自动回归；最终Human整体验收未通过，父流程按协议回到本差异表继续审计。

## 6. R7 Human拒绝后的新增差异（审计中）

> 来源为2026-08-23 Human实际操作结果。以下三行属于同一父工作项，不分别建立Bug工作项；未完成复现前不写产品代码。

| ID | expected source | candidate actual evidence | 严重度 | 根因候选 | 状态/UNKNOWN |
|---|---|---|---|---|---|
| D-COLLISION-02 | 地图可通行区域应与视觉阻挡一致；垃圾堆局部是否原站有意阻挡仍需对照公开collision/walls证据 | Human报告“垃圾堆哪里有一些不能通过的地方”；精确坐标和原站同点行为待复现 | Major（待坐标确认） | MOVE/WORLD/LAYER碰撞数据或视觉-碰撞错位 | expected/actual边界未收敛，暂不能判定Bug |
| D-PERF-02 | 已接受入口目标为连续3秒Power2镜头与5秒train编排；正常Play不应出现无反馈停顿 | Human报告“开头那段会卡着一会”；WSL R7 trace无>34ms帧，说明自动环境与Human设备继续冲突 | Critical | APP/ENTRY主线程、资源解码、chunk mutation或控制/状态等待 | Human actual confirmed；现场长帧/等待类型UNKNOWN |
| D-TRAIN-02 | 火车离场期间玩家主体不应出现错误穿模；原站路线/scale FACT与玩家/列车遮挡关系需逐帧核对 | Human报告“开头火车开走的时候那段主角穿模了”；现有R7仅按固定时点截图，未覆盖离场交叉逐帧 | Critical | TRAIN路径/碰撞、PLAYER深度或presentation layer时序 | Human actual confirmed；穿模类型和精确帧UNKNOWN |

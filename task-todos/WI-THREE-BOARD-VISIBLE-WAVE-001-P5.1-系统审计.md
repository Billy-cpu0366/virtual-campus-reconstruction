---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.1-systemic-audit
status: c3-inventory-audit
issue-class: systemic-failure
candidate-commit: 54c0e29
candidate-tree: UNKNOWN
authority: DEC-P5.1-R7-REPAIR-001
updated: 2026-08-24
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
| D-COLLISION-02 | 地图可通行区域应与视觉阻挡一致；原站玩家使用同一`walls`层 | Human定位`OUR ART / OUR / OUR RULES`与垃圾堆约`(1816,1176)`；当前/原站walls数据SHA-256均为`a1fb8b…788b1`。叠图显示强制碰撞只覆盖招牌基座和垃圾堆下半轮廓，二者间空白路面无强制碰撞 | Not reproduced as bug | 原站一致的可见障碍碰撞 | 当前不修；若Human仍在空白路面复现，需带玩家坐标截图重新打开该行 |
| D-PERF-02 | 已接受入口为3秒camera、5秒train到站/控制放行；过程中不得出现设备可见冻结 | Human确认既有无控制也有冻结/跳帧。三次probe均在约3.05秒释放25块锁，并于4.71–4.76秒完成25→15块、525→315层，即210层卸载；约5秒控制才启用 | Critical | RC-6 | cleanup与3–5秒可见过渡耦合confirmed；WSL未稳定复现Human长帧，设备blocking duration仍UNKNOWN |
| D-TRAIN-02 | train/player/sprayer应按世界位置形成正确遮挡，不让玩家贴在车厢表面 | Human确认是“人物盖在车厢前”而非物理穿越；R4主动把train从depth 1001改为520，出生玩家depth=532.8，R7 3/5/8秒截图直接显示玩家画在车厢前 | Critical | RC-7 | confirmed presentation-policy defect |

## 7. R7失败根因簇与一次修复方案Gate

### RC-6：入口cleanup与可见过渡耦合

- **confirmed**：`cameraStable`约3秒直接释放entry corridor lock；每次固定从25块/525层降到15块/315层，210个Tilemap层删除持续到约4.7秒；控制仍等train约5秒到站。
- **Human actual**：这段同时表现为无控制和可见冻结/跳帧。
- **边界**：WSL focused probes稳定证明工作量与时序，但没有稳定复现Human设备的长帧；不得声称已取得设备blocking trace。

### RC-7：R4 train层级决策与最终视觉冲突

- **confirmed**：R4为让玩家和sprayer可辨识，把train固定depth降到520；出生玩家为532.8，因此重叠时必然画在车厢前。
- **不是**：不是Human报告的物理穿越，也没有证据指向train路线/scale/5s+3s+9s FACT错误。

### 推荐方案：C1 + C2（accepted）

1. **C1入口cleanup隔离**：保留已接受的3秒camera、5秒train到站和5秒前控制锁，不改30 FPS；`cameraStable`只结束相机，不再在同一可见帧无预算拆210层。为offscreen chunk teardown增加明确每帧时间/层数预算并记录mutation receipt，要求点击Play后0–5秒production无>34ms帧/LoAF且25→15最终仍收敛、无chunk reveal/旧collider。
2. **C2 train世界深度**：不回到会盖住所有sprayer的固定1001；按train世界y使用同一depth公式，使train约533.4，高于出生玩家532.8、低于sprayer约542.4。保持路线、scale、5s/3s/9s、碰撞带不变；用3/5/8秒production截图证明玩家不再贴在车厢前且sprayer仍可见。
3. **垃圾堆不改代码**：保留原站一致walls；增加该区域“空白路面可走、招牌/垃圾堆可挡”的定点回归。若Human指出具体空白格，再以坐标重开D-COLLISION-02。
4. **回归**：重跑R7双视口完整production、入口0–5秒性能与mutation收据、train 3/5/8秒、碰撞/生命周期/Retry/shutdown，最后再次Human整体验收。

**代价与风险**：C1会触及CHUNK/WORLD/LAYER调度和collider清理，属MEDIUM风险，必须保留原子收敛和shutdown；C2为LOW/MEDIUM呈现层改动，风险是玩家被train正确遮住的时间过长。两包均不恢复111秒序列、不实现particles3/69360、不改sample/路线/scale/物理FPS。

Human在结构化Gate选择**`实施C1+C2 (Recommended)`**。方案状态从`proposed`转为`accepted`；实施授权为`DEC-P5.1-R7-REPAIR-001`。

C1+C2已由integration `54c0e29`实现并完成自动/双视口production回归；量化结果见[C1+C2收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-C1-C2-收据.md)。后续Human再次拒绝后，父流程仍在同一差异表C3 audit；不得用该收据自动关闭任何Human-owned行。

## 8. C3：最新Human结果与完整度清单（2026-08-24）

> **当前口径**：只以Human最新澄清判断“仍不对”。旧自动收据只能说明其
> 记录的场景，不能把未覆盖的party、Loading或实际设备入口观感写成已修。
> 本节与上方历史行共用同一父工作项和根因表，不拆成普通Bug。

### 8.1 当前P0：Human仍判失败的三项

| ID | Human结果/目标 | 现有证据与适配状态 | 根因候选 | 下一步（只读） |
|---|---|---|---|---|
| C3-LOAD | Loading/开始游戏界面仍与原站不对 | R1证明白壳/GIF/进度/Play已实现，但没有同视口原站/复刻逐元素视觉对照；对最新Human结论为`NOT OBSERVABLE` | RC-A：Human视觉Oracle与旧R1收据不匹配 | 建立同视口元素对照；FACT与重构DECISION分开 |
| C3-ENTRY | Play后约2秒航拍切回主角时仍有可感知卡顿/跳变 | R3/C1+C2的WSL P95、rAF和固定截图不能观察Human设备0–5秒连续观感；对最新结论为`NOT OBSERVABLE` | RC-B：camera、cleanup、控制门、viewport与对象编排在同一可见窗口竞争 | 收集正常production的连续录像/逐帧trace，关联input、camera、player visual与mutation时序 |
| C3-ROOF-PARTY | party建筑进入后屋顶未像实验室一样淡隐 | R5仅覆盖factory两层roof；没有party区域、roof组或消费者收据；对party结论为`NOT OBSERVABLE` | RC-C：roof消费者覆盖不完整 | 先定位party的区域→roof组归属；将淡隐/恢复登记为Human重构DECISION，不伪装成原站FACT |

三项均为`Critical`，接受owner均为Human；在Human复验前不得标PASS或关闭。

### 8.2 明确未复现的完整度缺口（非本轮P0修复授权）

| ID | 缺口 | 当前状态 | 来源 |
|---|---|---|---|
| C3-UI | 顶部完整菜单与移动quick-actions | 明确未完成 | `03-执行层/04-独立件/02-游戏UI.md`、R6收据 |
| C3-CONTENT | CV、Contact、Technologies正文 | 仅有禁用入口，明确未完成 | `04-内容层/作品集内容.md`、R6收据 |
| C3-NPC | 除sprayer外的NPC、跨chunk长路线、intro复位 | 明确未完成 | `03-执行层/05-旁支/01-NPC.md` |
| C3-ROUTE | cars路线与CrowdManager | 明确未完成 | `03-执行层/05-旁支/02-车辆与路线.md` |
| C3-PLAYER | 沙滩换装、怪物、传送、Z粒子等玩家能力 | 明确未完成 | `03-执行层/02-玩法线/03-玩家.md` |
| C3-LAYER | 特殊13层和其余已证实动态消费者 | 明确未完成 | `03-执行层/01-地图线/03-图层与遮挡.md` |
| C3-ASSET | 两套Loader完整时序、HTTP cache、纹理生命周期 | 明确未完成 | `03-执行层/01-地图线/01-资源加载.md` |

这些行保持`P1/P2 deferred`，用于防止把当前纵切片误报为完整复刻；不纳入
C3前三项修复包，也不以此扩大本轮代码授权。

### 8.3 UNKNOWN与禁止补猜项

| ID | 未知/证据缺口 | 不能断言的原因 | 所需证据 |
|---|---|---|---|
| C3-U1 | party实际roof组与触发区域 | 现有直接证据只到factory/concert | party进入/离开公开运行证据或Bundle区域调用链 |
| C3-U2 | C3-ENTRY的具体主因 | WSL未复现Human设备长帧，不能将现象归咎于单一cleanup | Human设备production时间线/LoAF/长帧与camera/mutation关联 |
| C3-U3 | 原站Loading精确百分比与过渡算法 | 公开证据未证明插值/时序算法 | 原站逐帧证据或公开代码直接链 |
| C3-U4 | particles3/69360消费者 | 仅有计数/空间关系，缺直接数据流 | Bundle marker→消费者读取/创建链 |
| C3-U5 | 111秒序列是否为正常入口 | 当前明确为UNKNOWN且禁止接入 | 原站正常产品触发链 |

### 8.4 已实现、不得重复报为当前失败

- factory roof的300ms淡隐/恢复、30Hz物理不变的视觉插值、C1预算cleanup与train
  世界深度均已有有界实现和自动证据；它们不自动关闭C3-ENTRY或C3-ROOF-PARTY。
- About、Projects、Memo1–6、mini/big map、sprayer、train、smoke、footsteps已有
  有界实现；完整度仍受8.2的明确缺口限制。

### 8.5 C3 Intent Contract（accepted，`DEC-P5.1-C3-P0-SCOPE-001`）

```yaml
intent-id: IC-P5.1-C3-001
version: 1.0-accepted
normal-path: normal production Play → 0-5秒入口 → party进入/内部/离开
must-match:
  - C3-LOAD: Loading/开始游戏界面按同视口原站对照消除可见差异
  - C3-ENTRY: Play后约2秒航拍转主角时无可感知停滞或跳变
  - C3-ROOF-PARTY: party进入、内部、离开时采用实验室式屋顶淡隐/恢复
may-differ: 未被公开证据证明的Loading内部百分比算法；party技术区域实现
out-of-scope: C3-UI/C3-CONTENT/C3-NPC/C3-ROUTE/C3-PLAYER/C3-LAYER/C3-ASSET；
  particles3/69360；111秒序列；30FPS physics；train路线/scale/timing
failure-signals:
  - Human仍可见Loading构图/层级差异
  - Human仍在约2秒转场感知冻结、跳变或相机突变
  - party内部仍被屋顶遮挡，或离开后屋顶不恢复
oracle-map-required:
  - C3-LOAD: 同视口原站/复刻normal-production静态对照
  - C3-ENTRY: Human设备normal-production 0-5秒连续录像或逐帧trace
  - C3-ROOF-PARTY: party进入/内部/离开normal-production连续证据
acceptance-owner: Human
human-gate: p5.1-c3-preimplementation-evidence → p5.1-c3-human-acceptance
accepted-signature: 接受P0范围 (Recommended)（2026-08-24）
```

**防复发动作**：每条C3 criterion在修复包前必须有上述Oracle Map行；R1/R3/R5/C1+C2
历史收据仅作诊断输入，不能作为C3完成收据。

### 8.6 实施前证据定位（2026-08-24，阻塞）

| Criterion | 已确认定位 | 不可确认/不得猜 | 解锁实施的最小输入 |
|---|---|---|---|
| C3-LOAD | 原站固定全屏白底`#init-load`、GIF、进度条/整数文本、独立Play壳；当前72/80/88/92/98进度、120ms transition、850ms网格与边框阴影均为重构DECISION | 原站逐元素尺寸、间距、字体、网格细节、百分比插值和阶段时序 | 原站与复刻同一viewport的Loading/100%/Play三态对照；否则只可保持`NOT OBSERVABLE`，不改CSS/时序 |
| C3-ENTRY | 当前3秒camera结束即释放corridor lock；其后目标更新可与每rAF一次mutation交叠；控制仍等train arrival | Human约2秒卡顿是否由lock、mutation、camera/player交接或设备长帧造成 | 同路径normal-production 0–5秒连续画面与时间线：camera、lock、目标块、mutation、控制与长帧；WSL静态/P95不能关单 |
| C3-ROOF-PARTY | 公开地图/Bundle只确认factory与concert两组roof及300ms Power2淡隐；当前Scene只消费factory，renderer可消费任意group | Human称party是否等于concert；party精确边界和进入/离开行为 | party外/进入/内部/离开短视频或三帧截图，至少带viewport与可辨识入口；若可提供玩家世界坐标，落在concert `x=1632..2208,y=384..848`才可客观归属concert |

**状态（2026-08-24 本地复核后）**：C3-LOAD与C3-ROOF-PARTY已有同视口/正常production本地Oracle；C3-ENTRY仍缺Human实际设备的0–5秒连续证据，故整体仍为`blocked-awaiting-human-entry-evidence`，不得冻结实施包。

已满足的最小输入：

1. 原站与当前复刻同一1280×720 viewport的Loading/Play关键态截图和DOM收据；
2. 当前复刻party建筑外、刚进入、内部、离开的production截图、合法步行坐标与roof状态。

仍需的最小输入：当前复刻点击Play后的0–5秒**Human实际设备**normal-production录屏或逐帧trace；须能辨识约2秒转场。WSL trace只用于定位时序，不能代替该输入。

这些输入只用于建立C3 Oracle Map和实施范围；不会作为Human最终视觉验收的替代。

### 8.7 WSL本地生产采样（2026-08-24，diagnostic，不替代Human验收）

- candidate在隔离worktree本地`build`后，以`1280×720`production预览采样：Loading约`5.76s`到READY；截图和receipt位于`.pi/audit-evidence/p5.1/c3-local-entry/`。
- C3-ENTRY：点击Play后采到`0/1/3/5s`关键帧及连续采样。约`1.91s`前相机保持`(568,404)`；`2.03s`开始回移，至约`3.06s`为`(848,169)`并首次`cameraStable=true`。这与Human所述“约2秒跳变”时间吻合，说明相机时序是优先诊断对象；不能据此认定为唯一根因。
- 连续采样的唯一>34ms rAF为点击后约`85ms`的`66.7ms`帧；PNG逐帧CDP截图本身扰动了100ms节奏，故此数字**不得**作为性能关单或根因证据。
- C3-ROOF-PARTY：后续`trace-r6`已用合法步行路线完成concert外→内→离开：`(1638.7,392.7)`→`(1638.7,486.0)`→`(1638.7,350.7)`，三点均在normal production。concert roof在内部仍为`visible/alpha=1`，离开后同样为`visible/alpha=1`；源码唯一产品消费者是`updateFactoryRoof()`，只会在factory矩形内调用`setRoofState("factory", ...)`，没有concert调用。这是C3-ROOF-PARTY的confirmed candidate根因；“party=concert”是由Human所指右侧建筑与本次合法路径形成的重构适配，不能写成原站party触发FACT。

### 8.8 C3本地Oracle结果（2026-08-24）

| Criterion | 本地证据 | 已确认结论 | 保留边界 |
|---|---|---|---|
| C3-LOAD | `.pi/audit-evidence/p5.1/c3-local-entry/loading-oracle/original-receipt.json` 与 `replica-receipt.json`，同为1280×720 | 原站初始`#init-load`在全视口白色遮罩内；复刻初始即存在1280×720 canvas，Loading为560×454面板。原站Play态为全视口壳，复刻Play仅150×53.6按钮，构图层级存在直接可见差异。 | 原站本地快速加载未留下逐个1→100中间百分比；精确插值/时序继续UNKNOWN。 |
| C3-ENTRY | `.pi/audit-evidence/p5.1/c3-local-entry/trace-r6/entry-trace.json`，1280×720 normal production | 相机约`2050ms`开始从预览位置回到玩家，约`3099ms`取得`cameraStable`，约`5078ms`进入PLAYING；本次rAF未采到>34ms帧。约2秒转场与Human描述时间吻合，当前产品编排是优先根因候选。 | CDP逐帧截图会扰动节奏，WSL无长帧不能反证Human设备观感；尚缺Human设备连续证据，不能决定是缩短停留、调整回程，还是处理设备竞争。 |
| C3-ROOF-PARTY | 同一trace的`concert.before/inside/after`截图、坐标与roof状态 | 合法进入concert内部后屋顶仍为`visible/alpha=1`；`CampusScene`只有factory区域消费者，未调用concert淡隐。可修范围已收敛为“为已存在concert组补独立区域消费者与300ms复用tween”，不改roof组/图层策略。 | party的原站命名、原站精确区域与触发器未获公开直接证据；实施必须标为Human已接受目标下的DECISION。 |

### 8.9 本地入口连续录制替代（accepted，2026-08-24）

Human明确决定“你自己去录吧，我录的会出现一些不必要的干扰因素”。据此`DEC-P5.1-C3-LOCAL-ENTRY-ORACLE-001`允许AI以低扰动WSL normal-production录制替代原先要求的Human录制：`.pi/audit-evidence/p5.1/c3-local-entry/entry-screencast-r1/receipt.json`记录1280×720、`5515ms`、330个连续CDP screencast帧。该方法没有逐帧`captureScreenshot`调用，作为入口编排诊断比旧trace干扰更低。

**实施前结论**：三条C3 Oracle Map均已具备本地实施诊断输入，`p5.1-c3-evidence-completeness`从`blocked-awaiting-human-entry-evidence`变为`evidence-complete-local-oracle`。这只解除“形成实施包”的证据阻塞，不把WSL表现写成Human硬件性能结论，也不自动授权产品代码；下一步是给Human展示一个单一有界实施包。

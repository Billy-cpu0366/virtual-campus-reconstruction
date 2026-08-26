---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
type: source-audit
system: SYS-FX
issue-class: systemic-failure
status: s1-human-visual-rejected-smoothness-awaiting-audit
decision: DEC-P5.4-05E-SMOKE-AUDIT-001
updated: 2026-08-25
---

# 05-E 公开烟雾全量审计

## 结论

此前05-E把`createSmokeGenerator({x:50.5*16,y:33.7*16,...})`单点选作“唯一factory smoke”，但公开Bundle没有为该点提供这个业务名，且同一初始化链实际创建10个white smokeGenerators、Stop AI周边3处烟雾罐×3层particle emitters，并从`particle-trajectories.json`创建9个fog regions。当前candidate仍只覆盖第一类中的1/10；S1已覆盖Human指出的Stop AI道路烟雾与`orange_smoke`，其余white/fog仍待后续授权。

这不是单点位置错误，而是owner范围系统性遗漏。三类烟雾的创建、视口、深度、交互和销毁语义不同，不能继续把一个`FactorySmokeRuntime`复制到所有效果。

## 权威来源

- `sample/original-public-build/mirror/chunk-WMFY56ZM.js`
  - `particleData`彩烟配置约byte `462800–466300`；
  - white smokeGenerators创建约byte `467297–468820`；
  - `checkParticleVisibility()`约byte `430113`；
  - `createSmokeGenerator()` / `updateSmokePaths()`约byte `471579–476100`；
  - FogManager约byte `197000–202500`；
  - `createAreaParticleEmitters()`约byte `551422–553900`；
  - `startSimpleWindGust()`约byte `578289`。
- `sample/original-public-build/mirror/assets/maps/particle-trajectories.json`：regions 75–83。
- 当前实现对照：`src/fx/factory-smoke.ts`、`game/PhaserFactorySmokeRuntime.ts`、`tests/fx/factory-smoke.test.ts`。

## FACT A：white smokeGenerators

### A1. 数量与坐标

公开初始化直接创建10个路径烟雾配置；以下ID仅为重构审计索引，不是公开业务名。

| 审计ID | 世界坐标 | 数量 | 深度/alpha差异 |
|---|---:|---:|---|
| `white-standalone-1` | `(808,539.2)` | 1 | base depth500、maxAlpha .25、默认按player前后动态depth |
| `white-standalone-2` | `(1592,619.2)` | 1 | 同上 |
| `white-standalone-3` | `(696,1499.2)` | 1 | 同上 |
| `white-standalone-4` | `(1416,1563.2)` | 1 | 同上 |
| `white-split-row` | `x=648/664/680/696, y=397.2` | 4 | base500 + overlay2000；`depthSplitY=384`；maxAlpha 1；不按player动态depth |
| `white-upper-row` | `(648,379.2)`、`(696,379.2)` | 2 | depth2000；maxAlpha 1；不按player动态depth |

### A2. 共同参数

`width=7`、`widthEnd=32`、`pathHeight=35`、`quantity=2`、`frequency=80`、white texture、`scale 1.6→4`、`alpha→0`、`lifespan=2000`、`reactCars=false`、`reactPlayer=false`。split row因overlay实际对应8个Phaser emitters；其余6点各1个，总计14个emitter对象。

### A3. 生命周期与路径

- owner为场景`smokeGenerators`；创建后持有emitter、可选overlay、path状态与graphics。
- 每50ms执行`updateSmokePaths()`；以camera bounds外扩100px决定start/show或stop/hide，离屏不销毁。
- alive particle沿二次曲线路径上升，width随lifeT扩展；path bend按固定系数收敛。
- standalone默认根据player body相对烟点的前后调整depth；split/upper rows关闭该动态depth。
- 公开搜索未发现统一scene teardown调用；完整销毁继续`UNKNOWN`，重构必须显式清理并标`DECISION`。

## FACT B：Stop AI周边烟雾罐

### B1. 三处位置与九层emitter

名字来自公开Bundle的Slovak标识；“红/橙”是标识语义，最终显示色仍以tint palette为准。

| 组 | 世界坐标 | angle | back | main | front |
|---|---:|---:|---:|---:|---:|
| `cervena_dymovnica` | `(1800,1352)` | `-30..30` | depth350 | depth1160 | depth1550 |
| `oranzova_dymovnica` | `(1480,1272)` | `-40..20` | depth350 | depth1160 | depth1550 |
| `oranzova_dymovnica2` | `(1672,1304)` | `160..220` | depth350 | depth1160 | depth1550 |

共同参数：`particle_smoke_white`、speed `15..35`、scale `.1→3`、lifespan `1800`、quantity `2`、frequency `20`、gravityY `-20`、Circle radius3、tint `[16724787,16716049,13369344]`。main alpha `1→.3`；back/front alpha `.6→.15`。

每个位置另有一个canister graphics，固定depth400，并以camera外扩100px显示/隐藏。三层不是重复数据，而是让烟雾正确穿插后景、人物/道路和前景。

### B2. 生命周期与动作

- 这9个对象属于通用`particleData/particleEmitters`，不是`smokeGenerators`。
- 初始化通过idle batch逐个创建；每500ms执行`checkParticleVisibility()`，Circle bounds外扩50px不在camera时destroy并置null，返回时按配置重建。
- main层按player body相对烟点动态调整到player depth前/后；back/front保持固定depth。
- 初始化6秒后，为当前彩烟emitters启动wind loop：若在camera外扩100px内，每3–6秒切换方向，gravityX `15..40`持续1.5–4秒后归零。
- 公开代码未直接证明emitters离屏重建后重新绑定wind loop；保持为`UNKNOWN/公开实现风险`，实施前需决定按可见产品意图恢复还是逐字复制该缺口。

## FACT C：trajectory fog owner

### C1. 九个region与60个cell emitter

FogManager按32px cell中心落入polygon创建cell。下表cell数按公开算法重算，不等于JSON `tileCount`。

| region | bounds | cells | depth/特殊配置 |
|---|---|---:|---|
| `orange_smoke` (75) | `1496,1160..1672,1304` | 13 | depth1100；红橙tint；NORMAL；scale8、alpha.3、speed5、quantity4、frequency20、lifespan350..2000、respawn500ms |
| `fog_76` | `24,1976..136,2024` | 3 | depth1600，默认深色fog |
| `fog_77` | `168,1976..296,2088` | 8 | depth1600，默认深色fog |
| `fog_78` | `296,1976..408,2120` | 8 | depth1600，默认深色fog |
| `fog_79` | `424,1976..648,2024` | 3 | depth2100；白灰palette；alpha.5；`ignorePlayer=true` |
| `fog_80` | `8,2024..120,2200` | 9 | depth1600，默认深色fog |
| `fog_81` | `120,2056..216,2184` | 6 | depth1600，默认深色fog |
| `fog_82` | `216,2104..360,2200` | 8 | depth1600，默认深色fog |
| `fog_83` | `376,2152..408,2232` | 2 | depth1600，默认深色fog |

默认FogManager参数：cellSize32、respawn5000ms、alpha.1、scale12、speed.5、深色tint、quantity6、frequency250、lifespan2000..3000、ADD、depth1100。

### C2. 生命周期与交互

- FogManager初始化时创建全部cell emitters；region先做camera相交判断，实际逐cell启停边界为`cellSize=32`（camera四边各扩32px），不离屏destroy。
- 玩家移动时，以朝向前方椭圆`85×35`清除非`ignorePlayer` cell；停止发射后按region respawnDelay恢复。
- active cars以40px半径清fog；`orange_smoke`500ms恢复，普通fog默认5秒。
- FogManager有显式`destroy()`清timer/emitter，但公开场景统一shutdown是否调用仍未直接发现，记`UNKNOWN`。

## Human位置对照

Human所说“Stop AI道路两边烟雾”与公开证据一致：

- protest/Stop AI区域约`x=1672..1896, y=1096..1304`；
- `orange_smoke` polygon位于其西侧至边缘；
- orange canisters位于`(1480,1272)`和`(1672,1304)`；
- red canister位于`(1800,1352)`。

因此Stop AI视觉由至少两个owner共同组成：3处彩烟罐分层emitters + `orange_smoke` fog region。只实现`(808,539.2)`无法代表该场景。

## 当前代码覆盖差异

| 项目 | 公开事实 | 当前candidate | 状态 |
|---|---|---|---|
| white smokeGenerators | 10 configs / 14 emitters | 只实现`(808,539.2)`一个emitter | 1/10 config覆盖；scope fail |
| white动态depth | standalone跟player前后；split有overlay | 所有显示固定depth3400 | 与公开机制不等价；早期roof补偿DECISION |
| Stop AI canisters | 3 sites / 9 layered emitters + 3 graphics + wind | S1已实现独立owner | 自动行为PASS；待Human视觉 |
| `orange_smoke` | 13-cell互动fog | S1已实现13-cell独立owner | 自动行为PASS；待Human视觉 |
| 其余fog | 8 regions / 47 cells | 未实现 | S3待授权 |
| 视口语义 | generator stop/hide；particleData destroy/recreate；fog cell stop/start | S1分别实现Stop AI destroy/recreate与orange fog cell stop/start | S1自动PASS；全量未完成 |
| teardown | 多类公开完整接线UNKNOWN | S1显式清理9 emitters/3 graphics/13 cells/listeners/timers | S1自动PASS；公开全量仍UNKNOWN |
| 自动probe | 全量此前只有单点往返 | S1真实键盘probe覆盖Stop AI离屏/返回/wind/shutdown | S1自动PASS；不能代签视觉 |

## 根因聚类

- **RC-FX-1 候选替代系统范围**：P1从公开代码选择一个易验证烟点后，后续把“首个候选”误写成“唯一factory smoke”。
- **RC-FX-2 无证据业务命名**：Bundle调用没有`factory` ID，文档却把`(808,539.2)`业务名化，掩盖其余配置。
- **RC-FX-3 owner混淆**：路径烟、particleData彩烟、FogManager区域雾共享纹理但生命周期完全不同；此前只按纹理/视觉类别理解。
- **RC-FX-4 自动门禁自证循环**：测试和probe只读取单点配置，因此能全绿但无法发现公开清单缺项。

## 推荐实施批次（proposed）

### S1 Stop AI场景（已实现，Human视觉待验收）

分别实现、共同验收；代码提交`e07d2c7`与收据记录见S1实施包。

1. 彩烟罐owner：3位置、9层emitter、3 graphics、动态main depth、可取消wind state；
2. Fog owner中的`orange_smoke`：polygon、13 cells、500ms清除/恢复、玩家/车辆接口；
3. 固定Stop AI production场景验证道路两边、深度穿插、移动清雾、离屏/返回和shutdown。

理由：直接对应Human纠正和最显眼缺口；两个owner保持独立，不为地点方便合并成一个runtime。

### S2 white smokeGenerators

把单点runtime扩展为10 config/14 emitter的配置驱动owner，保留三类depth策略、外扩100pxstop/hide、路径更新与显式teardown。审计ID只作代码索引，不伪造地点名。

### S3 其余8个fog regions

复用S1已真实实现的Fog owner，接入47个cell、depth1600/2100差异、fog79 `ignorePlayer`、5秒respawn、car clearing和性能预算。

### S4 联合回归与Human整体验收

对Stop AI、white standalone/split rows、南部fog固定区域分别截图和行为重放；验证最多83个潜在emitter对象的创建预算、可见活跃上界、返回复用/重建语义和scene shutdown。自动结果不能代签视觉。

## 成本与风险

- 全量潜在对象约83个emitter（white 14 + canister 9 + fog cells 60）及3个canister graphics；必须分帧创建和按owner控制可见活跃数。
- Stop AI彩烟使用通用particleData的destroy/recreate语义，white generator使用持久stop/hide，不能为了复用强行统一。
- 公开动态depth与当前roof depth体系存在冲突；需先建立depth Oracle，不能继续统一设3400。
- fog清除依赖player velocity与cars；cars未纳入当前重构时，必须明确car接口未集成，不伪造验证。
- 公开wind loop的离屏重建续接已按Human接受的S1决定显式恢复；全量其他owner的wind/teardown仍需后续验证。

## S1 Human拒绝后的系统性修正审计（2026-08-25）

### 分类与证据

- **classification**：`systemic-failure`。理由是自动检查/production probe通过，但Human在编译production视觉Gate明确拒绝“红烟卡卡的、不丝滑”；该问题涉及红烟与orange fog的整体呈现，不能按截图症状拆成零散补丁。
- **冻结对象**：`e07d2c7`保留，不修改、不覆盖；S2–S4未授权。
- **定点帧证据**：真实键盘路线到Stop AI后，9个彩烟emitter与13个orange fog emitter active。10秒定点采样`stop-ai-frame-before-capture.json`为383帧，median约33.3ms、p95约33.4ms、max50ms；旧入口/移动performance smoke的16.7ms不覆盖此场景。
- **owner隔离**：同一compiled preview中，红烟+orange fog的4秒采样有26–29帧超过20ms；正式关闭Fog后红烟单独为median约16.7ms/p95约16.7ms且无>20ms帧；反向orange-only仍有13帧超过20ms；无烟为全段约16.7ms。
- **绘制/同步隔离**：临时关闭fog粒子绘制但保留两个runtime的每帧同步后恢复为241帧、median约16.7ms、无>20ms帧；因此每帧snapshot/sync不是主因，透明粒子绘制/overdraw是当前最高可信根因候选。
- **密度敏感性**：只在页面实例临时调用fog emitter `setQuantity(2)`，4秒采样median约16.7ms、p95约16.8ms、8帧超过20ms；`setQuantity(1)`为全段约16.8ms以内。该实验不改变仓库源码，仅证明呈现密度对帧时序有直接影响。
- **纹理事实**：候选加载的`particle_smoke_white`为4×4像素，文件SHA-256与公开`smoke-white.webp`相同；候选全局`pixelArt:true`而公开Bundle未发现该配置字面量，最近邻造成的块状边缘仍是独立UNKNOWN，不与本批性能修复混合。
- **修正收据**：`.pi/worktrees/visible-product-integration/.pi/audit-evidence/05e-s1/correction-round-1/`下保存定点帧、red/orange隔离、render-off同步控制、fog quantity敏感性和纹理收据；其中`stop-ai-frame-before-capture.json` SHA-256 `5eb4f920064bbd4b9746a96716d4088e460cd63d0a69b9ad66961bc4c34cafa0`，`render-off-sync-active.json` SHA-256 `cf86106699f8d9c0ff86fd9decff053a2abfa6a67661328a506db25e5076d5dc`，`fog-quantity-sensitivity.json` SHA-256 `d9250f0205c4853bd8bee461cbe8b0324b6a8891e05ff3778446793a40d27feb`。

### 统一差异表

| 差异 | Expected source | Actual evidence | 严重度 | 根因状态 |
|---|---|---|---|---|
| Stop AI整体红烟运动卡顿 | Human视觉Gate要求连续、无明显跳帧 | 编译production截图/定点帧采样拒绝；同时出现9红+13fog | P0 | **INFERRED**：组合透明粒子绘制负载 |
| `orange_smoke`呈现预算 | Bundle region75为13 cells、quantity4、frequency20、scale8、NORMAL | 13 emitter同时渲染；orange-only出现33ms级帧间隔；quantity2/1实验明显改善 | P0 | **INFERRED**：fog overdraw/粒子密度主因 |
| 红烟自身参数 | Bundle三处九层为quantity2、frequency20、lifespan1800等；candidate逐项匹配 | red-only控制组无>20ms帧 | P1 | **PASS配置匹配**；不先改红烟 |
| runtime每帧同步 | owner需逐帧更新交互/视口状态 | render-off但保留sync恢复60Hz | P1 | **已排除为主因**，后续可不做无证据重构 |
| 4×4纹理与过滤 | 公开使用同一4×4 smoke-white；公开过滤最终状态未直接证实 | candidate `pixelArt:true`可能造成边缘块状；尚无同硬件原站对照 | P1 | **UNKNOWN**；另立视觉差异，不混入本批 |
| 旧性能门禁覆盖不足 | 性能检查必须覆盖Human实际Stop AI路径 | 旧脚本只测boot/入口移动；新定点临时观察器覆盖Stop AI | P1 | **FIXED EVIDENCE GAP**；正式收据需纳入可重复定点指标 |

### 根因聚类

- **RC-FX-SMOOTH-1（当前最高可信）**：13个orange fog cell emitter以公开`quantity4/frequency20/scale8`同时做NORMAL透明绘制，和三处红烟叠加后触发compositor帧丢失；红烟本身单独没有复现同级帧丢失。
- **RC-FX-SMOOTH-2（待验证）**：同一频率批次与同时启动造成视觉密度脉冲；quantity2实验改善帧时序，但尚未完成Human同场景视觉复验。
- **RC-FX-SMOOTH-3（独立UNKNOWN）**：候选的全局最近邻过滤可能使4×4烟雾边缘更块状；不能仅凭静态截图把它和帧丢失混为一个根因。

### 已接受的一次修复方案（accepted，自动验证通过，Human视觉待验收）

1. **只改orange fog的presentation density**：保留`FogRuntime`的13-cell状态、玩家/车辆清除合同、500ms respawn、视口生命周期和独立owner；首个产品candidate把Phaser fog emitter的`quantity`由公开FACT `4`改为重构`DECISION` `2`。红烟9层的位置、depth、tint、frequency、lifespan、wind和owner先完全不动。
2. **把公开偏差显式登记为DECISION**：这不是Bundle FACT复刻，而是为Human已拒绝的平滑度做最小呈现取舍；`quantity1`只作为诊断上限，不预授权直接采用。
3. **修复包允许路径**：`src/fx/fog.ts`、`game/PhaserFogRuntime.ts`、`tests/fx/fog.test.ts`、必要的`browser-stop-ai-smoke-production`定点帧收据脚本；不改`game/main.ts`的30FPS/像素配置，不改红烟、地图、玩家、NPC、火车或`sample/`。
4. **客观停止条件**：同一编译production、同一路线、Stop AI停留至少10秒；9红+13fog仍全部active；Stop AI定点帧`p95≤20ms`、`max≤34ms`、无长任务/异常/坏请求；离屏/返回/shutdown合同全部回归通过。随后Human重新检查红烟连续性、orange fog可见度和深度穿插。
5. **失败处理**：若`quantity2`自动条件或Human视觉仍失败，回到本差异表，不直接降到`quantity1`，由Human重新决定密度/视觉取舍；在S1重新通过前不启动S2。

### 实施与自动验证结果

- candidate：`c4b2d6a`；只改`src/fx/fog.ts`、`game/PhaserFogRuntime.ts`、`tests/fx/fog.test.ts`和Stop AI production probe，公开FACT quantity4保持不变。
- PASS：typecheck、定向10项、全量68 files / 363 tests、build；独立verifier PASS。
- PASS：compiled preview真实路径定点10,001ms/575帧，p95 16.8ms、max33.4ms、longtask0、>34ms=0；9 red/13 fog active，离屏/返回generation2/wind/shutdown和错误收集均通过。
- 收据：`.pi/worktrees/visible-product-integration/.pi/audit-evidence/05e-s1/correction-round-1/final/receipt.json` SHA-256 `7085f67732c94798663d6baa72d98999e6c5c6bfda2e63b3c22998aa2b6dcb1d`；截图见同目录`final/screenshots/`。

## Human Plan Gate

Human已在编译production视觉Gate拒绝S1，反馈红烟运动“卡卡的、不丝滑”（2026-08-25）。随后明确接受`quantity 4→2 (Recommended)`：保留13-cell核心、清雾/生命周期和红烟公开参数，只实施orange fog呈现密度修复，并按定点帧门禁重新回归。该接受已登记为`DEC-P5.4-05E-S1-SMOOTHNESS-001`；修复candidate `c4b2d6a`已自动/production验证通过，当前只等待Human重新视觉验收，不启动S2–S4。

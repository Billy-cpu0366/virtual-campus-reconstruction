---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
type: systemic-batch-implementation
system: SYS-FX + SYS-NPC
issue-class: systemic-failure
status: completed
audit-status: human-visual-verified
result-commit: 1d16393
verification-evidence: .pi/audit-evidence/05e-npc-visual-repair-018/
human-gate: passed
plan-decision: DEC-P5.4-CROSS-OWNER-VISUAL-REPAIR-006
workflow-ref: 03-执行层/修正任务分流协议.md
decision: DEC-P5.4-CROSS-SYSTEM-VISUAL-REPAIR-001
correction-decision: DEC-P5.4-SYS-NPC-VISUAL-REPAIR-002
extension-decision: DEC-P5.4-SYS-NPC-VERTICAL-EXIT-004
follow-up-decision: DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004
updated: 2026-08-27
---

# 05-E / SYS-NPC 跨系统视觉修复包

## 1. Human授权结果

Human明确接受“全部四类问题一起处理”：

1. 烟雾清除时整片突兀消失；
2. 直升机、警车资源和可见创建链缺失；
3. Stop AI附近NPC闪烁/闪现；
4. route NPC在视口内消失或固定点冒出。

本包是一个父工作项下的四个owner修复包，不把它们合并成通用Entity/NPC/粒子框架。NPC专项从延期状态仅恢复本包涉及的route、venue/Stop AI presentation和车辆资源owner；其他NPC owner、B2–B5仍未授权。

## 2. 硬验收约束

### Fog

- 清cell只停止新粒子；存活粒子自然淡出；不能同帧停止并隐藏整个cell。
- 保留13-cell核心、公开参数和已接受的quantity2呈现取舍。
- 离屏、返回、wind、respawn和shutdown合同不能回归。

### NPC

- 当前摄像机视口内，NPC不得通过`alpha=0`、`destroy`、presentation重建或瞬移消失/出现。
- NPC只能从视口外连续走入，或因自身连续移动走出视口安全范围后回收。
- 不能用“淡出后隐藏再重置”掩盖视口内断裂。
- 保留各组`goBack`和`deleteAfterComplete`语义，不把所有NPC统一改成循环。
- 资源、静态/venue和route必须分别保留owner边界。

### 车辆

- 资源必须经过仓库内公开镜像→运行资源白名单→preload→owner创建→可见验证完整链路。
- 不用替代贴图，不把缺失对象伪装成已集成。

## 3. 四个实施包

### A. Fog clear presentation

允许修改`src/fx/fog.ts`、`game/PhaserFogRuntime.ts`、对应`tests/fx/fog.test.ts`和必要的Stop AI定点probe。实现clear状态与粒子存活状态分离，补单cell、相邻cell、整区穿行和respawn回归。

### B. Helicopter / police asset owner

允许修改`game/`中新的专用车辆owner、`game/CampusScene.ts`的最小接线、`scripts/prepare-runtime-assets.mjs`、`scripts/check-runtime-assets.mjs`、对应测试和必要probe。只接入公开已存在的直升机主体/rotor/high-res及警车资源和配置；不建立通用Entity框架，不修改地图、玩家、火车和`sample/`。

### C. Route NPC visibility continuity

允许修改`src/npc/routeCrowd.ts`、`game/PhaserRouteCrowdRuntime.ts`、对应route测试和必要probe。把route完成/回收变成视口安全生命周期：视口内保持同一presentation身份和连续可见性；只有屏外才可回收、重置或删除。不得把所有路线改为循环。

本轮追加授权：对公开`drinkers`组增加终点后的连续安全出口；同一语义现经`DEC-P5.4-SYS-NPC-VERTICAL-EXIT-004`明确扩展到`vertical-crowd-reverse`。两组均保持`goBack:false`与`deleteAfterComplete:false`字段，不用alpha/destroy/屏内重建/瞬移掩盖完成态；其他route不套用。

### D. Stop AI venue/static presentation

允许修改`game/PhaserVenueCrowdRuntime.ts`、必要的`game/PhaserStaticCrowdRuntime.ts`及对应测试/probe。先保留逐帧owner证据，区分烟雾遮挡、分帧物化和真实sprite create/destroy；再以视口连续性为停止条件修复。不得扩大到未授权NPC owner。

本轮追加授权：将`npc_protester_rising`按实际64×64格加载并校正可见边界；仅对coffee对应的两个重叠静态region做跨region局部间距去重，可修改`src/npc/staticCrowd.ts`及其测试；不得改全局静态密度策略或其他region。

## 4. 权威输入

- `03-执行层/05-旁支/01-NPC.md`
- `03-执行层/05-旁支/03-动效与粒子.md`
- `task-todos/WI-SYS-FX-FACTORY-SMOKE-001-05E公开烟雾审计.md`
- `sample/original-public-build/mirror/chunk-WMFY56ZM.js`
- `sample/original-public-build/mirror/assets/`
- 当前产品candidate：`.pi/worktrees/visible-product-integration`，基线`c4b2d6a`

## 5. 禁止路径与边界

- 不修改`sample/`公开证据、旧Phaser项目、正式根`src/`、玩家、地图、相机、火车路线/scale/timing、roof、30FPS或远端。
- 不恢复旧烟雾入口预览，不启动S2–S4。
- 不扩展到rat、ghost、birds、sprayer、fixed special、dancing、完整NPC B2–B5。
- 不创建通用Entity/NPC/particle框架。
- 不以自动测试、对象计数或probe代替Human视觉验收。

## 6. 验证与停止条件

每个包必须先通过自身typecheck/专项测试，再在同一编译production路径重放；父包最终还要通过全量测试、build、资源检查、完整browser smoke和Human视觉复验。

遇到以下任一情况立即停止该包并回报，不扩大范围：

- 公开配置或资源owner仍无法确认；
- 修改需要触碰禁止路径；
- NPC无法证明屏外创建/回收；
- 修复需要改变`goBack`/`deleteAfterComplete`产品语义；
- 自动检查通过但Human视觉仍出现视口内消失、出现、闪烁或瞬移。

## 7. 输出收据

每个包返回：实际修改路径、根因对照、专项检查、失败/UNKNOWN、未解决风险。Main负责合并共享接线、审查完整diff和最终Human Gate；本包已通过Human视觉并关闭05-E，但不自动进入S2。

## 8. 历史实施结果（自动与生产验证通过，后续由Human复验）

- Fog：产品提交`4ace8b5`；清除时停止新粒子、保留存活粒子可见；Fog专项8项通过。
- route：产品提交`73df384`；屏内保持alpha/identity，active cap释放不在屏内冒出；route专项29项和production probe通过。
- 车辆：产品提交`180865d`、Main接线`5ea711d`；资源白名单、preload、专用owner、直升机主体/双旋翼/high-res、3辆警车已接入；production快照与直升机截图通过。警灯和动态车辆行为保持UNKNOWN。
- venue/static：产品提交`7341cc0`；可见region原子ready、屏内sprite不销毁；专项测试和Stop AI连续性采样通过。
- probe：产品提交`883faa2`；真实Stop AI probe收集289次清雾样本、47次NPC连续性样本，route production probe通过。
- 父回归：`npm test`（69个测试文件/398项测试）、`npm run typecheck`、`npm run check:runtime`和当前产品worktree普通production build通过；普通入口`browser:smoke`与test-hooks `browser:chunk-smoke`均PASS；无console/exception/failed request/bad response。
- 独立reviewer复核当前diff与005收据PASS；其结论只证明代码/客观条件，不代替Human视觉验收。
- Human已验收烟雾、车辆和飞机；本轮警车阻挡、Stop AI两人/公开英文口号和coffee非空分道已通过自动与production验证，Stop AI与coffee仍需Human直接复验。
- 当前结果：产品提交`9233b20`完成`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-003`的警车/Stop AI有界修复及`DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004`的coffee非空分道调度；保留`goBack:false/deleteAfterComplete:false`和连续退场。4182生产探针PASS：Stop AI采样50帧，coffee同时2个reverse route NPC，region 38/61均为0，组合最小中心距118.36277297772581px，警车`blockedRight=true`，浏览器错误全为0。收据位于产品worktree`.pi/audit-evidence/05e-npc-visual-repair-005/receipt.json`，SHA-256 `65c9dc41b52f970480d016d8071310cc6d62fff22491afb2328046646a283381`。
- 父任务未关闭；Human最终视觉通过前不关闭05-E，不启动S2–S4或完整SYS-NPC B2–B5。

## 9. Human失败差异表（第二次审计后扩展已实施，等待Human复验）

| 差异 | Expected source | Actual evidence | 根因簇 | 当前结论 |
|---|---|---|---|---|
| Stop AI人物闪现、部分半身 | Human要求视口内NPC完整、连续、不能错误帧或呈现断裂 | `npc_protester_rising.webp`实际为`512×1024`，即8×16个64×64格；`game/PhaserVenueCrowdRuntime.ts`当前preload按48×48切帧，运行时frame为48×48；Stop AI自动identity采样通过但未测像素/帧 | 专用spritesheet几何错误（高可信）；高层烟雾/地图前景遮挡为次要候选，尚未单独证伪 | 先修专用64×64帧合同并补逐帧/截图证据；不改已验收Fog语义 |
| coffee路线NPC齐刷刷成坨 | Human要求路线人群视觉分散，不能在视口内堆成静止一团 | 新build固定coffee视口`(x≈1160..1640,y≈753..1023)`连续审计：`drinkers`已在视口外；实际画面为9个`vertical-crowd-reverse`实例在约`(1400,904)`终点变成`gone+visible`，另有静态38/61共8个实例 | 先前只修`drinkers`，漏掉同样为`goBack:false/deleteAfterComplete:false`且终点落在coffee视口内的`vertical-crowd-reverse`；这是同一类非往返完成态驻留，但owner和路径需单独复核 | 已按Human接受的扩展只为明确coffee owner增加有界连续安全退场，保留该组公开flags；已验证静态去重与路线离场叠加效果，待Human视觉复验 |

### 首次方案执行结果与第二次审计方案（已接受并实施）

1. **Stop AI专用帧合同**：`npc_protester_rising`已按64×64 spritesheet加载；新build逐帧收据显示texture frame/cut/display均为64，固定视口连续50帧通过。Human视觉仍需确认没有半身/闪现。
2. **首次coffee方案结果**：`drinkers`已保持公开起点、终点及`goBack:false/deleteAfterComplete:false`，沿`forwardPath`反向连续走到屏外再restart；静态38/61局部最小间距为32px以上。但这只证明`drinkers`根因，不证明coffee视口整体通过。
3. **第二次owner审计结果与修复**：确认`vertical-crowd-reverse`公开起点/终点/flags；其终点约`(1400,904)`及9个实例在视口内`gone+visible`。Human已通过`DEC-P5.4-SYS-NPC-VERTICAL-EXIT-004`授权该组沿完整原始路径连续反向走到安全视口外再restart；产品提交`16c74bb`已实现，不扩展到其他route。

**当前结论**：Stop AI新build帧/边界审计、两个coffee route owner的完整路径退场和静态38/61间距已通过自动/生产证据；完整69文件/389测试和编译通过。Human最终视觉验收仍待，自动证据不能代签。

## 10. 新一轮Human反馈与统一审计（2026-08-27）

Human在当前本地production预览中新增4条反馈：警车可站立/穿透、Stop AI街对面5个NPC用途不明、Stop AI抗议口号气泡缺失、coffee街NPC仍在窄区聚集且间距不足。按修正协议，本轮保持`systemic-failure`；Human已接受`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-003`，现在进入批量实现。

| 差异 | 当前证据 | 状态与未知 |
|---|---|---|
| 警车可站立/穿透 | `PhaserVehicleRuntime`只创建3个`car-police`显示Sprite；`CampusScene`当前玩家碰撞只接Tilemap/walls/bridge，未接警车Body/collider。公开Bundle静态`staticCars`也以`add.sprite`创建；原站未直接证明静态警车应阻挡玩家。 | Human观察是实际行为事实；Human已接受“警车必须不可穿透”的新产品验收期望；碰撞修复已获本轮授权。 |
| Stop AI街对面5个NPC | 该5人属于公开`crowd_up`静态区域（本地`regionIndex=64`，约`x=1480,y=1176..1304`），公开规则对退化边界使用`max(5, ...)`；当前实现按该规则生成5人。其原站该退化区域的实际运行时布点仍UNKNOWN。 | 不是无来源的随机NPC；其功能是环境背景，不承担交互。Human已选择局部减少为2人，不迁移或删除整个owner。 |
| Stop AI抗议口号气泡缺失 | 公开Bundle存在`People, not machines!`、`Jobs for humans!`、`Human > machine`及`speech-bubble`随机展示/回收机制；当前`PhaserVenueCrowdRuntime`没有口号、气泡节点、定位或清理。 | 同义公开文案和机制为FACT；用户所说中文语义不是公开原句；Human已选择公开英文轮换，本轮采用可见时显示、离屏/关闭/shutdown清理的有界呈现。 |
| Coffee路线窄区拥挤 | `completionExit`已清除终点`gone+visible`；但`drinkers`、两组vertical路线与静态region 38/61仍在同一窄区叠加。当前静态跨区中心距为35.35px，而NPC显示尺寸为48px；公开Bundle没有coffee间隙、密度或最小距离数值。 | 路径几何、随机起点和静态叠加是高可信根因；Human已接受仅对coffee局部采用中心距`>=56px`（48px精灵外加8px空隙）作为重构DECISION。 |

### Accepted batch plan（Human已接受）

1. **Vehicle collision packet**：只改`PhaserVehicleRuntime`、`CampusScene`和车辆/碰撞测试；3辆静态警车接入玩家阻挡碰撞，保持警车路线、贴图、地图和玩家核心不变，并补shutdown清理。
2. **Stop AI content/ambient packet**：将公开`crowd_up`背景从5人局部重构为2人，并为`protesters_rising`加入公开英文口号轮换气泡；不把背景人群误迁为抗议者，不改其他静态region或未授权NPC owner。
3. **Coffee spacing packet**：仅约束coffee局部route occupancy与静态38/61 placement，使相关NPC中心距至少56px；保留两个route的公开flags和已修好的连续退场，不改全局offset、其他路线或地图。

本轮首次实现尝试已执行；完成后必须通过专项测试、全量回归、生产探针和Human视觉验收。

## 11. 新方案视觉失败（2026-08-27）

- **自动结果**：警车碰撞、Stop AI protester/英文气泡、对街背景2人、coffee局部无间距违规均通过；完整测试为69个文件/396项，typecheck、runtime asset check和build通过。
- **视觉结果**：coffee-before/coffee-after截图中该区域没有可见NPC。原因是为满足`>=56px`而同时禁用了静态38/61并把coffee route并发压到只剩1个，形成了空场景；这不是可接受的“有间隙”。
- **结论**：本轮自动PASS与视觉结果冲突，按`systemic-failure`退回audit；产品worktree保留未提交失败尝试，不创建新的零散修补。失败证据位于`.pi/audit-evidence/05e-npc-visual-repair-003-failed/`，receipt SHA-256 `ce1eb475f1d31df1c3b0a1831cf181b0d62aa492e1d4632c8f0bcaf5ee2a10d8`。
- **下一Gate已接受**：coffee局部至少同时保留2个可见route NPC，任何同时可见中心距`>=56px`；静态38/61继续不生成，采用两条错峰/分道route或等价局部调度。当前按`DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004`重新实现。

## 12. 非空coffee重实现结果（2026-08-27）

- **已落盘**：产品提交`9233b20`完成警车静态Arcade阻挡、Stop AI背景2人和公开英文口号轮换；coffee局部只允许`vertical-crowd-reverse`，最多同时2个，静态region 38/61不生成；两条实例从屏外固定起点/延迟进入，并以±40px显示分道。未改变公开route配置的`goBack:false`、`deleteAfterComplete:false`，也未把安全退场语义扩展到其他route。
- **已验证**：`npm test`为69个文件/398项，`npm run typecheck`、`npm run check:runtime`、普通production build、普通入口`browser:smoke`、test-hooks `browser:chunk-smoke`和独立reviewer均PASS。4182生产探针收据显示Stop AI连续50帧、三条口号、警车`blockedRight=true`、coffee同时2个route NPC、region38/61为0、组合最小中心距118.36277297772581px、console/exception/failed request/bad response均为0。
- **证据**：`.pi/audit-evidence/05e-npc-visual-repair-005/receipt.json`，SHA-256 `65c9dc41b52f970480d016d8071310cc6d62fff22491afb2328046646a283381`；四张前后截图在同目录`screens/`下，清单见`SHA256SUMS`。005目录按仓库规则不纳入Git提交，保留在产品worktree供Human复验。
- **当前状态**：`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-003`的首次coffee尝试失败证据仍保留；`DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004`已实现并自动/生产验证，但被本次Human复验的新问题重新阻塞。父任务退回统一`human-plan-gate`，不关闭05-E，不启动S2–S4或SYS-NPC B2–B5。

## 13. 新一轮Human反馈统一审计与授权（2026-08-27）

Human在复验`9233b20`后新增四组观察：警车已挡住玩家但NPC仍踩车；coffee路线希望至少10个NPC且有NPC走墙；END OF THE WORLD PARTY的下门/侧门淡入淡出不一致、房内无原站灯光和NPC动作、左侧门栅栏可穿过；左下角bug贴图像“1.1个”。按修正协议，本轮保持`systemic-failure`，先完成统一审计，不按症状直接改代码。

| 差异 | 已确认事实与当前代码 | 根因/状态 |
|---|---|---|
| 警车上的NPC | `PhaserVehicleRuntime`为3辆警车创建静态64×48 body；`CampusScene`当前只注册player×police collider。`PhaserRouteCrowdRuntime`的`isBlocked`只检查火车占格，`BugCrowdRuntime`只消费静态walls grid。 | 动态警车未进入移动NPC寻路阻塞链，根因已确认；Human已接受本次审计覆盖的route/bug移动NPC统一避让。 |
| coffee数量与走墙 | 当前coffee白名单仅允许`vertical-crowd-reverse`且上限2，静态38/61为0；该公开配置当前`ignoreWalls=true`。因此“至少10”曾是新目标，“走墙”是独立的墙格语义缺陷候选。 | Human已接受至少10个同时可见且任意中心距继续≥56px；实现不得保留`ignoreWalls=true`。 |
| END OF THE WORLD PARTY | 公开Bundle的`concert_venue`为dark zone，含2个spotlight、red/blue color light和6条laser；`concert_crowd`为loop route。当前产品只有统一矩形`CONCERT_ROOF_BOUNDS`的300ms roof tween；`PhaserVenueCrowdRuntime`只对protesters做动作，`PhaserDancingCrowdRuntime`位置在另一处，未接concert灯光owner。当前walls碰撞虽存在，但左侧栅栏准确格坐标尚未确认。 | 灯光/party concert动作缺失已确认；Human已接受公开Bundle最小复刻，双入口roof和左侧栅栏继续按固定路径验证后实现。 |
| 左下角bug贴图 | 当前`PhaserBugCrowdRuntime`以48×48裁切`npc-bug`，不设公开`.63`缩放/24帧动画；公开Bundle加载该资源为38×38、frame0–23并约`.63`显示。 | 贴图合同错误已确认；Human已接受38×38/24帧/`.63`最小修复，完整bug行为仍不扩展。 |

### Accepted repair packages（Human已接受）

1. **动态NPC导航与coffee包**：本次审计覆盖的route/bug移动NPC统一消费警车动态阻塞与walls网格；`vertical-crowd-reverse`不得穿墙；coffee按至少10个同时可见且任意中心距继续≥56px重新做容量/分道/起点调度，并为警车、墙格和数量补固定production probe。
2. **END OF THE WORLD PARTY venue包**：按公开Bundle已证实的dark zone、2 spotlight、红蓝移动灯、6 laser和concert loop动作建立专用owner；用下门/侧门固定路径验证同一300ms roof fade；先固定路径定位左侧栅栏，再接入准确碰撞；补灯光、动作、入口、障碍和shutdown验证，不凭截图猜视觉细节。
3. **bug贴图包**：修正`npc-bug`的38×38/24帧/`.63`显示合同，补左下角固定视口截图和frame geometry验证；不顺带扩展bug AI。

**历史Gate记录**：三包实现和完整自动回归已通过；当时等待Human视觉Gate，后续已由Human确认并关闭本包。

## 14. 三包实现与最终自动验证结果（2026-08-27）

- **已落盘**：产品提交`0f3e646`。A包让route/bug移动NPC消费警车动态阻塞与walls网格，reverse coffee使用10个camera内分道实例和最终sprite坐标reservation；B包新增party lighting owner（1 dark zone、2 spotlight、2 color light、6 laser）及concert loop动作，并验证下门/侧门roof状态；C包修正bug 38×38、24帧、`.63`和方向帧。
- **已验证**：`npm test`为70个文件/405项，typecheck、runtime asset check、普通production build、普通入口`browser:smoke`、test-hooks `browser:chunk-smoke`和独立reviewer PASS。扩展production probe PASS：coffee camera内10人、最小中心距`65.03389289370136px`、route/bug警车违规0、墙格违规0；party双入口均300ms、11个灯光对象、concert动作计数30、固定左门障碍路径停在`x=1794`；bug实际采样10个，截图可见，console/exception/failed request/bad response均为0。
- **证据**：`.pi/audit-evidence/05e-npc-cross-owner-repair-008/receipt.json`，SHA-256 `c7527df4a95050245b7a8fd89feb1d85668298e5e3c571c5ffc9e04a0dce7702`；前后截图在同目录`screens/`，清单见`SHA256SUMS`。证据目录按仓库规则不纳入Git提交，保留在产品worktree。
- **当前状态**：上一轮008已被Human否定；按006完成简化coffee、party回退和Stop AI气泡缩小。Human反馈整体勉强可接受但字体发糊；产品提交`1d16393`改为粗体并取整气泡坐标，完整自动回归和018 production证据通过，Human已确认字体修复，本包已关闭；完整SYS-NPC/B2–B5及S2–S4仍不启动。

## 15. Human复验失败与重新审计入口（2026-08-27）

- **classification**：保持`systemic-failure`；本次触发为同类coffee连续修复仍无进展，同时出现性能回归和party/Stop AI新呈现问题；自动production PASS与Human实际体验冲突。
- **evidence-known**：Human直接反馈为coffee NPC闪现、穿墙、明显卡顿；party当前实现要求回退上一版本；Stop AI对话框尺寸过大。`0f3e646`保留为失败复现基线，旧`9233b20`及其party相关差异作为版本对照。
- **scope-confidence**：`unknown`。目前不能假设coffee只是单个墙格判断，也不能假设party只需回滚一个文件；需要一次性审计启动/路径/呈现/性能和版本差异。
- **work-stopped-at**：停止继续修改代码、停止关闭05-E和启动S2–S4；当时阶段为`cluster`。
- **next-required-step**：该历史入口已完成；产品提交`1d16393`的字体修复已获Human确认，当前不再继续本包修补。

## 16. 根因聚类与一次性方案（Human已接受）

| 根因簇 | 已确认事实/证据 | 已接受处理 | 主要代价与未知 |
|---|---|---|---|
| Coffee路径—显示脱节与启动负载 | `game/PhaserRouteCrowdRuntime.ts:24-90,352-426`将`vertical-crowd-reverse`显示X强制投影到`1288/1368/1448/1528`，没有对投影点再做walls检查；核心A*仍沿另一条路径。`src/npc/routeCrowd.ts:381-387`使有界coffee候选达到约95条，`gridPathProvider.ts:139-175`每条路径还检查8方向和警车阻塞。受控performance smoke的持续移动段p95为16.8ms，但入口出现一次50ms帧；这不能否定Human看到的NPC停顿/闪现。 | 回到`16c74bb`的最小连续退场/原路径显示语义：移除coffee强制车道、显示层reservation、20秒统一delay和为满足10人而扩大的候选池；NPC显示只跟随通过walls检查的实际`item.position`。保留完成态从屏外连续退场；对当前coffee owner显式保留必要的walls保护。 | 不再保证上一轮“10人同时可见”的重构偏好；需重新验证可见数量、连续性、墙格和真实帧时间。具体是否保留共享警车阻塞需在实现前按固定路径核对，不先猜。 |
| Party过度新增呈现 | `0f3e646^=fca08dd`；`0f3e646`新增`game/PhaserConcertLightingRuntime.ts`、Main接线和`PhaserVenueCrowdRuntime` concert action；截图显示大面积紫色dark zone、彩色光晕和绿色laser覆盖房间。roof来自更早`18ee2d1`，不是本次新增。 | 仅回退party新增内容到`fca08dd`：删除lighting owner及接线、删除concert action分支；保留roof、警车/墙路径和Stop AI speech bubble，不整体回退`0f3e646`。 | party灯光/动作恢复为旧版；是否仍需后续更精确复刻另行授权。若Human说的“上一版”包含roof，则需另定早于`18ee2d1`的基线。 |
| Stop AI speech-bubble规格 | `0f3e646`未新增气泡；气泡由`9233b20`引入，`game/PhaserVenueCrowdRuntime.ts:351-404`使用Phaser world `add.text`，`12px monospace`、左右5/上下2、无宽度约束；最长英文句子会自然扩宽。公开CSS仅证明原站有10px/桌面14px的Press Start气泡，不能直接替代Human当前尺寸偏好。 | 保留公开英文口号与清理/最多2人的语义，只将世界气泡缩小并限定最大宽度/留白；采用8px字体、左右3/上下1的有界规格，随后用同一Stop AI视口截图验收。 | 8px是本次Human接受的重构规格，不是原站FACT；不能以自动文本状态代替目视。 |

**停止条件**：coffee固定视口连续重放中，sprite坐标始终等于可行路径坐标（允许统一小于1像素的渲染误差）、墙格违规0、无身份/可见性断裂、无屏内重建；启动和移动固定帧采样无超过34ms长帧，且Human不再看到卡顿。party画面不再有当前新增的紫色覆盖/彩色大光晕/绿色laser；Stop AI气泡按8px规格可读且不遮挡NPC。自动检查仍不能代替Human验收。

## 17. 006实现结果（Human Gate已在后续完成，2026-08-27）

- **已落盘**：产品提交`50ab1ba`。coffee移除固定显示车道、显示层reservation、10人扩容和统一20秒delay，保留真实walls-safe路径与完整连续退场；party断开`0f3e646`新增lighting/concert action，保留roof；Stop AI气泡使用8px、左右3/上下1和128px word-wrap。
- **已验证**：`npm test`为70个文件/405项，typecheck、runtime asset check、普通production build、普通入口`browser:smoke`、test-hooks `browser:chunk-smoke`和性能Smoke通过；017 probe显示coffee display/path mismatch为0、display wall violation为0，party lighting为null、concert action为空，Stop AI实际气泡字体为8px且最大宽度108px，console/exception/failed request/bad response均为空。
- **证据**：`.pi/audit-evidence/05e-npc-visual-repair-017/receipt.json`与`performance.json`，`SHA256SUMS`校验通过；截图在同目录`screens/`。证据目录按规则不纳入Git提交。
- **当前状态**：自动和客观验证已完成；Human已反馈coffee/party等整体勉强可接受，当前仅需直接复看Stop AI字体是否不再发糊。通过前不关闭05-E。

## 18. Stop AI字体清晰度缺陷修复（2026-08-27）

- **Human反馈（已确认）**：气泡大小现在合适，但8px普通等宽字在当前画布放大后过于发糊；这是单一呈现层缺陷，不改变文案、大小或生命周期。
- **最小修复（已落盘）**：产品提交`1d16393`在`game/PhaserVenueCrowdRuntime.ts`仅加入`fontStyle: "bold"`，并将气泡x/y坐标整数化；8px、padding 3/3/1/1、128px word-wrap、三条英文口号和清理语义保持不变。
- **验证（已验证）**：70个测试文件/405项、typecheck、runtime asset check、production build、普通入口Smoke、test-hooks跨块Smoke和018 production probe通过；018截图显示字体粗体版本，浏览器console/exception/failed request/bad response均为空。独立reviewer无阻塞问题。
- **Human Gate（已通过）**：Human回复“ok。那就继续收口吧”，确认字体修复和本包最终视觉结果；018自动证据与人工验收分开记录。

## 19. Human最终验收与工作项关闭（2026-08-27）

- **Human接受**：Human表示各部分“勉勉强强”，指出唯一剩余问题为Stop AI气泡字体发糊；在`1d16393`粗体/整数定位修复后回复“ok。那就继续收口吧”，视为本次有界视觉Gate通过。
- **已落盘**：任务卡状态为`completed`，产品结果为`1d16393`，根状态/总账/决策记录同步关闭05-E；018证据目录仍保留在产品worktree，不纳入Git。
- **已验证**：70个测试文件/405项、typecheck、runtime asset check、production build、普通入口Smoke、test-hooks跨块Smoke、018 production probe、证据哈希和独立review均通过。
- **关闭边界**：本次只关闭05-E跨系统有界修复包；完整SYS-NPC仍延期，B2–B5和S2–S4未授权，不自动启动新的实现或远端交付。

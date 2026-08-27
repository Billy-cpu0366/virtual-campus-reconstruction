---
tags: [虚拟校园, 执行层, 系统卡]
system: SYS-NPC
status: designed
audit-status: cross-owner-repair-005-implementation-authorized
work-item: WI-SYS-NPC-SPECIAL-001
result-commit: 9233b20
verification-evidence: .pi/audit-evidence/05e-npc-visual-repair-005/
authorization-ref: DEC-P5.4-CROSS-OWNER-VISUAL-REPAIR-005
updated: 2026-08-27
---

# NPC 与环境实体（SYS-NPC）

## 👀 先看这里（人话总结，给 Human）

**当前结论候选**：SYS-NPC不是一个统一运行时，而是多类独立owner组成的家族：路线/事件群众、区域静态群众、venue人群、固定special、sprayer、encounter、ghost和moving-sprite。不同owner的激活、动作、视口、回收和失败路径有实质差异，不能再用一套“NPC出现/移动/消失”模型统一修补。

**当前状态**：Human已接受[Phase A机制与覆盖报告](../../task-todos/WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)中的owner家族、六状态、RC-NPC-1..6与`B0→B5`顺序；[B0证据收口](../../task-todos/WI-SYS-NPC-SPECIAL-001-B0证据收口.md)已完成。B1候选`b6a4e6c`虽通过自动门禁，完整NPC专项仍未通过Human视觉；本次Human明确重新授权一个有界跨系统修复包，仅覆盖route连续性、Stop AI venue presentation和直升机/警车资源owner。产品提交`9233b20`已完成上一轮警车、Stop AI和coffee局部修复并通过自动/生产验证；本次Human复验新增警车动态阻塞、coffee数量/墙格、party venue和bug贴图差异，统一审计已完成，Human已接受`DEC-P5.4-CROSS-OWNER-VISUAL-REPAIR-005`并授权三包成批实现，其他NPC owner继续延期。

**当前硬边界**：完整SYS-NPC专项仍按`DEC-SYS-NPC-DEFER-001`延期；本次仅按`DEC-P5.4-CROSS-SYSTEM-VISUAL-REPAIR-001`及已接受的`DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004`修正route、Stop AI venue presentation和车辆资源owner的有界范围，不恢复完整B1视觉签字或B2-B5。烟雾、车辆和飞机已由Human验收；本轮警车阻挡、Stop AI背景2人/公开口号、coffee reverse白名单与分道已自动/生产验证通过，Human最终视觉仍待确认，不重做已通过owner。rat、ghost、birds正常产品入口，铁路合法性、完整shutdown和resource-only对象身份仍是UNKNOWN；不建立通用NPC/Entity框架。

## 新增Human视觉证据（2026-08-25至2026-08-27，修复后等待Human最终验收）

Human在同一编译production路径新增观察：Stop AI附近NPC会闪烁/闪现；部分NPC行走到某处消失，固定位置又突然冒出；同时直升机和警车没有贴图。这些是有效的视觉失败证据，但不等于取消NPC延期或授权修改。

- **资源链缺口（已定位）**：公开镜像存在`npc-helicopter.webp`、两个rotor、high-resolution及`car-police.webp`等文件，公开Bundle也有preload和创建配置；当前`prepare-runtime-assets.mjs`/`check-runtime-assets.mjs`的白名单没有它们，`CampusScene`也没有moving-sprite/vehicle owner或对应preload/创建链。因此不是单个图片URL失败，而是资源→preload→owner→附属部件整链缺失。
- **Stop AI闪烁（尚未完全定位）**：公开`protesters_rising-87`区域与Stop AI相邻/重叠；当前`PhaserVenueCrowdRuntime.ts`每次`sync`最多新建16个sprite（约128–143），而Stop AI fog深度1100高于当前NPC约`500+y*.1`的呈现深度，烟雾遮挡和分帧物化都可能造成闪烁。必须用逐帧owner ID、sprite create/destroy、depth和fog可见性区分，不能先把观察定性为单一NPC逻辑Bug。
- **行走后消失/固定点冒出（route高可信）**：历史candidate在非`goBack`且非`deleteAfterComplete`完成时直接把NPC重置到`start`并将alpha置0；公开Bundle的`fadeOut→hidden→reset/fadeIn`是来源事实，但不能直接作为产品修复：只要终点或起点在Human视口内，任何淡出、隐藏、destroy、presentation重建或瞬移都会违反当前验收约束；static/venue仍不能套用route结论。本轮产品只对已授权的两个coffee owner增加连续退场。
- **Human接受的视口连续性硬约束**：NPC在当前摄像机视口内必须保持连续的presentation身份与可见性；不得通过`alpha=0`、`destroy`、重建或瞬移消失/出现。NPC只能从视口外连续走入，或因自身连续移动走出视口后再回收。路线仍按各组`goBack`/`deleteAfterComplete`处理，不把所有NPC改成循环。Stop AI帧修正、`drinkers`和`vertical-crowd-reverse`退场已通过自动/生产收据，但coffee整体视觉仍未通过Human验收，不能把自动PASS当作最终签字。

**处理决定**：Human已接受以上四包一起实施，并已验收烟雾、车辆和飞机；NPC部分在产品分支`883faa2`的自动/真实路径收据及独立复核通过后仍未通过肉眼验收：Stop AI人物仍闪现且部分只显示半身，coffee路线NPC仍齐刷刷站成一坨。系统性审计后Human接受`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-002`并已实施：按实际64×64帧修正Stop AI专用人群；让`drinkers`沿连续出口走到屏外后再restart；只对coffee两个重叠静态region做局部去重。新build复审确认coffee实际堆积owner是`vertical-crowd-reverse`；Human随后接受`DEC-P5.4-SYS-NPC-VERTICAL-EXIT-004`，只对该组沿完整原始路径增加连续屏外退场。产品提交`9233b20`已通过专项/全量自动检查、普通入口Smoke、test-hooks跨块Smoke和4182生产探针，当前等待Human最终视觉验收。static crowd的其他行为、rat、ghost、birds、sprayer、fixed special、dancing及B2-B5仍保持延期。实现的停止条件是“视口内零可见性断裂、零瞬移、零屏内创建/销毁”，不是“完成淡出后重置”。

## 本轮Human视觉回退（2026-08-25；修复后待复验）

- **已接受**：烟雾表现、直升机和警车画面通过；这些owner不在本轮NPC修正中重做。
- **历史未接受**：Stop AI人物仍闪现，部分人物只有半个身子；coffee路线仍出现多个NPC齐刷刷堆在同一处。该失败已进入本轮有界修复，最终Human复验尚未完成。
- **分类**：保持`systemic-failure`。自动/真实路径收据与Human观察冲突，且问题同时涉及venue/呈现层与route/路径层；首次整体方案已实施但被新build视觉审计证明范围不足，停止零散修补并重新做owner审计。
- **首次方案已验证部分**：Stop AI专用`npc_protester_rising.webp`按实际64×64加载；新build固定视口连续50帧的texture frame/cut/display均为64。`drinkers`已沿`forwardPath`连续退场，静态38/61最小间距为39.54px；这些是局部自动证据，不是Human整体验收。
- **第二次审计根因簇**：coffee地点名仍UNKNOWN；新build固定视口`x≈1160..1640,y≈753..1023`中，`drinkers`已经在视口外，但9个`vertical-crowd-reverse`实例在约`(1400,904)`终点呈`gone+visible`，并与静态38/61的8个实例叠加。该组同样为`goBack:false/deleteAfterComplete:false`，是当前coffee堆积的真实route owner；Human已接受其沿完整原始路径连续反向走到安全视口外再restart，产品实现和生产复验已通过，待Human视觉复验。追加根因是`randomPositions`会把首次`forwardPath`截成中途waypoint之后的后缀，旧反向逻辑只能回到视口内的随机起点；产品提交`16c74bb`保存完整原始路径作为exit/restart path。

## 本轮修复与验证收据（2026-08-27）

- 产品提交：`9233b20`；保留`drinkers`与`vertical-crowd-reverse`公开起点/终点及`goBack:false/deleteAfterComplete:false`，completion-exit沿完整原始路径回到屏外起点；coffee局部只允许reverse route、最多2个，并用屏外固定起点/延迟与±40px显示分道；新增随机起点、白名单和固定调度回归测试。
- Stop AI/车辆：三辆静态警车接入玩家阻挡并在shutdown清理；region64背景为2人；`People, not machines!`、`Jobs for humans!`、`Human > machine`三条公开英文口号按可见NPC轮换并清理。
- 自动验证：69个测试文件、398项测试，typecheck、runtime asset check和普通production build全部PASS；普通入口`browser:smoke`与test-hooks `browser:chunk-smoke` PASS。
- 生产验证：`npm run browser:npc-visual-production -- http://127.0.0.1:4182/` PASS；Stop AI连续采样50帧，coffee同时2个route NPC，region38/61为0，组合最小中心距118.36277297772581px，警车`blockedRight=true`，console/exception/failed request/bad response均为0。
- 看门狗：总墙钟30秒、单次CDP调用5秒、每2秒心跳；超时自动暂停页面、尝试截图并写出`TIMEOUT`收据，不会无限等待。
- 收据：产品worktree `.pi/audit-evidence/05e-npc-visual-repair-005/receipt.json`，SHA-256 `65c9dc41b52f970480d016d8071310cc6d62fff22491afb2328046646a283381`；独立reviewer复核PASS，Human视觉仍为独立Gate。
- 当前状态：自动与生产验证已完成；Human最终视觉验收仍待进行，不能关闭SYS-NPC或05-E。

## 新一轮Human反馈（2026-08-27；systemic audit）

Human在当前本地production预览中报告：警车可站立/穿透；Stop AI街对面有5个用途不明的NPC；Stop AI缺少“需要人类而不是AI”语义的抗议气泡；coffee街NPC虽不再突然消失/生成，但仍在窄区聚集、间距不足。

- **FACT/INFERRED**：当前静态警车是`PhaserVehicleRuntime`创建的显示Sprite，未进入玩家Arcade碰撞链；公开Bundle未直接证明静态警车应阻挡玩家。因此“能站在车上”是Human实际观察，“警车必须不可穿透”是本轮已接受的重构验收期望。
- **FACT**：Stop AI对街5人属于公开`crowd_up`静态区域（本地`regionIndex=64`），当前按公开`max(5, ...)`规则生成；其原站退化边界的真实布点仍UNKNOWN。它们是环境背景，不承担交互；本轮已接受局部减少为2人。
- **FACT/UNKNOWN**：公开Bundle存在`People, not machines!`、`Jobs for humans!`、`Human > machine`和`speech-bubble`机制；当前venue owner没有口号、气泡定位或清理。公开首次触发路径仍UNKNOWN；本轮已接受公开英文轮换和可见/离屏/shutdown清理的重构实现。
- **FACT/INFERRED**：coffee的`gone+visible`已由`16c74bb`修复，但`drinkers`、两组vertical路线与静态38/61仍叠加；当前静态最小中心距35.35px，小于48px精灵显示尺寸。公开Bundle没有coffee间隙数值；本轮已接受`>=56px`局部中心距的重构DECISION。

Human已接受`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-003`，首次尝试已实现静态警车阻挡碰撞、对街背景2人、公开英文抗议气泡和coffee局部占位规则；但coffee最终截图为空，自动间距形成空集合通过，不能视为视觉完成。Human随后接受`DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004`：coffee局部至少同时保留2个可见route NPC且中心距至少56px，静态38/61继续不生成，采用错峰/分道route；完整SYS-NPC及其他owner仍延期。

## 首次方案视觉结果（2026-08-27）

- **已验证**：警车玩家阻挡、3条公开英文抗议口号、对街背景2人、无console/exception/failed request/bad response；专项/全量自动检查和编译通过。
- **未通过**：coffee截图无可见NPC。首次实现同时禁用了静态38/61并将局部route并发限制为1，导致“满足56px”退化为空场景；这是自动检查与视觉目标冲突，不能保留为完成结论。
- **当前处理**：以上是首次实现失败记录；`DEC-P5.4-SYS-NPC-COFFEE-REPAIR-004`随后已完成非空重实现并通过自动/生产验证，当前只等待Human视觉Gate。

## 当前非空coffee重实现结果（2026-08-27）

- **已落盘**：产品提交`9233b20`；coffee局部只允许`vertical-crowd-reverse`，最多同时2个route NPC，静态region38/61不生成；两条实例从屏外固定起点/延迟进入，并用±40px显示分道。其他route不套用该安全退场语义，公开`goBack:false/deleteAfterComplete:false`保持不变。
- **已验证**：4182 production探针显示同时2个route NPC、组合最小中心距118.36277297772581px、region38/61计数0；三辆警车阻挡玩家，Stop AI背景2人且三条公开口号出现；398项全量测试、typecheck、资源检查、build、普通入口Smoke、test-hooks跨块Smoke和独立reviewer均PASS。
- **证据与状态**：`.pi/audit-evidence/05e-npc-visual-repair-005/receipt.json`，SHA-256 `65c9dc41b52f970480d016d8071310cc6d62fff22491afb2328046646a283381`；上一轮Human视觉验收未签，本次新三包已授权但尚未实现/回归，完整SYS-NPC/B2–B5不恢复。

## 新一轮Human反馈统一审计与授权（2026-08-27）

| 差异 | 已确认事实与当前代码 | 状态 |
|---|---|---|
| 警车上的NPC | 3辆警车已有静态body，但`CampusScene`只接player×police collider；route `isBlocked`只检查火车格，bug只消费静态walls grid。 | 动态警车未进入移动NPC阻塞链已确认；本次接受route/bug移动NPC统一避让。 |
| coffee数量与走墙 | 当前局部白名单只允许`vertical-crowd-reverse`、上限2、静态38/61为0；该配置`ignoreWalls=true`。 | Human已接受至少10个同时可见且中心距≥56px；实现需修正墙格语义。 |
| party room | 公开concert owner有loop crowd和单独lighting机制；当前venue只给protesters动作，dancing owner在另一坐标，未接concert light。 | 灯光/动作缺失已确认；Human已接受公开Bundle最小复刻，下门/侧门roof与左侧栅栏按固定路径实现验证。 |
| bug区域 | 当前Phaser适配以48×48裁切`npc-bug`且无`.63`缩放/公开24帧合同；公开资源合同为38×38、24帧、约`.63`。 | 贴图裁切/缩放错误已确认；Human已接受38×38/24帧/`.63`修复，完整bug AI不扩展。 |

**已接受修复包**（`DEC-P5.4-CROSS-OWNER-VISUAL-REPAIR-005`）：A动态NPC阻塞+coffee数量/墙格，按至少10个同时可见且中心距≥56px；B END OF THE WORLD PARTY双入口roof、公开lighting、concert动作和先固定路径定位后的栅栏碰撞；C bug 38×38/24帧/`.63`贴图合同。当前进入成批实现，完成后仍需完整回归和Human视觉Gate。

## 1. 逆向结论（从 sample 读出来的事实）

- **FACT**：公开前端至少存在以下不同owner：
  1. `CrowdManager`路线与事件人群：11组常规route、`crowd-train`、bug、hazmat；
  2. `particle-trajectories.json`区域owner：`crowd=25`、`crowd_up=21`、`concert=3`、`protesters_rising=1`；
  3. fixed special：reading、eating、cat licking；
  4. sprayer×4、dancing×8、rat attack×40、ghost默认5、birds 5随机+1固定waypoint；
  5. 只有资源而没有完整创建链/入口证据的scientist、monk、dog、DJ、helicopter等UNKNOWN对象。
- **FACT**：资源存在、创建链存在、正常入口可达、当前实现、自动验证和Human视觉通过是六种不同状态，不能互相替代。
- **FACT**：route按路径/事件运行；static与venue按整个region边界激活；sprayer和fixed special有专属触发；ghost、rat、birds不是普通CrowdManager配置。
- **FACT（B0）**：正常入口的火车链为`startGame→crowdTrain→5秒到站→3秒等待→departTrain→spawnTrainPassengers`；乘客目标10，实际实例受成功路径数约束；离站暂停`loop-crowd`，离开阈值或完成后恢复。
- **FACT（B0）**：公开route使用`walls-layer` 0/1 grid、inline Blob Worker和seeded 8向A*；动态火车占格会让NPC等待，但没有发现静态铁路禁站mask。
- **FACT（B0）**：rat的40只/玩家距离触发/8向BFS，ghost的5只/dark+区域+viewport激活/flashlight，birds的5随机+1 waypoint及视口保存重建均有直接创建与类内机制证据。
- **FACT**：公开随机位置、人物选择、朝向和路径顺序不是稳定精确坐标FACT；配置人数也不保证每次成功布点人数。
- **INFERRED**：Human看到的单列、弹出/消失、动作单调等现象，主要与owner生命周期粒度、呈现状态机和自动probe偏斜有关；具体每个视觉症状仍需按owner固定路径重放。
- **UNKNOWN**：rat、ghost和birds正常产品入口仍依赖未关闭的六点相机序列触发；铁路禁站原站数据流、所有owner完整scene teardown、sprayer跨chunk路线和resource-only对象身份未解决。

主证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js`、`sample/original-public-build/mirror/assets/maps/particle-trajectories.json`、`sample/original-public-build/mirror/assets/maps/walls-layer.json`。完整定位与矩阵见[Phase A审计报告](../../task-todos/WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)。

## 2. 数据与约定

- **FACT**：`particle-trajectories.json`共有88个region；无名region只保留ID与polygon/bbox，不补造地点名。
- **FACT**：路线配置分别声明start/end tiles、sprite pool、速度/变化、delay、one-way/loop/goBack/wander、最大活跃数和偏移；不能把所有路线压成单一数组。
- **FACT**：静态/venue布点在polygon内随机采样并有最小间距；region存活期间身份与位置应稳定。
- **DECISION候选**：每个owner合同至少记录`config/resource → activate/count → identity/randomness → path/action → lifecycle → interfaces → cleanup/failure → verification`八项。
- **DECISION候选**：owner状态台账固定分开记录六状态；自动测试只证明测试内容，Human视觉另记。
- **DECISION候选**：失败candidate固定为integration worktree clean HEAD `ea87512`，在新实施包接受前只读保留。

## 3. 怎么做

> Human已接受以下owner分批顺序；B0已完成，完整B1视觉与B2-B5仍未通过/未授权。本次仅按`DEC-P5.4-CROSS-SYSTEM-VISUAL-REPAIR-001`恢复route、Stop AI venue presentation和车辆资源owner。

1. **B0 证据与合同收口（完成）**：train正常入口和route worker已关闭；rat/ghost/birds owner内部机制已关闭；产品入口、铁路策略和完整teardown残余UNKNOWN已登记。
2. **B1 static + venue（自动验证通过，Human部分失败）**：恢复`crowd/crowd_up`的region生命周期、稳定身份、方向池和每秒2–4人公开选择机制，以及concert/protest逐NPC动作；双视口production门禁已PASS，但Stop AI肉眼出现闪现/半身，需统一审计。
3. **B2 route + train + bug/hazmat**：冻结每组配置、候选路径、delay/goBack/wander、火车暂停恢复及呈现策略。
4. **B3 sprayer + fixed special + dancing + rat**：保持专属owner；rat仅在B0证据足够后进入。
5. **B4 ghost + birds**：只在正常入口和生命周期证据成立后实现。
6. **B5 联合关闭**：完整正常路径、慢镜头边界、shutdown、性能和Human整体验收。

每批先固定owner expected、失败/差异证据和允许文件，再做有界实现；Main负责共享入口、权威状态和最终集成。不得按截图中每个NPC建立零散补丁。

## 4. 失败怎么办

- 资源或配置缺失：返回可定位owner/config/key失败，不替换为猜测资源。
- 路径失败：记录owner、config、起终点和失败原因；配置人数与成功路径人数分别记，不伪造NPC补数。
- region失败：已创建presentation必须按owner对称回收；部分写入不能登记成功。
- trigger/入口UNKNOWN：停止对应实现，保留UNKNOWN，不把测试hook或延迟构造接入production。
- shutdown：每个owner清sprite、timer、tween、listener、path/region状态；重复shutdown幂等；最终收据必须覆盖route、bug、venue、dancing等当前缺口。
- Human视觉失败：回到同一RC-NPC差异表和owner根因包，不重开症状式工作项，也不以更多测试数量代签。

## 5. 接口

- 入←Main：world ready、playable/control gate、viewport/worldView、player position/facing、train departure/leave/complete、walls/path grid、scene shutdown。
- 入←资源/地图：公开sprite/animation、`particle-trajectories.json`、`walls-layer.json`、owner配置。
- 出→Main：owner ready/failure、logical/materialized/visible count、trigger/complete/destroy receipt、shutdown receipt和必要的Human probe状态。
- owner不得直接管理chunk cache、相机、玩家输入或其他owner；train事件只通过冻结事件接口连接route crowd。
- `SYS-ENTITY`继续NO-GO：route/path、region、special、encounter、moving-sprite尚未显示稳定共同生命周期合同。

## 6. 怎样算做对

每批至少同时满足：

1. 配置与资源契约测试；
2. owner核心状态/路径/动作测试；
3. Phaser presentation与资源失败测试；
4. 对应正常production区域/事件probe，而非仅test hook或对象计数；
5. 慢相机边界和静止相机身份稳定验证；视口内不得发生alpha归零、destroy、presentation重建、瞬移或分帧冒出；NPC只能连续走入或连续走出后回收；
6. owner shutdown后sprite/timer/tween/listener归零收据；
7. 该批owner级Human视觉通过。

B5还需重放完整入口→地图→NPC区域→火车事件→scene shutdown路径，运行受影响全量回归和性能检查，再由Human整体视觉验收。任何自动PASS都不能单独把完整SYS-NPC晋升为`implemented/verified`。

## 7. 代码位置

- **当前根基线**：根`master`尚无`src/npc/`、`tests/npc/`或NPC production probe。
- **失败candidate（只读对照）**：历史基线`ea87512`及失败对照`883faa2`保留；当前有界产品提交为`.pi/worktrees/visible-product-integration` / `9233b20`；前一轮连续退场基线`16c74bb`继续作为可追溯父提交。
- candidate core：`src/npc/sprayer.ts`、`routeCrowd.ts`、`gridPathProvider.ts`、`staticCrowd.ts`、`staticNpc.ts`、`venueCrowd.ts`、`venueCrowdRuntime.ts`、`bugCrowd.ts`、`dancingCrowd.ts`。
- candidate presentation：`game/PhaserSprayerRuntime.ts`、`PhaserRouteCrowdRuntime.ts`、`PhaserStaticCrowdRuntime.ts`、`PhaserStaticNpcRuntime.ts`、`PhaserVenueCrowdRuntime.ts`、`PhaserBugCrowdRuntime.ts`、`PhaserDancingCrowdRuntime.ts`及`game/CampusScene.ts`。
- candidate tests/probe：`tests/npc/**`、`scripts/browser-route-crowd-production.mjs`、`scripts/browser-npc-visual-production.mjs`；后者带30秒总超时、5秒CDP超时和TIMEOUT诊断收据。
- Phase A过程与差异主表：[SYS-NPC Phase A审计报告](../../task-todos/WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)。
- B0证据结果：[B0证据与合同收口](../../task-todos/WI-SYS-NPC-SPECIAL-001-B0证据收口.md)。
- 下一候选实施包：[B1静态与Venue实施包](../../task-todos/WI-SYS-NPC-SPECIAL-001-B1静态与Venue实施包.md)。

复用观察：多个真实owner已有不同机制，但当前根基线没有两个已集成且Human通过的owner显示稳定共同合同；不提取通用NPC/Entity框架。`GridRouteCrowdPathProvider`仅是candidate中被多个route配置消费的有界能力，是否进入根基线须后续集成Gate。

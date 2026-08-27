---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
type: systemic-batch-implementation
system: SYS-FX + SYS-NPC
issue-class: systemic-failure
status: implementation-authorized
workflow-ref: 03-执行层/修正任务分流协议.md
decision: DEC-P5.4-CROSS-SYSTEM-VISUAL-REPAIR-001
correction-decision: DEC-P5.4-SYS-NPC-VISUAL-REPAIR-002
extension-decision: DEC-P5.4-SYS-NPC-VERTICAL-EXIT-004
follow-up-decision: DEC-P5.4-SYS-NPC-VISUAL-REPAIR-003
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

每个包返回：实际修改路径、根因对照、专项检查、失败/UNKNOWN、未解决风险。Main负责合并共享接线、审查完整diff和最终Human Gate；本包未通过Human视觉前不得关闭05-E或进入S2。

## 8. 当前实施结果（自动与生产验证通过，等待Human最终视觉）

- Fog：产品提交`4ace8b5`；清除时停止新粒子、保留存活粒子可见；Fog专项8项通过。
- route：产品提交`73df384`；屏内保持alpha/identity，active cap释放不在屏内冒出；route专项29项和production probe通过。
- 车辆：产品提交`180865d`、Main接线`5ea711d`；资源白名单、preload、专用owner、直升机主体/双旋翼/high-res、3辆警车已接入；production快照与直升机截图通过。警灯和动态车辆行为保持UNKNOWN。
- venue/static：产品提交`7341cc0`；可见region原子ready、屏内sprite不销毁；专项测试和Stop AI连续性采样通过。
- probe：产品提交`883faa2`；真实Stop AI probe收集289次清雾样本、47次NPC连续性样本，route production probe通过。
- 父回归：`npm test`（69个测试文件/389项测试）、`npm run typecheck`、`npm run check:runtime`和当前产品worktree build通过；无console/exception/failed request/bad response。
- 独立`lightweight-verifier`复核：typecheck、全量389项测试、资源检查和build均PASS；视觉探针因其沙箱不能复用4182而标UNKNOWN。主会话真实4182生产探针已独立取得PASS。
- Human部分验收已通过烟雾、车辆和飞机；Stop AI人物和coffee路线的历史视觉失败仍需Human最终复验。
- 当前结果：`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-002`与`DEC-P5.4-SYS-NPC-VERTICAL-EXIT-004`已实施；产品提交`16c74bb`保存完整原始路径退场、随机起点回归测试及带看门狗的`browser:npc-visual-production`。4182生产探针PASS：Stop AI采样50帧，两个route owner均观察到可见连续退场，静态region 38/61最小间距35.35px，浏览器错误全为0。收据位于产品worktree`.pi/audit-evidence/05e-npc-visual-targeted/receipt.json`，SHA-256 `925c0c99f889361501fa5d95123b47f3b8e205ebcf3b8c508254c34200a9cff9`。
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

本轮已进入实现；完成后必须通过专项测试、全量回归、生产探针和Human视觉验收。

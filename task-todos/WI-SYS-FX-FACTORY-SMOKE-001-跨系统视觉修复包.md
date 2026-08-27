---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
type: systemic-batch-implementation
system: SYS-FX + SYS-NPC
issue-class: systemic-failure
status: systemic-visual-reaudit-required
workflow-ref: 03-执行层/修正任务分流协议.md
decision: DEC-P5.4-CROSS-SYSTEM-VISUAL-REPAIR-001
correction-decision: DEC-P5.4-SYS-NPC-VISUAL-REPAIR-002
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

本轮追加授权：仅对公开`drinkers`组增加终点后的连续安全出口；保持`goBack:false`与`deleteAfterComplete:false`字段，不用alpha/destroy/屏内重建/瞬移掩盖完成态。新build审计发现coffee实际失败owner为`vertical-crowd-reverse`，该owner不在本轮已接受的追加授权内；扩展前必须重新形成方案并过Human Gate。

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

## 8. 当前实施结果（自动验证通过，Human部分验收；NPC修正冻结）

- Fog：产品提交`4ace8b5`；清除时停止新粒子、保留存活粒子可见；Fog专项8项通过。
- route：产品提交`73df384`；屏内保持alpha/identity，active cap释放不在屏内冒出；route专项29项和production probe通过。
- 车辆：产品提交`180865d`、Main接线`5ea711d`；资源白名单、preload、专用owner、直升机主体/双旋翼/high-res、3辆警车已接入；production快照与直升机截图通过。警灯和动态车辆行为保持UNKNOWN。
- venue/static：产品提交`7341cc0`；可见region原子ready、屏内sprite不销毁；专项测试和Stop AI连续性采样通过。
- probe：产品提交`883faa2`；真实Stop AI probe收集289次清雾样本、47次NPC连续性样本，route production probe通过。
- 父回归：`npm run typecheck`、全量69文件/384测试、`npm run check:runtime`、普通build、普通browser smoke、test-hooks chunk smoke通过；无console/exception/failed request/bad response。
- 独立`lightweight-verifier`复核通过：HEAD、工作树、typecheck、全量测试、资源、build、两个production probe和静态边界均PASS；未运行build:test-hooks。
- Human部分验收已通过烟雾、车辆和飞机；Stop AI人物仍闪现且部分只显示半个身子，coffee路线NPC仍齐刷刷站成一坨。
- 当前处理：`DEC-P5.4-SYS-NPC-VISUAL-REPAIR-002`已实施专用64×64帧、`drinkers`屏外连续退场和coffee两个静态region局部去重；新build真实视口审计确认`drinkers`已离场，但`vertical-crowd-reverse`仍在coffee终点`gone+visible`成团。当前按systemic-failure重新审计owner，不对已验收Fog/车辆做回归性修改，也不在新方案Gate前扩展代码。
- 父任务未关闭；不启动S2–S4或完整SYS-NPC B2–B5。

## 9. Human失败差异表（第二次审计，等待Human方案Gate）

| 差异 | Expected source | Actual evidence | 根因簇 | 当前结论 |
|---|---|---|---|---|
| Stop AI人物闪现、部分半身 | Human要求视口内NPC完整、连续、不能错误帧或呈现断裂 | `npc_protester_rising.webp`实际为`512×1024`，即8×16个64×64格；`game/PhaserVenueCrowdRuntime.ts`当前preload按48×48切帧，运行时frame为48×48；Stop AI自动identity采样通过但未测像素/帧 | 专用spritesheet几何错误（高可信）；高层烟雾/地图前景遮挡为次要候选，尚未单独证伪 | 先修专用64×64帧合同并补逐帧/截图证据；不改已验收Fog语义 |
| coffee路线NPC齐刷刷成坨 | Human要求路线人群视觉分散，不能在视口内堆成静止一团 | 新build固定coffee视口`(x≈1160..1640,y≈753..1023)`连续审计：`drinkers`已在视口外；实际画面为9个`vertical-crowd-reverse`实例在约`(1400,904)`终点变成`gone+visible`，另有静态38/61共8个实例 | 先前只修`drinkers`，漏掉同样为`goBack:false/deleteAfterComplete:false`且终点落在coffee视口内的`vertical-crowd-reverse`；这是同一类非往返完成态驻留，但owner和路径需单独复核 | 不直接套用旧方案；建议审计后只为明确coffee owner增加有界连续安全退场，保留该组公开flags，并验证静态去重与路线离场叠加效果；需Human新方案Gate |

### 首次方案执行结果与第二次审计方案（待Human接受）

1. **Stop AI专用帧合同**：`npc_protester_rising`已按64×64 spritesheet加载；新build逐帧收据显示texture frame/cut/display均为64，固定视口连续50帧通过。Human视觉仍需确认没有半身/闪现。
2. **首次coffee方案结果**：`drinkers`已保持公开起点、终点及`goBack:false/deleteAfterComplete:false`，沿`forwardPath`反向连续走到屏外再restart；静态38/61局部最小间距为32px以上。但这只证明`drinkers`根因，不证明coffee视口整体通过。
3. **第二次owner审计Gate**：复核`vertical-crowd-reverse`的公开起点/终点、路径和flags；确认其终点约`(1400,904)`及9个实例为何在视口内`gone+visible`；形成是否同样增加安全退场、是否需要调整局部静态去重的单一方案，经Human确认后才能写代码。

**当前结论**：Stop AI新build帧/边界审计已通过自动证据，`drinkers`退场和静态38/61间距也已通过；coffee总体Human问题仍未解决。不得把首次方案的自动PASS升级为Human视觉PASS，也不得扩展到其他route owner。

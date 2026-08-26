---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
type: systemic-batch-implementation
system: SYS-FX + SYS-NPC
issue-class: systemic-failure
status: implementation-authorized
workflow-ref: 03-执行层/修正任务分流协议.md
decision: DEC-P5.4-CROSS-SYSTEM-VISUAL-REPAIR-001
updated: 2026-08-25
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

### D. Stop AI venue/static presentation

允许修改`game/PhaserVenueCrowdRuntime.ts`、必要的`game/PhaserStaticCrowdRuntime.ts`及对应测试/probe。先保留逐帧owner证据，区分烟雾遮挡、分帧物化和真实sprite create/destroy；再以视口连续性为停止条件修复。不得扩大到未授权NPC owner。

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

## 8. 当前实施结果（automated-verified，Human视觉待验收）

- Fog：产品提交`4ace8b5`；清除时停止新粒子、保留存活粒子可见；Fog专项8项通过。
- route：产品提交`73df384`；屏内保持alpha/identity，active cap释放不在屏内冒出；route专项29项和production probe通过。
- 车辆：产品提交`180865d`、Main接线`5ea711d`；资源白名单、preload、专用owner、直升机主体/双旋翼/high-res、3辆警车已接入；production快照与直升机截图通过。警灯和动态车辆行为保持UNKNOWN。
- venue/static：产品提交`7341cc0`；可见region原子ready、屏内sprite不销毁；专项测试和Stop AI连续性采样通过。
- probe：产品提交`69f6fca`；真实Stop AI probe收集289次清雾样本、47次NPC连续性样本，route production probe通过。
- 父回归：`npm run typecheck`、全量69文件/384测试、`npm run check:runtime`、普通build、普通browser smoke、test-hooks chunk smoke通过；无console/exception/failed request/bad response。
- Human视觉仍未签字；当前唯一待验收内容是整条真实路径的肉眼结果，尤其红烟连续性、烟雾遮挡下NPC观感、车辆构图和路线NPC自然进出。

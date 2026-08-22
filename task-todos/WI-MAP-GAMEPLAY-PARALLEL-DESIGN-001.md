---
work-item: WI-MAP-GAMEPLAY-PARALLEL-DESIGN-001
status: completed
phase: interface-and-integration-design
authorization: DEC-MAP-GAMEPLAY-PARALLEL-DESIGN-001
updated: 2026-08-22
---

# 地图线与玩法线两波并行设计

> 本文件是有界设计工作记录，不是第二套动态状态；当前状态只以根 `task_plan.md` 为准。

## 1. 已接受的并行拓扑

Human 以“ok。开始并行设计方案吧”接受以下拓扑：

```text
准备：Main 冻结接口与文件所有权
  ↓
第一波：地图实现窗口 ║ 玩法窗口只做 SYS-PLAYER
  ↓
Main 第一次整合、全量回归、Human Gate
  ↓
第二波：玩法窗口做 SYS-CAMERA ║ 地图窗口只做接口修复和性能复测
  ↓
Main 最终整合、全量回归、Human 预览
```

- 地图、玩法窗口互不合并、互不修改对方 worktree。
- Main 使用独立 integration 分支整合，不直接让两个实现窗口共同修改主工作树。
- `task_plan.md`、决策记录、系统卡、共享脚本和最终 `CampusScene` 接线只由 Main 修改。
- 当前只授权设计和准备，不授权正式代码。

## 2. 冻结的跨线语义接口

这里只冻结语义，不指定 TypeScript 类名或签名。

| 接口 | 方向 | 冻结语义 | 失败/清理 |
|---|---|---|---|
| 玩家位置快照 | SYS-PLAYER → SYS-CAMERA / SYS-CHUNK | 提供当前世界坐标；相机用于跟随，分块用于玩家 3×3 目标集合；消费者只读 | 玩家销毁后不得继续提供可变引用 |
| 玩法控制门 | Main / SYS-CAMERA → SYS-PLAYER / SYS-INPUT | 禁用时立即停止速度、屏蔽键盘与摇杆并 reset；启用时恢复设备对应输入；航拍期间保持禁用 | shutdown/失焦必须归零并清理输入状态 |
| 相机视口目标更新 | SYS-CAMERA → SYS-CHUNK | 提供相机 scroll、viewport、zoom；分块按“玩家 3×3 ∪ 相机可见 +1”更新目标；航拍和正常阶段共用同一目标规则 | 请求失败进入现有失败状态；相机不直接操作 cache/Tilemap |
| 地图运行时收敛 | Main → SYS-CHUNK / SYS-WORLD | Main 可等待请求和 mutation idle；shutdown 按输入/相机 → coordinator/request → mutation → collider/layer/Tilemap 顺序收敛 | 必须有超时/失败记录；不得有晚到写入 |
| 世界边界 | SYS-WORLD → SYS-CAMERA / SYS-PLAYER | 唯一世界像素边界来自 master/WorldSpec；相机和物理体消费同一边界 | master 未 ready 时不得发布可用边界 |

## 3. 文件所有权

### 地图实现窗口

允许候选范围：

```text
src/asset/
src/chunk/
src/world/
src/layer/
game/PhaserWorldRenderer.ts
game/PhaserWorldMutationScheduler.ts
scripts/prepare-runtime-assets.mjs
scripts/check-runtime-assets.mjs
scripts/sanitize-runtime-maps.mjs
tests/ 对应地图目录
```

`public/` 仍是构建生成物，不提交；地图窗口只能通过上述白名单脚本从只读 `sample/` 生成并校验粒子运行资源。

不得修改：

```text
game/CampusScene.ts
package.json
scripts/browser-*.mjs
task_plan.md
决策记录.md
工作日志.md
03-执行层/
```

### 玩法串行窗口

允许候选范围：

```text
src/player/
src/camera/
新增的有界 Phaser 玩家/相机适配器
tests/player/
tests/camera/
```

不得修改：

```text
game/CampusScene.ts
game/PhaserWorldRenderer.ts
src/asset/
src/chunk/
src/world/
src/layer/
package.json
共享 browser Smoke
权威状态文档
```

### Main / integration

Main 独占：

```text
game/CampusScene.ts
game/main.ts
package.json
共享 browser Smoke
task_plan.md
决策记录.md
工作日志.md
03-执行层/ 与 API 契约
```

## 4. 第一波候选实现包（待 Human 设计审查）

### M1 地图运行时收口

建议纳入：

1. 将原站事实写清：`particles` / `particles2` 是 GID `69355–69359` 的可见 raw Tilemap 路径，不是已证明的纯 marker。
2. 使用公开 `tileset-particles` 资源恢复 raw visual；`69360` 继续 UNKNOWN，不猜含义。
3. 保持当前重构 24 层对称 apply/remove，不复制原站只卸载 11 层的不完整路径。
4. cars、roof、bridge 保持明确 owner；cars 只输出 marker，不在地图包创建车辆。
5. footsteps 保持数据来源，不在地图包创建 footprint Sprite。
6. particles3 保留 marker/未消费诊断，`Q-LAYER-002` 不关闭。
7. 当前完整 exterior atlas + sanitized chunk 合同继续作为重构 DECISION；暂不为“打包形式一致”替换成 16 张 exterior-small。粒子公开资源是本次唯一必要新增 tileset。
8. 补资源失败、apply/remove、shutdown 和有界 baseline 回归；这里只比较目标集合、生命周期和当前观测是否明显退化，不制定最终 FPS/内存阈值。

明确排除：车辆/NPC、trajectory 动态粒子、脚印 Sprite、抗议者、完整原站 Loader 时序、最终硬件性能阈值。

### P1 SYS-PLAYER 运行时

建议纳入：

1. 玩家控制门和移动/idle 状态互斥。
2. 8 秒随机 idle、30 秒 sitting、移动后 stand-up。
3. 公开 eating/scratching/tying-shoe/sitting 资源和动画；缺资源时可降级回普通 idle，不得卡死控制。
4. 保留现有 8 方向移动、Body、碰撞、depth 和摇杆行为。
5. 提供只读位置快照和控制状态给 Main 接线。

明确排除：沙滩触发完整流程、怪物抓人、传送、内容弹窗和相机航拍。它们依赖 SYS-ZONE/SYS-NPC/SYS-CAMERA，不能塞进 P1。

## 5. 第一波 Gate

地图和玩家窗口各自必须返回：

- 实际 diff 与允许文件核对；
- 单元测试和 typecheck；
- 失败/销毁边界；
- 未解决项；
- ready-for-preview 状态和执行报告路径；
- 不自行 commit/merge/push；Human 接受实际 diff 后才按 Main 指令提交。

Main 第一次整合必须通过：

```text
npm run typecheck
npm test -- --run
npm run build
npm run build:test-hooks
npm run browser:smoke
npm run browser:chunk-smoke
npm run browser:layer-smoke
npm run browser:collision-smoke
npm run browser:lifecycle-smoke
npm run browser:mobile-input-smoke
npm run check:perf-baseline-evidence
python3 scripts/check-state-consistency.py
```

之后进入 Human Gate；未通过不得开始 SYS-CAMERA。

## 6. 第二波 SYS-CAMERA 历史候选包（入口解释已被取代）

> 本节记录当时能力实现候选。`DEC-CAMERA-ENTRY-FLOW-FIX-001`和`DEC-THREE-BOARD-VISIBLE-WAVE-001`已明确：六点序列不属于当前正常入口合同，真实触发保持UNKNOWN，正常入口禁止使用111秒序列。

1. 6 点航拍序列与约 111 秒真实时间线。
2. 航拍期间通过玩法控制门锁定玩家和摇杆。
3. 每次 camera tween/update 只调用冻结的视口目标接口，不直接操作 chunk cache 或 Tilemap。
4. 结束后 3 秒 Power2 回到玩家，再恢复硬跟随和控制。
5. 正常阶段 zoom=1、lerp=1、offset=0、deadzone=0、roundPixels=true。
6. nativeScale 作为运行时设备值；HeatHaze/Fire/Morph 不存在时显式降级，不伪造后处理。
7. 序列能力只由显式test-hooks验证；production正常入口不触发，短入场另行调查设计。

地图窗口第二波只允许修复相机预载接口问题并在合并后复测目标集合、生命周期和当前环境 baseline，不新增地图功能；最终硬件 FPS、GPU/纹理内存和长期稳定性阈值仍是独立工作项。

## 7. 分支与整合策略

Human 通过本设计后再创建/更新：

```text
impl/map-runtime-completion
impl/gameplay-serial
integration/map-gameplay-p0
```

1. 三个分支从同一 clean 主线基线开始；已有 gameplay worktree 在开工前 fast-forward 到该基线。
2. 第一波两个窗口先返回实际 diff、检查和风险，停在 Human 预览 Gate；Human 接受后才分别提交。
3. Main 把明确提交带入 integration 分支，处理共享接线并完成第一波 Gate。
4. 第一波通过后，玩法 worktree 更新到 integration clean 基线，再开始 SYS-CAMERA。
5. 最终只把通过验证且经 Human 接受的 integration 结果带回主线；不 push、不自动合并。

## 8. 当前状态

- 已讨论：地图/玩法两波并行拓扑。
- 已接受：一个地图窗口、一个玩法串行窗口、Main integration、共享文件独占和两次 Gate。
- 已落盘：本设计工作记录、API/系统卡/决策/task_plan 同步完成后才成立。
- 尚未授权：M1、P1、SYS-CAMERA 正式代码。
- 尚未创建：地图实现和 integration worktree。

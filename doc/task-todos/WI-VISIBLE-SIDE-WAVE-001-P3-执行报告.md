---
work-item: WI-VISIBLE-SIDE-WAVE-001
phase: P3-parallel-implementation
status: ready-for-integration
base-commit: 035017aee3f5166e952f4a44f2a95970e3d2f4ee
p2-design-commit: c21f7ce8ddeafc071aa77988d69fe2d1b538637e
authorization: DEC-VISIBLE-WAVE-P2-001
---

# WI-VISIBLE-SIDE-WAVE-001 P3 执行报告

## 1. 交付结论

已在 `035017aee3f5166e952f4a44f2a95970e3d2f4ee` clean 基线上完成 05 旁支三项有界实现：

- **NPC：**四个公开 `npc-sprayer` 锚点、完整公开逃跑路线、随机喷洒等待、玩家触发、300 ms 组间级联、路线推进、完成/取消/关闭清理。
- **路线：**`crowdTrain` 的 `(2480,310) → (480,310)` 5 s `Cubic.easeOut` 进场、3 s 停留、9 s `Quad.easeIn` 离场；碰撞带随位置更新，重复、取消和 shutdown 清理。
- **FX：**factory smoke 公开锚点和参数；视口内启动、视口外停发/隐藏、返回复用同一 emitter generation、shutdown 清理 emitter/path/listener。

**状态分层：**纯逻辑、专属 Phaser 适配器、定向测试、全量测试、typecheck 和 production build 已验证；本分支没有修改 Main，因此尚未完成实际入口接线、浏览器首屏视觉 Gate、玩家真实 collider 接线或 CrowdManager 乘客接线。交付状态停在 `ready-for-integration`，不报告为 `Integrated` 或 `Human visual verified`。

## 2. 输入与范围门禁

- HEAD 门禁：进入时 `HEAD=035017aee3f5166e952f4a44f2a95970e3d2f4ee`，工作树 clean；当前分支 `feature/05-side-visible-wave`。
- P2 统一设计和实施包来源：canonical 工作区提交 `c21f7ce8ddeafc071aa77988d69fe2d1b538637e`；P3 实施包中的冻结行为、owner 和允许路径作为本次边界输入。P2 文件不在本 P1 parent 的分支树中，本次只读取 canonical 设计输入，没有复制或修改 P2 文档。
- 当前 canonical `task_plan.md`/`决策记录.md` 已确认 `DEC-VISIBLE-WAVE-P2-001`、`WI-THREE-BOARD-VISIBLE-WAVE-001` 的 P3 active 状态；本分支只执行 05 旁支 owner。
- 未修改 `CampusScene`、`game/main.ts`、`index.html`、`package.json`、地图/分块核心、`sample/`、API 表、系统卡、`task_plan.md`、`决策记录.md` 或通用 Entity。
- 未创建 Entity 基类、Entity registry 或通用旁支框架；三项均有独立 owner 和独立 teardown。

## 3. 资源来源与哈希

资源均由 P1 已核验成功的公开镜像复制，未重新请求、重命名公开证据或猜测 URL。P1 Bundle 的资源 key 与 manifest 成功镜像路径存在 `special` 路径命名差异；本实现以 manifest 的成功文件为来源，并用本地独占 asset 路径导入。

| 资源 key | manifest 成功 URL / 镜像路径 | 本次独占目标 | SHA-256 |
|---|---|---|---|
| `npc-sprayer` | `https://peteroravec.com/assets/sprites/npc-sprayer.webp` / `sample/original-public-build/mirror/assets/sprites/npc-sprayer.webp` | `src/npc/assets/npc-sprayer.webp` | `0567f4b208f0eb667731afd4cad4a0748f61037b447e0d63e283951638296200` |
| `npc-sprayer-running` | `https://peteroravec.com/assets/sprites/npc-sprayer-running.webp` / `sample/original-public-build/mirror/assets/sprites/npc-sprayer-running.webp` | `src/npc/assets/npc-sprayer-running.webp` | `892a8ed1862724d1bee3fab0a55136ccf87b6f6b51fe5e94e8cc1f119b6ec098` |
| `train` | `https://peteroravec.com/assets/sprites/train.webp` / `sample/original-public-build/mirror/assets/sprites/train.webp` | `src/route/assets/train.webp` | `0586ccfe3575bdb73171134b7649c16707eff7222d0ee7297c0af23c364c0ca5` |
| `particle_smoke_white` | `https://peteroravec.com/assets/sprites/smoke-white.webp` / `sample/original-public-build/mirror/assets/sprites/smoke-white.webp` | `src/fx/assets/smoke-white.webp` | `e9415b9d96ce142ac02b1b3afa5182e18df8a2dbe1d2f410810ee10ec2956a27` |

## 4. 实现内容与 owner

### 4.1 `src/npc/` + `game/PhaserSprayerRuntime.ts`

- `src/npc/sprayer.ts` 保存四个公开配置和完整 route point；tile→world 使用 16 px。
- `SprayerGroupRuntime` 使用调用方时间戳，不安装内部 timer；随机等待范围为 `0..3000 ms`，触发窗口为横向 `≤2 tile`、纵向差 `0..2 tile`。
- 触发后按与玩家的横向距离排序，首个立即逃跑，后续每 `300 ms` 开始；路线速度为公开 `140 px/s`；达到终点进入 `gone`。
- `cancel()` 将活动实例置为 `cancelled` 并允许同一 owner 重启；`shutdown()` 进入终态并拒绝再次启动；缺少 idle/running 资源时返回明确失败，不创建实例。
- `PhaserSprayerRuntime` 独占 Sprite map、动画创建、update/shutdown 监听和 Sprite 销毁；适配器不把静态 `activeSprayers` 复制成共享 registry。
- 适配器使用本地批准资源 URL，创建 `npc-sprayer-spray` 与 `npc-sprayer-running-anim`；路线完成、取消、资源创建异常和 shutdown 都会移除监听并销毁 Sprite。

### 4.2 `src/route/` + `game/PhaserTrainRuntime.ts`

- `TrainRouteRuntime` 冻结公开时间与 easing：进场 `5000 ms`、停留 `3000 ms`、离场 `9000 ms`；离场目标为到达位置 `x-4000`。
- 状态为 `idle → arriving → holding → departing → complete`，并提供 `cancelled`/`shutdown` 终态；活动状态重复 `start()` 返回 `already-running`，完成或取消后可复用同一 owner，shutdown 后永久拒绝。
- 碰撞带以火车当前 x、实际 Sprite 宽度和公开 row 20 为源，覆盖 row `18..22`；每次更新都同步矩形中心/尺寸和可选 `setTrainBlockingZone` port。
- `PhaserTrainRuntime` 独占 train Sprite、碰撞矩形、blocking-zone port 和 update/shutdown 监听；进场、随动更新、离场完成、取消和 shutdown 均清理 Sprite/shape/zone/listener。
- 本分支不伪造 CrowdManager passenger group。P2 已明确乘客可作为第二阶段；Main integration 如需真实 passenger 必须由已有 CrowdManager owner 提供接口，不能在本旁支实现包内猜造第二套 crowd owner。

### 4.3 `src/fx/` + `game/PhaserFactorySmokeRuntime.ts`

- `FACTORY_SMOKE_CONFIG` 保留公开锚点约 `(808,539.2)`、`width:7`、`widthEnd:32`、`pathHeight:35`、`quantity:2`、`frequency:80`、`scaleStart:1.6`、`alphaStart:.1`、`maxAlpha:.25`、`scaleEnd:4`、`lifespan:2000`、`depth:500` 及 `reactCars/reactPlayer:false`。
- `FactorySmokeRuntime` 用 generation 标识同一 emitter；视口判断使用公开 `100 px` padding，视口外仅暂停/隐藏，返回视口复用同一 generation，不重建。
- `PhaserFactorySmokeRuntime` 独占 emitter、path graphics 和 update/shutdown 监听；资源缺失/创建异常不静默替代，shutdown 停止并销毁 emitter、path 和 listener。
- 粒子 update 使用专属 owner 的上升曲线位置，不引入通用粒子系统；本实现没有安装额外 timer，listener 是唯一持续更新句柄并在 shutdown 移除。

## 5. 测试覆盖

### 定向旁支测试

- `tests/npc/sprayer.test.ts`：公开四锚点/路线、触发边界、300 ms 级联、路线完成、资源失败、重复 start、cancel、restart、shutdown、Phaser Sprite/监听清理。
- `tests/route/train.test.ts`：5 s/3 s/9 s fake-clock 状态转移、easing 期间位置、row 20 碰撞 cells、随动 shape、blocking zone、重复、资源失败、取消重启、shutdown。
- `tests/fx/factory-smoke.test.ts`：公开参数/锚点、视口内外启停、返回同 generation、粒子曲线、资源失败、emitter/path/listener teardown。

### 可重复命令与结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | PASS |
| `npx vitest run tests/npc/sprayer.test.ts tests/route/train.test.ts tests/fx/factory-smoke.test.ts` | PASS：3 files / 13 tests |
| `npm test` | PASS：45 files / 258 tests |
| `npm run build` | PASS：Vite production build，58 modules transformed |
| `git diff --cached --check` | PASS；文本文件 LF-only，无 CRLF 空白错误 |
| 允许路径审计 | PASS；只包含本报告、`src/npc/**`、`src/route/**`、`src/fx/**`、三个专属 `game/Phaser*` 适配器和对应 tests |

全量测试中已有的 `ChunkCoordinator` 失败诊断 stderr 和 renderer 测试 stdout 均为既有测试预期输出；没有新增未处理异常。build 运行的 `prepare:runtime` 只更新被 `.gitignore` 忽略的派生 `public/`/`dist/`，未进入提交。

## 6. 尚未验证与 integration 交接

- **尚未验证：**本分支没有修改或启动 Main，所以没有声称 Play 后 3 s 相机、5 s 控制门、480×270 构图、首屏 smoke/sprayer/train 的浏览器视觉结果。
- **Main 需要接入：**在不改旁支 owner 的前提下调用各适配器的 `preload/createAnimations/start`；提供玩家只读位置、相机 viewport 和可选 train blocking-zone port；由 Main 决定旁支触发时机。
- **真实碰撞边界：**本分支创建并更新 train 碰撞带，但玩家 collider 的最终接线属于 Main/既有物理 owner，不在旁支中越权修改。
- **资源接入边界：**当前 side adapters 是可被 Vite 导入的本地资源模块；当前 build 因 Main 尚未导入这些适配器而不会把 side 资源纳入最终入口包，这是预期的 `ready-for-integration` 状态，不是已集成证明。
- **正常入口边界：**不得调用原站 `startGame()` 或把六点约 111 s 序列接回 production；旁支只消费 Main 冻结的短入口触发。
- **Human Gate：**尚未进行桌面/移动端浏览器录像和肉眼验收；自动验证不能替代该 Gate。

## 7. 复用与停止条件

- 本轮三个 owner 没有第二个独立真实场景证明共享生命周期抽象；Entity/registry 继续 NO-GO。
- 若 Main 接线要求修改 `CampusScene`、`game/main.ts`、共享入口、API/系统卡或其他 owner 文件，应停止旁支交付并由 Main integration 处理。
- 若正式 runtime 资源路径/加载队列与本报告哈希不一致，应停止并走批准资源流程，不猜 URL。
- 若真实浏览器出现对象、粒子、timer、listener 单调增长，或 train 中断后 blocking zone 残留，不得报告集成完成。

## 8. 交付状态

- **已落盘：**三个纯逻辑 owner、三个 Phaser 专属适配器、四个批准公开资源和对应 tests。
- **已验证：**typecheck、13 项旁支定向测试、45 文件/258 项全量测试、production build、CRLF-aware diff 和允许路径审计。
- **未完成：**Main 接线、浏览器首屏/短路径行为、Human 视觉 Gate、最终 P4 串行集成和远端交付。
- **当前状态：**`ready-for-integration`；不 push、不建 PR、不修改共享入口。

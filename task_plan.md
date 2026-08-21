---
workflow-ref: 03-执行层/README.md
current-work-item: WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001
work-item-level: implementation
work-item-type: parallel-integration
work-item-status: in-progress
node-refs: SYS-ASSET; SYS-WORLD; SYS-LAYER; SYS-CHUNK; SYS-PLAYER
current-phase: worktree-setup
current-gate: implementation
gate-status: active
authorization-ref: DEC-MAP-RUNTIME-COMPLETION-001; DEC-SYS-PLAYER-RUNTIME-001
preauthorized-next-work-item: none
next-phase: parallel-implementation
updated: 2026-08-21
---

# 原站逆向重构计划

## ⏱ 当前状态（一眼看懂）

- **正在做**：`WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001` 的 worktree setup；Human 已接受 M1 地图、P1 玩家和第二波 SYS-CAMERA 范围。
- **第一波 active**：M1 `WI-MAP-RUNTIME-COMPLETION-001` 与 P1 `WI-SYS-PLAYER-RUNTIME-001`；两个窗口先做到 ready-for-preview，不互相 merge，Human 接受实际结果后才各自 commit。
- **第二波 gated**：`WI-SYS-CAMERA-RUNTIME-001` 范围已接受，但必须等 M1+P1 Main integration、全量回归和第一波 Human Gate 后才可启动。
- **文件所有权**：Main 独占 `CampusScene`、共享 browser Smoke、`package.json` 和权威状态；地图与玩法窗口不得共改。
- **明确不做**：不关闭 `Q-LAYER-002/003`，不实现车辆/NPC/trajectory/footprint/内容线，不自动 merge/push。
- **环境状态**：窗口执行包基线为 `638d4c6`（包含 preview Gate 修订）；WSL 沙箱拦截 `git worktree` 命令，地图/integration worktree 尚未创建，gameplay 尚未 fast-forward。
- **下一步**：Human 在 WSL 终端按命令中转创建两个 worktree并把 `impl/gameplay-serial` fast-forward 到 `638d4c6`；回传 `git worktree list` 后才进入 `parallel-implementation`。

## 目标
以已完成的`sample/`公开证据为基础，在`03-执行层/`维护文档先行的16张系统卡、总账和操作手册；先恢复原站系统知识，再由Human逐工作项授权正式`src/`实现。

## 范围
- 建立需求分析、概要设计、详细设计、验证和逆向计划五类文档。
- 建立系统、对象、事件、数据与约定的统一模板和索引。
- 明确 `FACT / INFERRED / DECISION / UNKNOWN`，避免将推断写成事实。
- 世界装配与图层详细设计已由Human接受、验证并关闭；执行层16卡与历史归档迁移已验证关闭，当前恢复5场景视觉证据的Human结论审查。

## 阶段
1. **公开发布文件参考包与运行时采集** — complete
2. **讨论 doc v0.1 基础分类方案** — complete
3. **搭建 doc v0.1 框架** — complete
4. **将执行约束和实践驱动复用规则落盘** — complete
5. **Human 验收文档框架** — complete
6. **按P0顺序逐项逆向与有界实现** — in_progress
   - 6A. **现有复刻代码全局盘点** — complete（Human 已通过）
   - 6B. **原站系统与现有代码差距映射** — complete（Human 已通过）
   - 6C. **选择并详细逆向首个系统** — complete（SYS-CHUNK；Human 已通过详细设计）
   - 6D. **世界装配与图层边界调查设计** — complete（设计已接受、验证并关闭）
   - 6E. **图层最小视觉补证** — complete（5场景证据 Human 已通过，工作项关闭）
7. **总文档入口单仓迁移** — complete（26份文档、入口、指针和验证已进入clean基线）
8. **旧总文档收敛与GitHub推送** — complete（旧目录单README；普通push已确认远端一致）
9. **执行层16卡与doc/v0.1历史归档迁移** — complete（18份当前执行文档、46份历史归档和入口切换已验证）

## 当前 Human 确认

| 确认事项 | Human 状态 | 当前允许 | 当前禁止 | 通过后的下一步 |
|---|---|---|---|---|
| 文档框架验收 | 已通过 | 审查已完成的现有复刻代码基线 | 在 `src/` 写入正式实现、修改或迁移现有 Phaser 项目 | 继续遵守系统详细设计门禁 |
| 阶段1现有代码全局盘点 | 已通过 | 审查阶段6B的P0对照和首个系统建议 | 修改或清理任何旧Worktree、写入正式 `src/` | 继续遵守系统详细设计门禁 |
| 阶段6B系统差距映射 | 已通过 | 开始 SYS-CHUNK 的有界详细逆向与设计 | 写入正式 `src`、修改或迁移现有 Phaser 项目、宣布可复用模块 | 形成 SYS-CHUNK 详细设计与验收包，交 Human 审查 |
| 阶段6C首个系统详细逆向 | 已通过 | 维护已接受的 SYS-CHUNK 详细设计与验证计划 | 写入正式 `src`、修改或迁移现有 Phaser 项目、扩大无关采集、提取通用模块 | 进入 SYS-CHUNK 实现授权审查 |
| 轻量任务接力制度 | 已通过并完成首次真实试点 | 正常关闭已完成工作项；无预授权下一项时进入选择状态 | 把内部小步骤全部升级为 Gate 或完整 P/A；制造虚假选择工作项 | 按既有权威来源滚动提出下一项候选 |
| SYS-CHUNK CORE 实现授权与执行 | 已通过、验证并关闭 | 维护已验证的 CORE 结果和授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、扩大为通用框架 | 下一项需重新选择和授权 |
| 世界装配与图层边界调查及设计 | 已通过、验证并关闭 | 维护已接受正式设计和验证基线 | 正式代码、Phaser/Vite集成、旧项目修改和复用提取 | 当前已进入最小视觉补证 |
| 图层最小视觉补证 | 已授权、证据已验证、Human通过并关闭 | 维护已关闭的5场景证据结论 | 扩大镜像、私有资源、source map、正式代码、旧项目修改 | 已关闭；进入下一工作项选择 |
| 总文档入口单仓迁移 | 已接受、验证并关闭 | 维护已迁入的人话入口和单仓边界 | 修改证据或代码 | 已完成 |
| 旧总文档收敛与GitHub推送 | 已接受、验证并关闭 | 维护单README跳转、两份可恢复原件和远端同步关系 | 删除旧目录本身、force-push、历史/Phase 2搬迁、代码或证据修改 | 已完成 |
| 执行层16卡与历史归档迁移 | 已接受、验证并关闭 | 维护16卡、总账、操作手册、旧doc归档和当前入口 | 修改`sample/src/tests`、旧Phaser、证据结论、内容TBD | 已完成；当前入口只认`03-执行层/` |
| SYS-ASSET CORE 实现授权与执行 | 已验证并关闭（typecheck + 37 测试通过） | 维护 `src/asset/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、扩大为通用框架 | 已完成；转 SYS-LAYER |
| SYS-LAYER CORE 实现授权与执行 | 已验证并关闭（typecheck + 12 项测试通过） | 维护 `src/layer/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Tilemap 写入、扩大为通用框架 | 已完成；转 SYS-WORLD |
| SYS-WORLD CORE 实现授权与执行 | 已验证并关闭（当前 `tests/world/` 32 项；全库149项通过） | 维护 `src/world/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存、渲染、Tilemap 真实写入、碰撞重算、扩大为通用框架 | 已完成；本次运行时安全补偿回滚已验证，完整世界仍需独立范围 |
| SYS-INPUT CORE 实现授权与执行 | 已验证并关闭（typecheck + 23 项测试通过） | 维护 `src/input/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、rexVirtualJoystick 插件集成、真实键鼠/触摸监听、扩大为通用框架 | 已完成；真实运行时接入已由 `WI-SYS-INPUT-TOUCH-001` 有界验证 |
| SYS-MOVE CORE 实现授权与执行 | 已验证并关闭（typecheck + 8 项测试通过） | 维护 `src/move/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Arcade 物理引擎集成、分轴碰撞、真实 body 注册、扩大为通用框架 | 已完成；转 SYS-PLAYER |
| SYS-PLAYER CORE 实现授权与执行 | 已验证并关闭（typecheck + 13 项测试通过） | 维护 `src/player/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Phaser Sprite/动画创建、真实贴图加载、被抓/换装/传送完整流程、扩大为通用框架 | 已完成；转 SYS-CAMERA |
| SYS-CAMERA CORE 实现授权与执行 | 已验证并关闭（typecheck + 10 项本系统测试通过，结果进入 `4f980c5`） | 维护 `src/camera/` 已验证结果与授权边界 | 修改旧 Phaser、扩大为通用框架 | 已完成；后续渲染授权已消费该结果 |
| 联网渲染可玩雏形 | 已接受、已落盘、自动验证和Human视觉验收均通过（结果提交 `7c5a738`） | 保留现有雏形并完成基础浏览器视觉验收 | 在验证入口落地前继续局部补丁、扩展功能或宣称完整原站一致 | 已关闭；后续动态分块另行授权 |
| 当前工作项关闭验证入口 | 已接受（签字 `ok。开始增加吧`，2026-08-17） | 新增只读验证器、fixture 测试和必要命令入口；同步当前状态 | 修改 `src/game/sample`、自动签署 Human Gate、引入新角色/模板或全项目重审 | 工具自测、项目实测和一致性检查通过后关闭 |
| 文档总控修复 | 已接受、已落盘、已验证（结果提交 `c40f6df`） | 恢复 `计划表.md` 一页总控、拆清 CORE/完整系统进度、同步公式与状态口径 | 修改 `src/`、`game/`、`public/`、`sample/`；修复运行时；自动关闭后续工作项 | 已关闭；下一项需Human重新选择并授权资源修复 |
| 资源可复现性调查 | 已接受、已落盘、已验证（结果提交 `f8a9014`） | 盘点入口、地图、tileset和public资源的可复现来源，形成三种方案比较 | 修改 `src/`、`game/`、`public/`、`sample/`；下载新资源；直接修复地图 | 已关闭；方案 A/B/C 需Human选择后再单独授权实现 |
| 资源可复现性实现 | 已接受、已落盘、已验证（结果提交 `6815a6f`） | 从仓库内 sample 公开镜像生成4个运行资源和sanitized地图，接入构建生命周期，增加资源检查 | 修改 `src/`、`game/`、`sample/`；纳入粒子tileset；改动确定性CORE；推送远端 | 已关闭；浏览器验证需下一项单独选择和授权 |
| 浏览器启动与入口验证 | 已接受、已落盘、自动验证和Human视觉验收均通过（结果提交 `7c5a738`） | 把 `game/` 纳入类型检查，真实启动页面并记录 Tilemap/资源/视口结果 | 修改 `src/`、`public/`、`sample/`；纳入粒子完整渲染；自动替Human签署视觉 Gate | 已关闭；编译预览和视觉 Gate 均通过 |
| 多人协作 PR 规则吸收 | 已接受、已落盘、已验证（结果提交 `9bd475b`） | 将 PR #2 核心理念整合进当前 `AGENTS.md` 和执行层手册，保持 `task_plan.md` 唯一动态状态源 | 原样合并PR #2；复制PR Todo；修改 `src/`/`game/`/`sample/`；自动push/merge | 已关闭；后续正式协作按新规则执行 |
| API 协作审查流程融合 | 已接受、已落盘、已验证（结果提交 `6da5755`） | 把 PR #3 的外部规范审查方法融入当前工作流，保持项目 API 契约和系统卡为权威 | 把外部收据当作事实；没有源文档就宣称已验证；直接修改 API 契约或代码 | 流程已关闭；实际外部文档仍需单独输入和审查 |
| 浏览器视觉验收 | 已接受、已落盘、已验证（编译预览与截图由Human确认，2026-08-19） | 确认构建产物的地图、玩家、视口和基础画面可接受 | 自动扩展功能、自动修改缩放、代替Human签署后续视觉结论 | 已关闭；下一项需重新选择和授权 |
| 运行时安全有界修复 | 已接受、已落盘、已验证；结果提交 `632a0c9` | 处理 World 部分写入回滚、production 诊断/hooks 限制、入口 rejected 收敛、test hook 清理和 favicon 入口清理 | 不扩展完整 Phaser teardown、完整图层、粒子、NPC、交互、验证器或远端 Git 操作 | 普通 production build、普通/跨块/安全 Smoke 与 test-hooks 碰撞 Smoke均通过；工作项已关闭 |
| SYS-ZONE 区域触发逆向与设计 | 已接受、已落盘、已验证；结果提交 `05c2274` | 核对公开 marker/区域触发来源、坐标/区域边界、进入/离开和防重复行为；补 `04-内容层/作品集内容.md` 内容索引、SYS-ZONE 七格、接口和未知队列 | 不写 `src/`/`game/` 正式代码；不实现 SYS-INTERACT 弹窗；不猜未证实文案、资源或触发器 | 设计已通过 Human review；工作项关闭，正式实现需另行授权 |
| SYS-LAYER 图层运行时语义收束 | 设计与有界实现均已完成 | 证据、`Q-LAYER-002`/`003`、24 层策略、apply/remove 边界和 World/Chunk 职责已收敛；设计关闭提交 `c82aa4a`，有界实现提交 `10c7d88`；完整节点仍为 `designed` | 不把有界实现误报为完整系统；不擅自关闭 particles3 或特殊13层 UNKNOWN | 当前回到工作项选择；后续完整语义需另行授权 |
| SYS-WORLD + SYS-CHUNK 地图生命周期收口 | 已完成，结果提交 `d61faa1` | 可取消请求、过期回写守卫、异步 mutation 等待、Phaser Tilemap/collider 显式 teardown 和固定场景资源边界指标已验证 | 不把固定场景指标写成完整 FPS/内存结论；不实现 NPC/车辆/粒子/完整24层消费者或原站13层事实 | 当前转入 SYS-INPUT 真实运行时接入 |
| SYS-CHUNK + SYS-WORLD 动态运行时集成 | 已接受、已落盘、自动验证和Human视觉验收均通过；结果提交 `b707553` | 在隔离 worktree 中实现 master/chunk 动态目标、请求缓存/去重、World 原子 apply/remove/回滚、销毁守卫和 Phaser 适配；已修正 tileset firstgid 与空 GID 映射 | 修改 `sample/`、旧 Phaser 项目；纳入粒子/NPC/完整交互；绕过 SYS-LAYER；自动替Human签署视觉 Gate | typecheck、145项测试、build、资源检查、browser Smoke和跨块 Smoke均通过；墙体/桥碰撞由后续独立工作项完成 | 已接受、已落盘、自动验证和Human视觉验收均通过；结果提交 `b707553` | 在隔离 worktree 中实现 master/chunk 动态目标、请求缓存/去重、World 原子 apply/remove/回滚、销毁守卫和 Phaser 适配；已修正 tileset firstgid 与空 GID 映射 | 修改 `sample/`、旧 Phaser 项目；纳入粒子/NPC/完整交互；绕过 SYS-LAYER；自动替Human签署视觉 Gate | typecheck、145项测试、build、资源检查、browser Smoke和跨块 Smoke均通过；墙体/桥碰撞由后续独立工作项完成 |

## 已完成任务：阶段6A——现有复刻代码全局盘点

目标：在不修改现有 Phaser 项目的前提下，确认唯一代码基线、模块边界、当前可运行行为和主要实现风险，为后续按原站系统逐项对照建立依据。

执行步骤：

1. 确认仓库、worktree、分支、提交、dirty 状态和本地执行环境；
2. 读取项目入口、依赖、构建命令和直接相关源码，建立模块级实现全景；
3. 在不改源码的前提下运行可用的静态检查、测试、构建和行为基线；
4. 区分已经验证的行为、仅由代码推断的行为和未知项；
5. 新建 `02-整体怎么运作/旧版本现在做到什么（现有实现盘点）.md` 与 `04-怎么验证与还差什么/旧版本实际表现是什么（行为基线）.md`，更新证据追踪、发现和进度记录；
6. 执行独立复核，确认未修改现有 Phaser 项目、未写入正式 `src/`，然后交给 Human 审查。

完成标准：唯一代码基线可复现；主要模块均有职责、入口、依赖和完成度；可运行行为有命令与结果；旧代码没有被当作原站事实或新工程 `implemented`；无旧源码修改。

## 已完成审查包：阶段6B——原站系统与现有代码差距映射

目标：以功能总目录（节点清单）和原站证据为主线，把每个系统对应到旧代码，明确已经覆盖、明确缺失、实现偏差和阻塞未知项；只确定调查顺序，不写正式源码。

执行步骤：

1. 以P0系统为主，复核原站证据、旧代码入口和当前行为基线；
2. 对每个系统记录“旧代码覆盖 / 明确缺失 / 可能偏差 / 关键未知”；
3. 区分可作为行为参考、实现候选、需要重写和继续调查；
4. 更新证据追踪矩阵、节点优先级和还缺哪些答案（未知问题队列）；
5. 确定首个详细逆向系统及其有界任务，但不创建正式源码；
6. 执行独立复核后交给Human审查。

完成标准：P0系统均有证据、旧代码映射、差距、未知项和建议处理方式；首个系统选择有明确依据；没有把旧代码直接宣布为可复用或正确实现。

## 已完成任务：阶段6C——SYS-CHUNK 地图分块详细逆向

目标：在不修改旧 Phaser 项目和正式 `src/` 的前提下，基于已定位公开证据，形成 `SYS-CHUNK` 的有界详细设计与验收包。

执行步骤：

1. 复核 `master.json`、25 个 chunk、Bundle 调用链和既有 Network 基线的可定位证据；
2. 明确数据契约、坐标/索引换算、目标集合、加载/卸载、缓存、失败、取消和销毁边界；
3. 明确分块与世界装配、图层、资源加载、玩家和相机的职责边界；
4. 将未证实内容保留为 `UNKNOWN` 并登记后续调查；
5. 建立[SYS-CHUNK历史调查记录](migration-history/doc-v0.1/03-具体怎么做/系统/地图分块：从原站查到了什么（SYS-CHUNK 调查记录）.md)，更新证据追踪和验证计划；在Human审查前不登记为唯一详细主定义；
6. 做只读独立复核，确认没有写入正式 `src`、没有修改旧 Phaser、没有提前抽取复用模块；
7. 交 Human 审查工作稿、正式详细设计候选和验收标准。

完成标准：SYS-CHUNK 的原站事实、推断、未知项、边界、生命周期、失败路径和验收方式可定位且可审查；相关节点从 `undesign` 进入 `designed` 只能在 Human 审查该详细设计后发生；本阶段不写正式源码。

## 已完成工作项：WI-SYS-CHUNK-CORE-001

目标：使用已接受的最小 TypeScript 测试环境，实现并验证 SYS-CHUNK 确定性 CORE。

结果：批准路径内的 master 契约、行优先索引、坐标/边界换算、玩家3×3、相机+1和目标集合已实现；类型检查、3文件26项测试、供应链审计、治理检查和独立复核均通过。Phaser、Vite、网络、缓存、重试、Tilemap、浏览器集成和完整生命周期仍未授权。

## 已完成工作项：WI-SYS-LAYER-VISUAL-EVIDENCE-001

目标：只检查玩家遮挡、roof、bridge、particles3和footsteps共5个原站公开运行场景，为图层结论提供最小截图和运行状态。

结果：5 场景证据全部 VERIFIED（layer8 遮挡、factory roof 淡隐恢复、bridge1 进出、footsteps 0→5），particles3 为 VERIFIED_WITH_RESIDUAL_UNKNOWN 并转 `Q-LAYER-002`；证据在 `sample/analysis/layer-visual-evidence/`。Human 证据结论审查 `通过`（2026-08-15），工作项关闭。历史任务卡归档于 [migration-history/doc-v0.1/03-具体怎么做/系统/图层与遮挡：最小视觉补证任务卡（SYS-LAYER）.md](migration-history/doc-v0.1/03-具体怎么做/系统/图层与遮挡：最小视觉补证任务卡（SYS-LAYER）.md)。

## 当前工作项

`WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001` 已由 Human 以“接受接受”激活。两个 active 子包是 [M1 地图运行时收口](task-todos/WI-MAP-RUNTIME-COMPLETION-001.md) 和 [P1 SYS-PLAYER 运行时](task-todos/WI-SYS-PLAYER-RUNTIME-001.md)；[SYS-CAMERA 第二波包](task-todos/WI-SYS-CAMERA-RUNTIME-001.md) 已接受但 gated。当前只做 worktree/统一基线准备，准备状态提交完成前执行窗口不得写码。

### 第一波执行边界

| 窗口 | 分支 | active 范围 | 交接 |
|---|---|---|---|
| 地图 | `impl/map-runtime-completion` | particles raw visual、粒子运行资源、24层安全生命周期与有界回归 | 先回传 diff/检查/风险并停在预览 Gate；Human 接受后才 commit |
| 玩法 | `impl/gameplay-serial` | 控制门、8s idle、30s sitting、stand-up、资源降级 | 先回传 diff/检查/风险并停在预览 Gate；Human 接受后才 commit |
| Main | `integration/map-gameplay-p0` | 接收两个明确提交、修改 `CampusScene`/共享脚本并做全量验证 | Human 预览前不带回主线 |

冻结接口仍以 `02-接口层/API契约表.md` 为唯一索引；SYS-CAMERA 当前禁止开工。

## 已阻塞或暂停工作项

- `WI-VERIFY-CURRENT-WORK-ITEM-001`：已接受但验证器文件尚未落地；不能误报为已实现或已验证。
- `WI-RENDER-PLAYABLE-001`：已通过 typecheck、133 项测试、build、编译产物 preview、browser Smoke 和Human视觉验收；结果提交 `7c5a738`。不代表完整原站功能或16个正式系统已完成。
- 当前没有 active 技术阻塞；SYS-ZONE 设计已关闭。完整24层动态消费者、SYS-INTERACT、NPC/交互、完整玩法线和最终硬件 FPS/GPU/纹理内存阈值均需后续独立工作项。
- `WI-RESOURCE-REPRO-001`：调查已完成，结果提交 `f8a9014`。
- `WI-RESOURCE-IMPLEMENT-001`：方案 A 已完成，结果提交 `6815a6f`。
- `WI-BROWSER-STARTUP-001`：自动启动验证已通过并关闭，结果提交 `7c5a738`；视觉 Gate 不自动签署，转由 `WI-RENDER-PLAYABLE-001` 等待Human。
- `WI-DOC-COLLABORATION-ADOPT-001`：PR #2 核心规则已吸收，结果提交 `9bd475b`。
- `WI-API-COLLABORATION-REVIEW-001`：PR #3 审查理念已融合，结果提交 `6da5755`；不改变当前 API 事实。
- 当前没有技术阻塞；`Q-LAYER-002/003` 继续保持 UNKNOWN。请求取消和当前重构 teardown 已有界验证；最终硬件性能阈值、完整动态消费者和完整玩法线不并入本设计项。

## 近期候选

| 候选 | 来源 | 当前处置 |
|---|---|---|
| `WI-SYS-ZONE-DESIGN-001` | 已完成，结果提交 `05c2274` | SYS-ZONE 公开证据逆向与设计已完成；正式代码和 SYS-INTERACT 仍未授权 |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-001` | 已完成，结果提交 `c82aa4a` | SYS-LAYER 证据与有界运行时设计已接受、落盘并验证；不代表代码或完整系统完成 |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` | 已完成，结果提交 `10c7d88` | 有界 visual/roof/marker/footsteps 运行时语义、失败诊断、particles3 未消费保留和 sanitizer 边界已验证；完整地图生命周期仍不在范围 |
| `WI-SYS-MAP-LIFECYCLE-CLOSURE-001` | 已完成，结果提交 `d61faa1` | SYS-WORLD/SYS-CHUNK 请求取消、过期结果、异步 mutation、Tilemap/collider teardown 和固定场景边界指标已验证；不代表完整地图系统完成 |
| `WI-SYS-INPUT-TOUCH-001` | 已完成，结果提交 `66a20f8` | 接入移动端原生 Phaser pointer 摇杆；桌面隐藏、单指、键盘优先级切换、释放恢复和移动端 Smoke 已验证；不代表完整 SYS-INPUT 节点完成 |
| `WI-PARALLEL-MAP-RECON-001` | 已完成，结果基线 `85af370` | A-D 报告和 D 可复核收据已提交；`Q-LAYER-002/003` 保留；转入两波并行设计 |
| `WI-MAP-GAMEPLAY-PARALLEL-DESIGN-001` | 已完成，结果提交 `a16ae54` | 接口、所有权、两波 Gate 和三个实施包已获 Human 接受 |
| `WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001` | Human 已授权，当前 worktree-setup | M1 地图与 P1 玩家并行；SYS-CAMERA accepted-gated |
| `WI-RUNTIME-SAFETY-001` | 已完成，结果提交 `632a0c9` | World 同步/异步部分写入回滚、production 诊断/hooks 限制、入口 rejected 收敛、test hook 清理和 favicon 入口均已验证；完整资源 teardown、完整图层、粒子/NPC/交互和验证器仍不在范围 |
| `WI-VERIFY-CURRENT-WORK-ITEM-001` | 已接受但只读验证器文件尚未落地 | 作为后续协作交付门禁候选；不与运行时安全工作项混写 |
| `WI-API-COLLABORATION-REVIEW-001` | PR #3 审查理念已融合，结果提交 `6da5755`；实际外部文档未进入项目事实源 | 若未来取得源文档，按已落盘流程单独审查；当前不合并PR #3、不宣称外部规范已验证 |
| SYS-MOVE + SYS-LAYER + SYS-WORLD 碰撞集成 | `WI-SYS-MOVE-WORLD-COLLISION-001` 已关闭 | 已实现并验证；结果提交 `e3f412a`，当前转入运行时安全收尾；完整系统语义仍不自动扩展 |

## 已关闭工作项索引

不追溯为历史阶段补建 WI。只为实际建立过的正式工作项保留轻量关闭记录。

> `WI-SYS-LAYER-RUNTIME-SEMANTICS-001` 与 `WI-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` 均已关闭；本表登记设计和有界实现结果，完整 SYS-LAYER 节点仍按系统卡保持 `designed`。

| 工作项 ID | 结果 | 涉及节点 | 产物 | result-commit | Human 决定 |
|---|---|---|---|---|---|
| `WI-MAP-GAMEPLAY-PARALLEL-DESIGN-001` | completed | SYS-ASSET; SYS-WORLD; SYS-LAYER; SYS-CHUNK; SYS-PLAYER; SYS-CAMERA | 两波拓扑、冻结接口、文件所有权、M1/P1/Camera 候选包和 Gate | `a16ae54` | `DEC-MAP-GAMEPLAY-PARALLEL-DESIGN-001` |
| `WI-PARALLEL-MAP-RECON-001` | completed | SYS-ASSET; SYS-WORLD; SYS-LAYER; SYS-CHUNK | A-D 四份 `task-todos/` 报告；D 可复跑探针、27 样本原始收据和确定性校验 | `85af370` | `DEC-PARALLEL-WORKTREE-001` |
| `WI-SYS-CHUNK-WORLD-INTEGRATION-001` | completed | SYS-CHUNK; SYS-WORLD; SYS-ASSET; SYS-LAYER | master/chunk 运行时、World事务、Phaser动态装卸、GID兼容修复、验证器页面清理和视觉验收 | `b707553` | `DEC-SYS-CHUNK-WORLD-INTEGRATION-001` |
| `WI-SYS-MOVE-WORLD-COLLISION-001` | completed | SYS-MOVE; SYS-LAYER; SYS-WORLD; SYS-CHUNK | 玩家 Arcade Body、walls/bridge 碰撞、桥状态切换、`body.blocked` 反馈、collider 安全清理、碰撞/桥/跨块 Smoke | `e3f412a` | `DEC-SYS-MOVE-WORLD-COLLISION-001` |
| `WI-RUNTIME-SAFETY-001` | completed | SYS-WORLD; SYS-CHUNK; SYS-APP | World 当前层同步/异步回滚补偿、production diagnostics/hooks 限制、入口 rejected 收敛、favicon 清理、普通安全/普通/跨块/test-hooks 碰撞 Smoke | `632a0c9` | `DEC-RUNTIME-SAFETY-001` |
| `WI-SYS-ZONE-DESIGN-001` | completed | SYS-ZONE | 11 个 marker 公开来源、严格 `<30px`/100ms 区域规则、visited/手动关闭语义、`menuId` 内容桥接、内容索引、SYS-ZONE 设计和冻结接口 | `05c2274` | `DEC-SYS-ZONE-DESIGN-001` |
| `WI-RENDER-PLAYABLE-001` | completed | SYS-APP; SYS-GAME-UI | `game/` 可玩雏形；编译 preview；browser Smoke；Human视觉验收 | `7c5a738` | `DEC-RENDER-PLAYABLE-001` |
| `WI-API-COLLABORATION-REVIEW-001` | completed | not-applicable | `AGENTS.md`；`03-执行层/README.md`；API协作审查边界和状态分层 | `6da5755` | `DEC-API-COLLABORATION-001` |
| `WI-DOC-COLLABORATION-ADOPT-001` | completed | not-applicable | `AGENTS.md`；`03-执行层/README.md`；协作决策和状态同步 | `9bd475b` | `DEC-GIT-PR-WORKFLOW-001` |
| `WI-BROWSER-STARTUP-001` | completed | SYS-APP; SYS-GAME-UI | `game/phaser.d.ts`；`scripts/browser-smoke.mjs`；真实页面资源与Tilemap Smoke | `7c5a738` | `DEC-BROWSER-STARTUP-001` |
| `WI-RESOURCE-IMPLEMENT-001` | completed | SYS-ASSET; SYS-APP | `scripts/prepare-runtime-assets.mjs`；`scripts/check-runtime-assets.mjs`；`package.json`；干净检出验证 | `6815a6f` | `DEC-RESOURCE-IMPLEMENT-001` |
| `WI-RESOURCE-REPRO-001` | completed | not-applicable | 资源必需文件清单、外部 tileset 对比、方案 A/B/C 调查记录（工作日志） | `f8a9014` | `DEC-RESOURCE-REPRO-001` |
| `WI-DOC-CONTROL-REPAIR-001` | completed | not-applicable | [项目总控台](计划表.md)；[进度总览](01-理解层/00-进度总览.md)；接口、系统卡、总账和状态口径同步 | `c40f6df` | `DEC-DOC-CONTROL-REPAIR-001` |
| `WI-SYS-CHUNK-CORE-001` | completed | SYS-CHUNK | [当前SYS-CHUNK卡](03-执行层/01-地图线/04-地图分块.md)；`src/chunk/`；`tests/chunk/`；历史授权包在`migration-history/doc-v0.1/` | `f04568f953821e8cc56c33a694171ddab759051f` | `DEC-SYS-CHUNK-CORE-001`；`DEC-WORK-RELAY-002` |
| `WI-SYS-WORLD-LAYER-DESIGN-001` | completed | SYS-WORLD; SYS-LAYER | [SYS-WORLD卡](03-执行层/01-地图线/02-世界与地图.md)；[SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；历史调查/验证在`migration-history/doc-v0.1/` | `8c7fff7525e8dd77c6367b662f65fec12175d33f` | `DEC-SYS-WORLD-LAYER-DESIGN-001` |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-001` | completed | SYS-LAYER | SYS-LAYER 运行时证据、Q-LAYER-002 保留、24 层策略和有界 apply/remove 设计 | `c82aa4a` | `DEC-SYS-LAYER-RUNTIME-SEMANTICS-DESIGN-001` |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` | completed | SYS-LAYER; SYS-WORLD; SYS-CHUNK | visual/roof/marker/footsteps 有界运行时、marker 回滚诊断、particles3 未消费保留、sanitizer 边界和浏览器 Smoke | `10c7d88` | `DEC-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` |
| `WI-SYS-MAP-LIFECYCLE-CLOSURE-001` | completed | SYS-WORLD; SYS-CHUNK | AbortSignal 请求取消、过期 mutation 补偿、coordinator/scheduler 异步销毁、collider/Tilemap teardown、生命周期 Smoke 与固定数量上界 | `d61faa1` | `DEC-SYS-MAP-LIFECYCLE-CLOSURE-001` |
| `WI-SYS-INPUT-TOUCH-001` | completed | SYS-INPUT; SYS-MOVE | 原生 Phaser pointer 摇杆、桌面隐藏、移动端显示、单指 ownership、forceMin 死区、键盘优先级/释放恢复、适配器测试和移动输入 Smoke | `66a20f8` | `DEC-SYS-INPUT-TOUCH-001` |
| `WI-DOC-PORTAL-MIGRATION-001` | completed | not-applicable | 五层人话文档与三份人话入口；[根README](README.md)；历史任务卡在`migration-history/doc-v0.1/` | `cda98173a24df1b605019d3b7126ea092dd4b6cf` | `DEC-DOC-PORTAL-MIGRATION-001` |
| `WI-DOC-PORTAL-CLEANUP-001` | completed | not-applicable | 旧目录跳转README；`migration-history/`原件；历史任务卡在`migration-history/doc-v0.1/` | `b2319041fc85974694d29fc607d60678bc139d33` | `DEC-DOC-PORTAL-CLEANUP-001` |
| `WI-DOC-EXEC-LAYER-MIGRATION-001` | completed | not-applicable | [当前执行层](03-执行层/README.md)；[16系统总账](03-执行层/00-总账.md)；[历史治理记录](migration-history/执行层迁移任务卡（治理记录）.md) | `293cbeb2d9bcf99f28c2a7cb62de10ee0e08f0c5` | `DEC-DOC-EXEC-LAYER-MIGRATION-001` |
| `WI-SYS-LAYER-VISUAL-EVIDENCE-001` | completed | SYS-LAYER | [SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；证据在`sample/analysis/layer-visual-evidence/`；任务卡在`migration-history/doc-v0.1/` | `f1652629d436ce7f8a7821c760036fdf071ef397` | `DEC-SYS-LAYER-VISUAL-EVIDENCE-001` |
| `WI-SYS-ASSET-DESIGN-001` | completed | SYS-ASSET | [SYS-ASSET卡](03-执行层/01-地图线/01-资源加载.md) | `a29211b737c6990e4b1c893c6c82b99e61752c8a` | `DEC-SYS-ASSET-DESIGN-001` |
| `WI-SYS-INPUT-DESIGN-001` | completed | SYS-INPUT | [SYS-INPUT卡](03-执行层/02-玩法线/01-输入.md) | `62e26e4caeeeeb46e63c5dce48a8877e625319d0` | `DEC-SYS-INPUT-DESIGN-001` |
| `WI-SYS-MOVE-DESIGN-001` | completed | SYS-MOVE | [SYS-MOVE卡](03-执行层/02-玩法线/02-移动与碰撞.md) | `edbb2952186bf7a3e9f755ba2c21ac3904a50e06` | `DEC-SYS-MOVE-DESIGN-001` |
| `WI-SYS-PLAYER-DESIGN-001` | completed | SYS-PLAYER | [SYS-PLAYER卡](03-执行层/02-玩法线/03-玩家.md) | `0e89e96b688ee56e1cd2f4f6e3a8841f673c6e8f` | `DEC-SYS-PLAYER-DESIGN-001` |
| `WI-SYS-CAMERA-DESIGN-001` | completed | SYS-CAMERA | [SYS-CAMERA卡](03-执行层/02-玩法线/04-相机.md) | `9f838db4786a999c106a879719b59123de661a74` | `DEC-SYS-CAMERA-DESIGN-001` |
| `WI-SYS-ASSET-CORE-001` | completed | SYS-ASSET | [SYS-ASSET卡](03-执行层/01-地图线/01-资源加载.md)；`src/asset/`；`tests/asset/` | `4f980c5` | `DEC-SYS-ASSET-CORE-001` |
| `WI-SYS-LAYER-CORE-001` | completed | SYS-LAYER | [SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；`src/layer/`；`tests/layer/` | `4f980c5` | `DEC-SYS-LAYER-CORE-001` |
| `WI-SYS-WORLD-CORE-001` | completed | SYS-WORLD | [SYS-WORLD卡](03-执行层/01-地图线/02-世界与地图.md)；`src/world/`；`tests/world/` | `4f980c5` | `DEC-SYS-WORLD-CORE-001` |
| `WI-SYS-INPUT-CORE-001` | completed | SYS-INPUT | [SYS-INPUT卡](03-执行层/02-玩法线/01-输入.md)；`src/input/`；`tests/input/` | `4f980c5` | `DEC-SYS-INPUT-CORE-001` |
| `WI-SYS-MOVE-CORE-001` | completed | SYS-MOVE | [SYS-MOVE卡](03-执行层/02-玩法线/02-移动与碰撞.md)；`src/move/`；`tests/move/` | `4f980c5` | `DEC-SYS-MOVE-CORE-001` |
| `WI-SYS-PLAYER-CORE-001` | completed | SYS-PLAYER | [SYS-PLAYER卡](03-执行层/02-玩法线/03-玩家.md)；`src/player/`；`tests/player/` | `4f980c5` | `DEC-SYS-PLAYER-CORE-001` |
| `WI-SYS-CAMERA-CORE-001` | completed | SYS-CAMERA | [SYS-CAMERA卡](03-执行层/02-玩法线/04-相机.md)；`src/camera/`；`tests/camera/` | `4f980c5` | `DEC-SYS-CAMERA-CORE-001` |

## 错误记录

> 已迁入[`工作日志.md`](工作日志.md)，本文件只保留动态状态，不重复过程日志。

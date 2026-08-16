---
workflow-ref: 03-执行层/README.md
current-work-item: WI-SYS-CAMERA-CORE-001
work-item-level: implementation
work-item-type: core
work-item-status: in-progress
node-refs: SYS-CAMERA
current-phase: implementation
current-gate: none
gate-status: none
authorization-ref: DEC-SYS-CAMERA-CORE-001
preauthorized-next-work-item: none
next-phase: implementation
updated: 2026-08-16
---

# 原站逆向重构计划

## ⏱ 当前状态（一眼看懂）

- **正在做**：`WI-SYS-CAMERA-CORE-001`（SYS-CAMERA 确定性纯逻辑 CORE，已授权 `DEC-SYS-CAMERA-CORE-001`）
- **到哪了**：地图线 4 系统（CHUNK/ASSET/LAYER/WORLD）+ SYS-INPUT/SYS-MOVE/SYS-PLAYER CORE 已验证关闭；SYS-CAMERA 已定稿 `designed`，实现授权已签字，`src/camera/` 纯逻辑已写完
- **卡在哪**：不卡；实现 + 测试已完成，待 Human 验收
- **能不能写代码**：✅ 能（仅 SYS-CAMERA 确定性 CORE：边界/缩放/硬跟随/像素取整/物理帧率、航拍 6 点序列、nativeScale 换算）
- **下一步**：Human 验收 `src/camera/` + `tests/camera/`（typecheck + 132 测试全绿）

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
| SYS-WORLD CORE 实现授权与执行 | 已验证并关闭（typecheck + 29 项测试通过） | 维护 `src/world/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Tilemap 真实写入、碰撞重算、扩大为通用框架 | 已完成；地图线纯逻辑全线跑通，转 SYS-INPUT |
| SYS-INPUT CORE 实现授权与执行 | 已验证并关闭（typecheck + 23 项测试通过） | 维护 `src/input/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、rexVirtualJoystick 插件集成、真实键鼠/触摸监听、扩大为通用框架 | 已完成；转 SYS-MOVE |
| SYS-MOVE CORE 实现授权与执行 | 已验证并关闭（typecheck + 8 项测试通过） | 维护 `src/move/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Arcade 物理引擎集成、分轴碰撞、真实 body 注册、扩大为通用框架 | 已完成；转 SYS-PLAYER |
| SYS-PLAYER CORE 实现授权与执行 | 已验证并关闭（typecheck + 13 项测试通过） | 维护 `src/player/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Phaser Sprite/动画创建、真实贴图加载、被抓/换装/传送完整流程、扩大为通用框架 | 已完成；转 SYS-CAMERA |
| SYS-CAMERA CORE 实现授权与执行 | 已授权（签字 `继续`，2026-08-16） | 维护 SYS-CAMERA CORE 授权边界，实现 `src/camera/` 纯逻辑与测试 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、真实相机/tween/后处理管线创建、航拍逐帧推进机制、nativeScale 注入来源、扩大为通用框架 | 验证通过后关闭，玩法线 CORE 全齐 |

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

`WI-SYS-CAMERA-CORE-001`（SYS-CAMERA 确定性纯逻辑 CORE）：边界 2240×2240/缩放 1/硬跟随 lerp=1/offset·deadzone(0,0)/roundPixels/物理 30 FPS、开场航拍 6 点序列与总时长约 111s、结束 tween 3s Power2、nativeScale 换算（blur=16×scale、scaleFactor=1/scale、分块=ceil(10×scale)）。授权 `DEC-SYS-CAMERA-CORE-001`（签字 `继续`，2026-08-16）。nativeScale 为运行时注入非写死参数。范围见 SYS-CAMERA 卡 §2/§3；不含 Phaser/Vite、网络、缓存、渲染、真实相机/tween/后处理管线创建、航拍逐帧推进机制、nativeScale 注入来源、旧项目修改。

## 已阻塞或暂停工作项

暂无。

## 近期候选

| 候选 | 来源 | 当前处置 |
|---|---|---|
| SYS-CHUNK Phaser 世界集成 | SYS-CHUNK 正式设计中尚未实现的请求、缓存、渲染和生命周期范围 | 只保留候选；需结合世界、图层和资源边界重新排序并独立授权 |

## 已关闭工作项索引

不追溯为历史阶段补建 WI。只为实际建立过的正式工作项保留轻量关闭记录。

| 工作项 ID | 结果 | 涉及节点 | 产物 | result-commit | Human 决定 |
|---|---|---|---|---|---|
| `WI-SYS-CHUNK-CORE-001` | completed | SYS-CHUNK | [当前SYS-CHUNK卡](03-执行层/01-地图线/04-地图分块.md)；`src/chunk/`；`tests/chunk/`；历史授权包在`migration-history/doc-v0.1/` | `f04568f953821e8cc56c33a694171ddab759051f` | `DEC-SYS-CHUNK-CORE-001`；`DEC-WORK-RELAY-002` |
| `WI-SYS-WORLD-LAYER-DESIGN-001` | completed | SYS-WORLD; SYS-LAYER | [SYS-WORLD卡](03-执行层/01-地图线/02-世界与地图.md)；[SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；历史调查/验证在`migration-history/doc-v0.1/` | `8c7fff7525e8dd77c6367b662f65fec12175d33f` | `DEC-SYS-WORLD-LAYER-DESIGN-001` |
| `WI-DOC-PORTAL-MIGRATION-001` | completed | not-applicable | 五层人话文档与三份人话入口；[根README](README.md)；历史任务卡在`migration-history/doc-v0.1/` | `cda98173a24df1b605019d3b7126ea092dd4b6cf` | `DEC-DOC-PORTAL-MIGRATION-001` |
| `WI-DOC-PORTAL-CLEANUP-001` | completed | not-applicable | 旧目录跳转README；`migration-history/`原件；历史任务卡在`migration-history/doc-v0.1/` | `b2319041fc85974694d29fc607d60678bc139d33` | `DEC-DOC-PORTAL-CLEANUP-001` |
| `WI-DOC-EXEC-LAYER-MIGRATION-001` | completed | not-applicable | [当前执行层](03-执行层/README.md)；[16系统总账](03-执行层/00-总账.md)；[历史治理记录](migration-history/执行层迁移任务卡（治理记录）.md) | `293cbeb2d9bcf99f28c2a7cb62de10ee0e08f0c5` | `DEC-DOC-EXEC-LAYER-MIGRATION-001` |
| `WI-SYS-LAYER-VISUAL-EVIDENCE-001` | completed | SYS-LAYER | [SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；证据在`sample/analysis/layer-visual-evidence/`；任务卡在`migration-history/doc-v0.1/` | `f1652629d436ce7f8a7821c760036fdf071ef397` | `DEC-SYS-LAYER-VISUAL-EVIDENCE-001` |
| `WI-SYS-ASSET-DESIGN-001` | completed | SYS-ASSET | [SYS-ASSET卡](03-执行层/01-地图线/01-资源加载.md) | `a29211b737c6990e4b1c893c6c82b99e61752c8a` | `DEC-SYS-ASSET-DESIGN-001` |
| `WI-SYS-INPUT-DESIGN-001` | completed | SYS-INPUT | [SYS-INPUT卡](03-执行层/02-玩法线/01-输入.md) | `62e26e4caeeeeb46e63c5dce48a8877e625319d0` | `DEC-SYS-INPUT-DESIGN-001` |
| `WI-SYS-MOVE-DESIGN-001` | completed | SYS-MOVE | [SYS-MOVE卡](03-执行层/02-玩法线/02-移动与碰撞.md) | `edbb2952186bf7a3e9f755ba2c21ac3904a50e06` | `DEC-SYS-MOVE-DESIGN-001` |
| `WI-SYS-PLAYER-DESIGN-001` | completed | SYS-PLAYER | [SYS-PLAYER卡](03-执行层/02-玩法线/03-玩家.md) | `0e89e96b688ee56e1cd2f4f6e3a8841f673c6e8f` | `DEC-SYS-PLAYER-DESIGN-001` |
| `WI-SYS-CAMERA-DESIGN-001` | completed | SYS-CAMERA | [SYS-CAMERA卡](03-执行层/02-玩法线/04-相机.md) | `9f838db4786a999c106a879719b59123de661a74` | `DEC-SYS-CAMERA-DESIGN-001` |
| `WI-SYS-ASSET-CORE-001` | completed | SYS-ASSET | [SYS-ASSET卡](03-执行层/01-地图线/01-资源加载.md)；`src/asset/`；`tests/asset/` | （未提交） | `DEC-SYS-ASSET-CORE-001` |
| `WI-SYS-LAYER-CORE-001` | completed | SYS-LAYER | [SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；`src/layer/`；`tests/layer/` | （未提交） | `DEC-SYS-LAYER-CORE-001` |
| `WI-SYS-WORLD-CORE-001` | completed | SYS-WORLD | [SYS-WORLD卡](03-执行层/01-地图线/02-世界与地图.md)；`src/world/`；`tests/world/` | （未提交） | `DEC-SYS-WORLD-CORE-001` |
| `WI-SYS-INPUT-CORE-001` | completed | SYS-INPUT | [SYS-INPUT卡](03-执行层/02-玩法线/01-输入.md)；`src/input/`；`tests/input/` | （未提交） | `DEC-SYS-INPUT-CORE-001` |
| `WI-SYS-MOVE-CORE-001` | completed | SYS-MOVE | [SYS-MOVE卡](03-执行层/02-玩法线/02-移动与碰撞.md)；`src/move/`；`tests/move/` | （未提交） | `DEC-SYS-MOVE-CORE-001` |
| `WI-SYS-PLAYER-CORE-001` | completed | SYS-PLAYER | [SYS-PLAYER卡](03-执行层/02-玩法线/03-玩家.md)；`src/player/`；`tests/player/` | （未提交） | `DEC-SYS-PLAYER-CORE-001` |

## 错误记录

> 已迁入[`工作日志.md`](工作日志.md)，本文件只保留动态状态，不重复过程日志。

---
workflow-ref: doc/v0.1/每轮工作怎么推进（流程速查）.md
current-work-item: WI-DOC-PORTAL-CLEANUP-001
work-item-level: level-1
work-item-type: governance
work-item-status: active
node-refs: not-applicable
scope-ref: doc/v0.1/03-具体怎么做/旧总文档清理：怎样保留跳转并推送（治理任务卡）.md
exit-criteria-ref: doc/v0.1/03-具体怎么做/旧总文档清理：怎样保留跳转并推送（治理任务卡）.md
current-phase: verification
current-gate: none
gate-status: not-applicable
authorization-ref: DEC-DOC-PORTAL-CLEANUP-001
preauthorized-next-work-item: WI-SYS-LAYER-VISUAL-EVIDENCE-001
next-phase: closure
updated: 2026-08-14
---

# 原站逆向重构计划

## 目标
以已完成的 `sample/` 公开证据为基础，建立文档先行的 `doc/v0.1/` 框架；先恢复原站系统知识，再决定正式 `src/` 实现。

## 范围
- 建立需求分析、概要设计、详细设计、验证和逆向计划五类文档。
- 建立系统、对象、事件、数据与约定的统一模板和索引。
- 明确 `FACT / INFERRED / DECISION / UNKNOWN`，避免将推断写成事实。
- 世界装配与图层详细设计已由Human接受、验证并关闭；总文档入口迁移已验证，当前执行旧目录第8步清理和普通GitHub推送，视觉证据Human审查短暂暂停。

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
   - 6E. **图层最小视觉补证** — in_progress（证据已验证；等待Human审查）
7. **总文档入口单仓迁移** — complete（26份文档、入口、指针和验证已进入clean基线）
8. **旧总文档收敛与GitHub推送** — in_progress（Human已授权第8步；严格治理清理）

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
| 图层最小视觉补证 | 已授权、证据已验证，清理期间暂停 | 保留既有5场景证据和Human审查材料 | 扩大镜像、私有资源、source map、正式代码、旧项目修改 | 旧目录清理关闭后恢复Human证据审查 |
| 总文档入口单仓迁移 | 已接受、验证并关闭 | 维护已迁入的人话入口、精确指针和单仓边界 | 重组精确文档/证据/代码 | 当前独立执行已授权的第8步清理 |
| 旧总文档收敛与GitHub推送 | 已接受并激活 | 旧目录收敛为跳转README、保留可恢复原件、普通push并核对远端 | 删除旧目录本身、force-push、历史/Phase 2搬迁、代码或证据修改 | clean验证并确认远端main后关闭，恢复视觉审查 |

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
5. 建立 [[doc/v0.1/03-具体怎么做/系统/地图分块：从原站查到了什么（SYS-CHUNK 调查记录）]]，更新证据追踪和验证计划；在 Human 审查前不登记为唯一详细主定义；
6. 做只读独立复核，确认没有写入正式 `src`、没有修改旧 Phaser、没有提前抽取复用模块；
7. 交 Human 审查工作稿、正式详细设计候选和验收标准。

完成标准：SYS-CHUNK 的原站事实、推断、未知项、边界、生命周期、失败路径和验收方式可定位且可审查；相关节点从 `undesign` 进入 `designed` 只能在 Human 审查该详细设计后发生；本阶段不写正式源码。

## 已完成工作项：WI-SYS-CHUNK-CORE-001

目标：使用已接受的最小 TypeScript 测试环境，实现并验证 SYS-CHUNK 确定性 CORE。

结果：批准路径内的 master 契约、行优先索引、坐标/边界换算、玩家3×3、相机+1和目标集合已实现；类型检查、3文件26项测试、供应链审计、治理检查和独立复核均通过。Phaser、Vite、网络、缓存、重试、Tilemap、浏览器集成和完整生命周期仍未授权。

## 当前任务：WI-DOC-PORTAL-CLEANUP-001

| 字段 | 当前值 |
|---|---|
| 工作项 | `WI-DOC-PORTAL-CLEANUP-001` |
| 级别与类型 | `level-1 / governance` |
| 涉及节点 | `not-applicable`；纯文档清理与远端同步 |
| 当前阶段 | `verification` |
| 当前 Gate | `none / not-applicable` |
| Human决定 | `DEC-DOC-PORTAL-CLEANUP-001` |
| 范围与退出标准 | [[doc/v0.1/03-具体怎么做/旧总文档清理：怎样保留跳转并推送（治理任务卡）]] |
| 正式代码授权 | 无；只允许旧目录跳转清理、治理记录和普通push |

目标：把旧总文档目录收敛成单一跳转README，在确认可恢复和本地验证通过后普通推送GitHub。

当前允许：归档两个未迁入原件、清理旧目录重复内容、写跳转README、维护治理记录、普通`git push origin main`和远端核对。

当前禁止：删除旧目录本身、force-push、改写Git历史、搬迁历史/Phase 2、修改正式代码、测试或原站证据。

## 已阻塞或暂停工作项

| 工作项 | 状态 | 暂停理由 | 恢复条件 | 暂停期间允许 |
|---|---|---|---|---|
| `WI-SYS-LAYER-VISUAL-EVIDENCE-001` | paused | Human优先执行旧总文档第8步清理和GitHub推送 | `WI-DOC-PORTAL-CLEANUP-001`关闭 | 只保留既有证据与审查材料，不扩大采集或进入代码 |

`BLK-WI-CLOSURE-001` 已由 `DEC-WORK-RELAY-002` 解决：正式工作项允许为零或一个，CORE 可以正常关闭并进入选择状态。

## 近期候选

| 候选 | 来源 | 当前处置 |
|---|---|---|
| SYS-ASSET 分块所需资源加载与失败路径 | P0顺序、SYS-CHUNK 未完成范围和证据差距 | 依赖当前世界/图层边界工作项；尚未建立 WI 或授权 |
| SYS-CHUNK Phaser 世界集成 | SYS-CHUNK 正式设计中尚未实现的请求、缓存、渲染和生命周期范围 | 只保留候选；需结合世界、图层和资源边界重新排序并独立授权 |

## 已关闭工作项索引

不追溯为历史阶段补建 WI。只为实际建立过的正式工作项保留轻量关闭记录。

| 工作项 ID | 结果 | 涉及节点 | 产物 | result-commit | Human 决定 |
|---|---|---|---|---|---|
| `WI-SYS-CHUNK-CORE-001` | completed | SYS-CHUNK | [[doc/v0.1/03-具体怎么做/系统/地图分块：本轮准备实现什么（SYS-CHUNK CORE 实施授权包）]]；`src/chunk/`；[[doc/v0.1/04-怎么验证与还差什么/地图分块：怎样验证做对了（SYS-CHUNK 验证计划）]] | `f04568f953821e8cc56c33a694171ddab759051f` | `DEC-SYS-CHUNK-CORE-001`；`DEC-WORK-RELAY-002` |
| `WI-SYS-WORLD-LAYER-DESIGN-001` | completed | SYS-WORLD; SYS-LAYER | 两份调查记录；[[doc/v0.1/03-具体怎么做/系统/世界与地图：游戏世界怎样建立和装卸（SYS-WORLD）#SYS-WORLD]]；[[doc/v0.1/03-具体怎么做/系统/图层与遮挡：24层怎样显示和清理（SYS-LAYER）#SYS-LAYER]]；两份验证计划 | `8c7fff7525e8dd77c6367b662f65fec12175d33f` | `DEC-SYS-WORLD-LAYER-DESIGN-001` |
| `WI-DOC-PORTAL-MIGRATION-001` | completed | not-applicable | 五层人话文档与三份人话入口；[根README](README.md)；[[doc/v0.1/03-具体怎么做/总文档迁移：本轮怎样合并文档入口（治理任务卡）]] | `cda98173a24df1b605019d3b7126ea092dd4b6cf` | `DEC-DOC-PORTAL-MIGRATION-001` |

## Next Step
验证旧目录仅剩跳转README、28份原内容可由Git恢复、治理与Git边界全绿；形成clean结果提交后普通推送`origin main`并核对远端，再关闭清理并恢复视觉证据Human审查。

## 错误记录
| 错误 | 处理 |
|---|---|
| Node/Python 内联命令含 shell 反引号导致解析失败 | 改用不含反引号的 Python 正则；成功提取 bundle 静态路径。 |
| Verifier 报告运行时同源 2xx 数为 265，与主助手独立计数 224 不一致 | 不采纳 Verifier 的该计数；主助手确认 224 个运行时 URL 均已镜像，coverage 缺失仍为 0。 |
| Windows 拒绝直接重命名新项目根目录 | 自动回滚后改用复制、299文件逐项 SHA-256 校验、再删除原目录；迁移成功。 |
| 复用与执行约束只停留在对话，未及时写入 AI 必读文档 | 停止继续口头扩展；将有效原则、Human Gate、复用观察和按需门禁写入项目入口与模板。 |
| 使用含反斜杠的内联 `rg` 正则检查路径时转义失败 | 改用 `rg -F` 分别执行固定字符串检查；后续路径检查不拼接复杂正则。 |
| GitHub 仓库创建后首次两次 HTTPS 推送连接失败 | 保留已创建的 Private 仓库和正确 origin；Human 调整网络后重试成功，本地与远程提交一致。 |
| 阶段1浏览器采集后的Python摘要脚本因Windows临时目录路径解析错误触发 `StopIteration` | 主采集已成功；不重复采集，改为定位既有输出并用明确的Windows绝对路径解析。 |
| 首次Sandbox相机右边界断言在Scene首帧读取到未稳定的 midpoint 2240 | 测试读取时机早于resize与平滑跟随稳定；修改临时测试，在首次指标出现后等待并读取稳定帧，再复核真实边界。 |
| Sandbox浏览器检查发现 `/favicon.ico` 返回404，严格零失败断言中止 | 记录为现有开发页非功能性缺口；测试仅豁免该已知favicon请求，其他HTTP失败仍阻塞。 |
| 独立验证器超出只读要求，尝试重跑 `npm ci`，因遗留esbuild进程锁文件失败，随后用 `npm install` 恢复node_modules | tracked文件和lockfile均未变化；Main清理阶段1遗留服务进程并再次确认旧worktree clean。 |
| 首次进程清理脚本的匹配条件包含仓库路径和端口文本，误匹配并终止了执行清理的shell自身 | 改为根据netstat确认唯一残留监听PID 16460后精确终止；8197/8198均无监听，旧worktree保持clean。 |
| 阶段6B按旧工程路径读取 `assets/maps/master.json` 返回ENOENT | 不猜测路径；从manifest和镜像磁盘定位真实公开URL路径后再读取。 |
| 打印minified Bundle片段时Windows控制台GBK无法编码符号并中止 | 设置Python UTF-8输出并只截取目标类片段，不重复原命令。 |
| CORE 实现时首次打印 chunk manager Bundle 片段再次触发 GBK 编码错误 | 未重复原命令；立即设置 `PYTHONIOENCODING=utf-8` 后成功定位公式。 |
| `npm audit` 使用本机 npmmirror 返回未实现的审计端点 | 改用 `--registry=https://registry.npmjs.org`；审计完成，0 vulnerabilities。 |
| 轻量接力首次同步检查发现3个旧章节锚点和1个合并路径表格单元无法解析 | 将3处链接同步到历史授权新标题；把 `findings.md` 与 `progress.md` 拆为两行受影响文件；删除 `py_compile` 生成的未跟踪缓存，后续用内存编译检查。 |
| level-1激活首次治理检查把`findings.md`与`progress.md`合并单元解析成不存在路径 | 将两个受影响文件拆成独立表格行；不修改路径解析器或降低检查标准。 |
| Main首次脚印grid抽查脚本因集合推导式变量遮蔽误报与tilelayer不一致 | 不采纳初次输出；改用明确`(y,x)`坐标集合审计，368个位置直接交集368、双方独有0，确认逐格一致。 |
| Recon将普通chunk分支的全层遍历误报为可写全部24层 | 独立verifier检查守卫`o=["layer1"]`后发现实际只写layer1；Main核对Bundle并同步修正调查记录、设计候选、验证计划和findings。 |
| 正式设计接受后首次sync/pilot提示`level-1 selection decision does not name current work item` | 在`DEC-SYS-WORLD-LAYER-DESIGN-001`适用范围显式加入`WI-SYS-WORLD-LAYER-DESIGN-001`；不降低检查标准。 |
| 视觉补证首次激活检查提示工作项类型、节点范围和任务卡状态不匹配 | 使用检查合同允许的`investigation`类型；将任务卡`node-refs`改为与task_plan一致的标量并将顶层status同步为active；不修改检查器。 |
| Chrome DevTools MCP导航和连接连续超时 | 未产生采集结果；改用本机既有Puppeteer和系统Chrome访问同一公开URL，不增加项目依赖或扩大范围。 |
| 首轮视觉脚本直接warp进bridge区未触发方向切换，且脚印统计误把95个inactive对象池成员当现有脚印 | 不采纳首轮对应结论；改为从入口/出口外用方向键自然跨入，并只统计active footprint。重跑后bridge上下状态均观察到，active脚印由0增至5。 |
| 独立复核指出行为基准和证据差距回写未逐字列入视觉任务卡白名单 | 两项都是AGENTS.md第8节要求的强制闭环；将其显式补入任务卡允许路径，避免依赖隐含协议解释，不扩大采集或实现范围。 |
| 迁移关闭索引使用无路径的README双链时治理检查发现两个同名候选 | 改用明确的Markdown相对链接指向根`README.md`；错误记录不再原样嵌入会被检查器解析的双链语法。 |
| 第8步预检将两份原字节历史来源放入`doc/v0.1`后触发正式文档命名和无效双链检查，且插入决定时重复了一次迁移决定标题 | 不修改历史原件字节；将它们移到仓库根`migration-history/`并更新权威路径，同时删除重复标题。治理文档继续保持正式命名合同。 |
| 清理结果首次暂存命令同时列出`git mv`后的新旧文件路径，旧路径已不存在导致pathspec失败 | 未形成提交或丢失变更；改为对`doc/v0.1`和`migration-history`目录执行`git add -A`，由Git记录重命名。 |

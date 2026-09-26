---
workflow-ref: 03-执行层/README.md
current-work-item: none
work-item-status: none
node-refs: not-applicable
current-phase: design-complete
current-gate: selection
gate-status: idle
authorization-ref: not-applicable
preauthorized-next-work-item: none
next-phase: implementation
updated: 2026-09-17
retrospective-ref: doc/复盘-2026-09-07.md
collaboration-mode: single-person
---

# 原站逆向重构计划

## ⏱ 当前状态（一眼看懂）

- **正在做**：无（`current-work-item: none`）。执行层 16 张系统卡**全部**已完成详细设计（SYS-ENTITY 于 2026-09-14 补齐，16/16 `designed`）；8 个确定性 CORE 已实现并验证。
- **最近完成**：两波并行设计（M1 地图 + P1 玩家 + SYS-CAMERA 范围已定稿）、碰撞集成、运行时安全修复、SYS-ZONE 设计、SYS-LAYER 运行时收束、地图生命周期收口、SYS-ENTITY 实体生命周期设计（已关闭工作项索引末条）、两轮有界运行时修复、网络协议层独立成层、SYS-ENTITY 卡按当前代码重对、**地图资源根收口（根值取原站 `/assets/maps`，`src/asset/` 接入运行期成为唯一入口）**。
- **明确不做**：不关闭 `Q-LAYER-002/003`，不实现车辆/NPC/轨迹/脚印/内容线，不自动合并或推送。
- **阻塞项**：**无技术阻塞**。原记载的两项经 2026-09-14 复核均已不成立：仓库无任何 rebase/merge 残留状态（`git ls-files -u` 为 0），全仓只有一个 worktree，`impl/gameplay-serial` 分支从未创建。真正阻止正式代码写入的是**没有已授权的工作项**，不是环境。
- **下一步**：Human 自主选择下一工作项（候选见「近期候选」列表）；选择后从 `doc/03-执行层/` 对应系统卡读取范围，取得 Human 签字后才能写 `src/` 正式代码。

## 项目目标（9-7 复盘后定调）

### 2026-09-17 文档订正、结构重设与全树链接修复

- 范围：纯文档 + 记忆/技能；当前工作项保持 `none`，门禁状态不变。
- 订正（`06-网络协议层/README.md` 按代码逐条复核，三处写错的事实）：① 原写「本项目无退避」——**实为目标级有指数退避**（`src/chunk/coordinator.ts:233`，2 500 ms 起、翻倍、封顶 30 000 ms；`game/CampusScene.ts:2189` 驱动），原建议「加 1s/2s/4s 退避」作废；② 原 P0「`src/asset/` 无超时无取消」归错位置——该模块只拼 URL 不发请求，缺口在 Phaser 加载器（SYS-ASSET）；③ `maxAttempts` 原表只写 3，未记调用点实传 2。
- 订正（超时与措辞）：`03-执行层/统一失败处理策略.md` §二 chunk 超时「建议 10s」→ **实际 15s**（`game/fetchJson.ts:1`）；§三 SYS-CHUNK 行改为 3 次尝试；§四 P2「重试退避」结项。连带 `名词解释表.md` #250 / #253、`换皮配置总表.md` §六、`02-接口层/API契约表.md` §十 第 4 项、`03-执行层/跨系统数据流场景.md`（「3 次重试」→「每块最多 3 次尝试」）。
- 订正（`maxAttempts` 收口，`DEC-MAP-RETRY-001`）：`game/CampusScene.ts:1346` 由 `{ maxAttempts: 2 }` 改为 **3**，与 `src/chunk/data-store.ts:186` 默认值一致；行数不变，故该文件其余行号引用不受影响。此后只留一个定义处。
- 修复（`doc/` 全树相对链接）：原登记的「15 条失效」不准确，实际 **559 条**（全树 1017 条中）。三类成因——**334 条**写在 `03-执行层/<子目录>/` 里却只写 `../../`（到仓库根少一层）、**209 条**是裸路径（如 `src/npc/staticNpc.ts`）、**16 条**带 `virtual-campus-reconstruction/` 前缀的迁移残留；另 **2 条**链接地址与链接文字不符，按文字改正。改法与安全网：14 份受影响文件先备份到 `bak/doc-links-2026-09-17/`；脚本只动**当前解析不到**的目标，且只取「第一个真实存在」的候选路径；改完逐行比对备份，确认 540 处改动**只发生在链接地址部分**、行数与正文均未变。
- 结构（`06-网络协议层/README.md` 按执行卡体例重设）：删去本层自带的「名词速查」节（名词唯一权威是 `doc/名词解释表.md` §二十四）、逐轮修订记录与历史叙述。体例照 `doc/03-执行层/01-地图线/04-地图分块.md` 那份执行卡：`> 对照…`（本层无原站对照）→ `## 👀 先看这里`（当前状态 / 还没做的 / 你审的就认这几条）→ `## 总览图：六项契约 → 代码 对照` → `## 一、契约落地`（契约 1-6，每个统一「第一性原理 → 它怎么工作的 → 代码在哪 → 设计动作 → 怎么验证它做对了」）→ `## 二、皮落地`（全部数字的唯一实测出处）→ `## 三、配置点：TransportConfig` → `## 四、测试覆盖` → `## 五、后台要做什么` → `## 六、缺口与边界` → `## 七、所有代码位置一页速查` → `## 八、状态声明` → `## 关联文档`。骨架/皮不再单独成节——由「一、契约落地」（骨架）与「二、皮落地」（数字）两节本身承载。
- 连带（节号重编）：旧锚 `§一 / §二.1-2.3 / §四①-⑥ / §六.1-6.3 / §七.0` 全部失效，已同步改完全部 **38 处**外部引用（`名词解释表.md` §二十四 31 处、`02-接口层/API契约表.md` 5 处、`03-执行层/统一失败处理策略.md` 1 处、`换皮配置总表.md` 1 处）→ 新锚 `§一 契约 1-6 / §三 / §5.1-5.3 / §6.2`。改前备份 `bak/doc-netproto-cardframe-2026-09-17/`。
- 规则：发现与代码不符的事实错误**直接改，不再逐条请示**（记忆 `doc-edit-scope-rule`）；无数值证据的跨层分歧、`src/` 写入门槛（`AGENTS.md` §7）、`sample/` 只读边界均不变。
- 同步（`换皮配置总表.md` §17 对齐 `06-网络协议层/README.md`）：该节原有 21 个 `transport.*` 字段已覆盖 §二 皮落地 11 项与 §三 `TransportConfig` 的全部形状，本轮补齐 4 项漏登——`transport.retry.intraLoopBackoffMs`（同一块连试的两次之间歇多久，现值 0，缺口）、`transport.concurrency.priorityOrder`（玩家 3×3 邻域 > 相机可见 > 其余，§五.1「两条不下发的」之一）、`transport.cache.enginePolicy`（引擎长缓存 + `ETag`，§五.3 四档里唯一漏登的一档）、`transport.config.fallbackToDefault`（下发失败降级到内置默认值，不白屏，§三 设计约束 3）。§17 字段 **21 → 25**，总表字段合计 **462 → 466**。
- 连带（口径订正，`换皮配置总表.md`）：「表行数」一列在本版改写后未重算。按该节自己写的定义（除字段定义表以外所有表格的数据行合计）逐节重算——17 节里 15 节相符、2 节不符（§1 `11 → 38`、§17 `25 → 21`）；六个板块小计与合计 `286 → 275`。末节「按系统排行」的表行一列整列是改写前的旧数（17 行全部重算：§1 `13→38`、§14 `46→39`、§16 `21→16`、§3 `31→28`、§7 `24→21`、§5 `22→19`、§13 `21→19`、§10 `18→16`、§11/§12 `0` 不变、§2 `0`、§4 `26→25`、§6 `11→9`、§8 `7→6`、§9 `12→11`、§15 `9→7`、§17 `25→21`）。字段数一列未动（65 / 80 / 28 / 101 / 167 与逐节实测相符）。另订正本文件上一轮把新锚记成 `§5.1-5.3 / §6.2`，实为 `§五.1-五.3 / §六.2`（`06-网络协议层` 正文与 38 处外部引用均用后者）。
- 验证（本轮）：`check-state-consistency.py` PASS；`doc-charset-scan` / `doc-tradchar-scan` 干净，`doc-splitword-scan` 1 处待确认为既有（`换皮配置总表.md:732`，与本轮改动无关）；`doc/` 全树相对链接检查 **0 失效**；总表「配置点总览」的字段数 / 表行数 / 排序脚本复核自洽。
- 备份：`bak/netproto-configpoints-2026-09-17/`（本轮改动前的 `换皮配置总表.md`）。
- 验证：`npx tsc --noEmit` 退出 0；`npx vitest run --maxWorkers=2` **74 文件 / 426 用例全过**；`npm run build` 成功；三份文档扫描器干净；`check-state-consistency.py` PASS；名词表 258 条 / 24 大类无缺号无重复；`doc/` 全树 123 份文件 **1040 条相对链接 0 失效**（含 `migration-history/`、`task-todos/`；链接目标含括号的文件名已按嵌套括号解析）。
- 备份：`bak/maxattempts-2026-09-17/`、`bak/doc-links-2026-09-17/`、`bak/doc-netproto-structure-2026-09-17/`。
- 交付状态：仅文档 + 记忆/技能，**尚未提交**；推送保持独立授权。
- 未授权：不改 `game/`、`src/`、`public/`、`scripts/`、`tests/`；不实现 `TransportConfig` 落码；不扩大 `sample/` 采集。

### 2026-09-14 地图资源根收口（根值取原站 + `src/asset/` 接入运行期）

- Human 授权原文：`a,执行层是对的，理解层陈旧进行修改，`；`把 public/maps/* 挪到 public/assets/maps/（含 chunks/），保持原站的 .webp 扩展名，CampusScene.ts 改成调 src/asset/urls.ts。一次消掉三个问题：和原站一致、文档与代码不再两张皮、src/asset/ 从死代码变成唯一入口我说的是这个`（`DEC-MAP-ROOT-ORIGIN-001`）。
- **要消的三个问题**：① 和原站一致；② 文档与代码不再「两张皮」；③ `src/asset/` 从死代码变成唯一入口。
- **根值定为取原站**：`/assets/maps`。证据是原站 bundle `chunk-WMFY56ZM.js` 里 load 的就是 `/assets/maps/exterior-final.webp`、`/assets/maps/collisions-objects.webp` 等。此前重建版用的是 `/maps`。
- **磁盘**：`public/maps/*`（5 个散列文件 + `chunks/` 26 个 JSON）→ `public/assets/maps/`；旧 `public/maps/` 已不存在。
- **扩展名**：改取原站运行期**实际 load 的那一个** —— `collisions-objects.webp`、`tileset-particles.webp`。同名的 `.png` 是 Tiled 作图源（`tileset-particles.tsx` 指向它），原站运行期不用，不再进 `public/`。
  - ⚠️ 两者尺寸不等：`.png` 是 112×16（7 格，Tiled 声明 `tilecount=7`），`.webp` 是 **96×16（6 格）**。**原站自己就不一致**。Phaser 从纹理宽度现算列数，故运行期实际 6 列；sanitizer 保下来的 GID 只有 69355–69359（第 0–4 格），不越界。JSON 元数据里的 `112/7` 作为 Tiled 作图真值保留，运行期纹理事实写在注释里。
- **代码**：`game/CampusScene.ts` 加 7 行导入 + `CHUNK_MASTER_URL` 常量（现 `181` 行），5 处地图资源加载（现 `589-592` 行）从字面量路径改调 `src/asset/urls.ts` 的 `chunkMasterUrl()` / `tilesetImageUrl()` / `independentLayerUrl()`；纹理**键**不变。至此 `src/asset/` 由死代码变为运行期唯一入口，换校园只改一个常量。
- **脚本**：`prepare-runtime-assets.mjs`（FILES 地图条目 → `assets/maps/*.webp`）、`sanitize-runtime-maps.mjs`（`RUNTIME_MAPS`）、`sanitize-map.mjs`（OUT + 注释）、`check-runtime-assets.mjs`（FILES / `CHUNK_FILES` + `runtimeMapPath()` + 双格式尺寸读取 `webpDimensions`，期望 96×16）、5 个 `browser-*.mjs` 冒烟脚本的路径断言。
- **测试**：`tests/asset/runtime-assets.test.ts` —— `RUNTIME_MAPS` 改 `public/assets/maps`；`pngDimensions` 换 `webpDimensions`；粒子断言改 `.webp` + 96×16。JSON 元数据断言（`tileset-particles.png` / `112` / `tilecount 7` / `columns 7`）**有意保留**（那是 Tiled 作图真值）。
- **文档六份同步**：`06-网络协议层/README.md`（§2.1 地址表、§2.3 由「最要紧的一条」改述为「已收口」并记两次裁决、§3.3/§四①/§六.1 默认值、§7.1 P1 划掉、§7.2 第 2 项结项、§十 签字范围与后续修订记录）；`03-执行层/01-地图线/01-资源加载.md`（行号全面回写 + 皮表 `.png`→`.webp` + 配置点表新增「地图资源根（CDN 前缀）」行 + 运行期唯一入口说明）；`名词解释表.md` #254/#255；`02-接口层/API契约表.md` §十 两处；`换皮配置总表.md` 皮表/配置点表 4 处。
- **另订正**：`01-理解层/01-地图线/04-地图分块.md:209` 重试次数「未定」→ `3`（与执行层同值，消掉跨层不一致）。
- **另订正（顺带，笔误类）**：`03-执行层/01-地图线/01-资源加载.md` 里指向仓库根的链接少了一层（`../../src/...` → 应为 `../../../src/...`），27 处全部改对；这是本卡从 `doc/` 迁到 `doc/03-执行层/01-地图线/` 时留下的路径笔误，且本轮新增的配置点表行沿用了同一错法，故一并修掉。备份 `bak/doc-link-fix-2026-09-14/`。
- 验证：`node scripts/prepare-runtime-assets.mjs` + `check-runtime-assets.mjs` **PASS**（`public/assets/maps/` 含 `chunks/` 26 JSON，旧 `public/maps/` 已不存在）；`npx tsc --noEmit` 退出 0；`npx vitest run --maxWorkers=2` **74 文件 / 426 用例全过**；`npm run build` 成功且 `dist/assets/maps/` 布局正确；`doc-charset-scan` / `doc-splitword-scan` / `doc-tradchar-scan` 干净（`doc-misspell-scan` 35 项候选**均为既有**，本轮未新增）；`check-state-consistency.py` **PASS**。
- 备份：`bak/map-root-2026-09-14/`（`game/CampusScene.ts`、9 个 `scripts/*.mjs`、`tests/asset/runtime-assets.test.ts.bak`；按 `docs/api-skin-readability-20260911` 既有约定不进仓库）。
- ⚠️ 未处理（**只报不改**）：`game/CampusScene.ts` 的 `ChunkDataStore` 调用点传 `maxAttempts: 2`，而文档与 `src/chunk/data-store.ts` 的默认值写的是 `3`。属跨层数值冲突，按既有规则只报不改。→ **2026-09-17 已处理**，调用点改为 3，见上方同日条目。
- 交付状态：**尚未提交**；推送保持独立授权。
- 未授权：不实现方案 B 的 `TransportConfig` 落码；`/sprites/**` 与 `/vendor/phaser.min.js` 不跟原站对齐；不扩大 `sample/` 采集。

### 2026-09-14 第二轮有界修复

- Human 授权：第二轮审查后的 `自己修复`（`DEC-RUNTIME-REPAIR-20260914-02`）；范围为竖屏摇杆、动画碰撞框、缓存页面恢复、交互历史回收四项。
- 已落盘：摇杆使用 Phaser ScaleManager 可见 viewport；特殊动画按原始世界坐标碰撞尺寸/偏移补偿；持久化 pagehide 保留游戏并在 pageshow 刷新缩放；历史令牌改弱引用、物理驻留 leave 清理去重记录、地图弹窗关闭补齐虚拟 leave。
- 验证：新增 9 项回归（含仓库 Phaser 真正的 Body 变换函数）；typecheck、生产构建通过；`npx vitest run --maxWorkers=2 --reporter=dot` 全量 74 文件、426 测试通过。本地启动页已观察到 READY/Play；移动触控与真实浏览器往返缓存仍以模拟回归验证为准。默认并发跑曾有 1 项 5 秒超时，低并发全量复验通过。
- 边界：系统卡工程状态保持既有值；已随第一轮一起提交（`3bede12`），推送待独立授权。

### 2026-09-14 有界运行时修复完成记录

- Human 授权原文：`自己修复`、`继续修复`；范围为本轮代码审查发现的 6 项问题（`DEC-RUNTIME-REPAIR-20260914`）。本轮已完成本地修复，当前工作项保持 `none`。
- 已修复：异步地图 mutation 串行与 idle 释放、场景清理异常隔离及旧代退役、玩家动画统一场景时钟、游戏内失败分块退避重试、JSON 请求 15 秒 deadline、可选玩家动画素材降级。
- 验证：类型检查通过；73 个测试文件、417 项测试通过（新增 12 项）；生产构建与运行资源检查通过；状态一致性检查通过。
- 浏览器交互复验：工具额度限制阻断，本轮以自动化回归验证为准；原本地服务地址为 `http://localhost:4175/`。
- 交付状态：已提交（`3bede12`）；推送和完整系统状态晋升保持独立授权。

### 2026-09-14 网络协议层独立成层完成记录

- Human 授权原文：`既然这个和api文档不一样，那就把它单拎出来`；`是和理解层同级的`；`加一个对这个板块的人话说明…`；`你自己修订`；`登记`（`DEC-DOC-LAYER-NETPROTO-001`）。本轮**纯文档**，当前工作项保持 `none`，门禁状态不变。
- 新增：`doc/06-网络协议层/README.md` —— 与 `01-理解层/` 平级的独立层，含人话说明、原站实测、本机实测、六项传输契约（地址 / 复用 / 配额 / 时限 / 失败定性 / 撤回）、骨架与皮、后台下发清单、缺口与未确认。
- 订正：`名词解释表.md` #20 分块文件名 `{cx}_{cy}.json` → `chunk{index}.json`；`API契约表.md` §十 标题改「已独立成层」并加跳转入口、订正「无缓存」→「无持久缓存」；§十一 名词计数 226 → 257 条、23 → 24 大类。
- 新增词条：`名词解释表.md` §二十四（#227–#257，共 31 条）。新增板块：`换皮配置总表.md` §六「网络协议层（补充板块）」。
- 前提订正：本层 §四① 原写「同一个地图资源三处异名」**不成立** —— 原站 `/assets/maps/` 是 30 文件**全集**，我们 `/maps/` 是 5 文件 **sanitize 子集**，另有 2 张页面图在 `public/assets/maps/`。改述为「两个资产世界」，并给出 A / B 收口方案。
- 验证：本轮涉及的 6 份文档 267 条相对链接 0 失效；`doc-charset-scan` / `doc-splitword-scan` / `doc-tradchar-scan` 干净；`check-state-consistency.py` PASS；名词表 257 条 / 24 大类无缺号无重复。
- 顺带订正：`决策记录.md`、`task_plan.md` 里 3 条 HEAD 就已存在的相对链接层级笔误（`README.md` → `../README.md` 等）。
- ⚠️ 未处理（**只报不改**）：`doc/` 全树另有 15 条失效相对链接，集中在 `01-理解层/写作规范.md`、`03-执行层/00-总账.md`、`03-执行层/README.md`（多数写成 `virtual-campus-reconstruction/01-理解层/…` 前缀，疑为 9-7 目录迁移残留）和 `05-素材/README.md → ../README.md`。不属本轮范围，未动。→ **2026-09-17 复核：「15 条」这个数字是错的，实际 559 条；同日已全部修完**，见上方同日条目。
- 交付状态：仅文档，已提交 Git（`8a57396`）；推送保持独立授权。
- 未授权：不改 `game/`、`src/`、`public/`、`scripts/`、`tests/`；不扩大 `sample/` 采集；**地图资源根收口**（本层 §四①、§7.3 第 6 项）待单独裁决。

### 2026-09-14 网络协议层定位改定与地址契约选 B（重写记录）

- Human 授权原文：`第一个我没听懂…我再想这个板块应该和地址很有关系吧，还有原网站关于这个板块的东西你们查不出来吧`；`B（保留 /maps，把根路径做成后台可下发的配置）`；`这个板块既然和地址本地息息相关那么就别考虑原网站了，把原网站的分析部分给删了，然后你自己从第一性原理出发，也是从我们目前已经跑出的项目实际出发，对相关内容进行设计`（`DEC-DOC-LAYER-NETPROTO-002`）。本轮**纯文档**，当前工作项保持 `none`，门禁状态不变。
- **定位改定**：`doc/06-网络协议层/` 从「原站逆向层」改为「**我们自己的传输设计层**」。原站网络证据六项契约里**五项查不到**——① 地址能查到，② 缓存（记录无响应头字段）、③ 并发（396 条挤在 14.6 ms 内，时间戳分辨率不足）查不到，④ 时限 / ⑤ 失败定性 / ⑥ 撤回**原理上就查不到**（是客户端逻辑，不是网络行为；被取消的请求根本不出现在日志里）。加上路径根已不沿用原站，原站分析对本层不再有设计输入价值。
- **删除**：原 §二「原站实测（证据）」整节（含 2.1 请求总量 / 2.2 地址约定 / 2.3 分块几何 / 2.4 从证据推不出来的东西），以及 §三.3 的原站列、§四 各契约表的原站列、§六 里的原站事实（3 个真实 404、原站 mimeType）。**保留** §七.0 一段追溯说明（约 10 行），写明「不是漏查了」并指向原始证据 `sample/analysis/runtime-network.json`。
- **Human 裁决（地址契约，选 B）**：**保留 `/maps` 为运行期地图根，把根路径做成后台可下发的配置值**。不改运行期现状，改的是「这个值从哪来」。原 §四① 的 A / B 二选一收口方案随之收口。
- **重设结构**：`一、第一性原理` → `二、我们的现状（已跑出来的站实测）` → **`三、设计总纲：一个传输配置（TransportConfig）`（新增）** → `四、六项契约的设计`（每项统一写「第一性原理 → 我们现状 → 设计动作」）→ `五、骨架与皮` → `六、后台管理系统需要提供什么` → `七、缺口与边界` → `八、权威位置` → `九、名词速查` → `十、状态声明`。原来的「原站 / 本机 / 文档」三方对照结构全部取消，改为单向设计稿。
- **核心设计结论**：地址契约压缩成「**一个必下发值 + 三条推导**」——根值 `mapBaseUrl`（默认 `/maps`）是唯一必下发项；分块地址**相对 `master.json` 地址解析**（根一换，索引和 25 个分块一起换）、瓦片图地址 = `{根}/{tileset.image}`、索引文件名固定为 `chunks/master.json`。**推导优于清单**的理由：清单要人为维护早晚与实际文件对不上，而推导不可能不一致（`master.json` 本身就是唯一真相源）。
- **新增设计内容**：① `TransportConfig` 配置形状（`mapBaseUrl` + `timeouts.json/image` + `retry.maxAttempts/backoffMs` + `concurrency.maxInFlight`），每个字段都能追溯到「现值」或「缺口」，无凭空发明；② 配置三来源与降级规则（代码默认值 < 构建期注入 < 后台运行时下发，**默认值必须能独立工作**，后台挂掉降级不白屏）；③ **新发现的取消口子**——加并发队列会新增「已排队未发出」这一状态，`abort()` 管不到，必须能单独丢弃，否则取消失效（写在 §四⑥）。
- **唯一建议改现有行为的一处**：把第 4 类失败（内容不合法，`ChunkDataError`）从重试路径里拿出来——现在仍重试 3 次，但重试拿到的还是同一个坏文件，纯浪费 2 个请求；按 `统一失败处理策略.md` 三级分类应走「致命 / 可降级」。
- **连带订正**：`名词解释表.md` #256「路径根不一致」**作废**（B 下根值不再需「收口」而是改为可下发）→ 替换为「传输配置（TransportConfig）」；新增 #258「优先级队列」；清理 #238/#245/#248/#254/#255 里的原站事实；#252/#253 锚点随新结构改为 §二.2。全表 257 → **258 条**，24 大类不变。
- **连带订正（其他文档）**：`API契约表.md` §十 定位说明改为「不承载原站分析」、删 `runtime-network.json` 证据指针、第 1/2 项去掉原站未转化讨论并写入 B 的裁决；§十一 名词计数 257 → 258。`换皮配置总表.md` §六 根路径「当前值」去原站并标注 B，新增「两条不下发（并发优先级次序 / 页面缩略图路径）」与分档依据说明。
- **数值订正**：`API契约表.md` §十末段原写「超时 10s、最多 6 个并发」**与代码不符**——实际 JSON 超时 15 000 ms（`game/fetchJson.ts:1`），并发**完全无上限**（未实现）。该行改为不写具体数字，并加订正说明。
- 验证：7 份文档相对链接 0 失效；`doc-charset-scan` / `doc-splitword-scan` / `doc-tradchar-scan` 干净；`check-state-consistency.py` PASS；名词表 258 条 / 24 大类无缺号无重复。
- 交付状态：仅文档，**尚未提交**；推送保持独立授权。
- 未授权：**不授权实现方案 B** —— `TransportConfig` 落码需改 `src/`、根值收口需改 `game/` + `scripts/` + `tests/`，按 `AGENTS.md` §7 均需已授权的正式工作项（`src/asset/` CORE 已 closed，重开需重新授权）；不改 `public/`；不扩大 `sample/` 采集。
- **效力说明（2026-09-14 同日稍后）**：本块的**「保留 `/maps`」已被取代**——Human 当天随后下 `DEC-MAP-ROOT-ORIGIN-001`（见上方「地图资源根收口」块），根值改定为**取原站 `/assets/maps`**，`public/maps/` 挪到 `public/assets/maps/`，`game/CampusScene.ts` 改调 `src/asset/urls.ts`。**本块第 82 行「保留 `/maps` 为运行期地图根」、第 84 行「默认 `/maps`」、第 88 行「去原站并标注 B」、第 92 行「不授权……根值收口」按此作废**；**「方案 B（根路径改为后台可下发）」本身仍然有效**——改的是「值从哪来」的机制，不是「值是多少」。本块其余内容（删除原站分析、重设结构、`TransportConfig` 设计、`名词解释表.md` 的连带订正）不受影响。本块保留为历史，不回改。

### 2026-09-14 已提交三堆并回填提交号

- Human 授权原文：`都提交，先别推到远程别推main`（2026-09-14）；同轮 AskUserQuestion 选择「分堆提交」「bak/ 不进仓库」「卡过时了 → 现在重新对一遍」。
- 已提交四笔（均为本地提交，**未推送、未推 main**；当前分支 `docs/api-skin-readability-20260911`）：
  - `b640ef4` 文档笔误/编码订正 14 份 + 5 个扫描脚本 + `.gitignore` 加 `bak/`
  - `8a57396` 网络协议层独立成层（`DEC-DOC-LAYER-NETPROTO-001`）
  - `3bede12` 两轮有界运行时修复代码 + 测试（`DEC-RUNTIME-REPAIR-20260914` / `-02`）
  - `081dca3` 上述三项的决策记录与计划状态台账
- 提交前门禁：`npx tsc --noEmit` 退出 0；`npx vitest run` 74 文件 / 426 用例全过。
- 备份目录 `bak/doc-fix-2026-09-14/` 按 Human 决定**不进仓库**，已写入 `.gitignore`。

### 2026-09-14 SYS-ENTITY 卡按当前代码重对

- Human 授权原文：`卡过时了` → AskUserQuestion 选择「**现在重新对一遍**」（2026-09-14）。
- 起因：SYS-ENTITY 两卡于当日 16:10 定稿（`ec3df47`、`c68b971`），但 `game/` 侧 20:55 又落了两轮有界运行时修复，导致卡上三项结论与行号**失效**。
- 重对后的三处**结论性**修正：
  1. 清理调用数 **23 → 30**（30 个 `cleanup()` 步骤 = 25 个对象 + 5 个方法调用；新增 `entryCameraRuntime`、`entryTrainAdapter`）
  2. 清理失败行为 **"不继续" → "继续"**——逐项 try/catch，失败不断链，跑完统一抛 `AggregateError`（旧卡写的"主体无逐项 try/catch"已作废）
  3. 控制租约来源 **1 种 → 4 种**（`modal-open` / `map-open` / `camera-tour` / `entry-transition`）
- 顺带：行号全面刷新（`performShutdown` 1186-1282 → 1199-1315、收据 313-332 → 315-334、`shutdownDynamicWorld` 1751-1788 → 1784-1821、`sceneDestroyed` 413 → 404 且检查点 10 → 20 处、`main.ts` pagehide 315 → 318 并拆出 pageshow 322、`coordinator.destroy` 174 → 190）；测试基线 70/405 → **74/426**；租约用例 7 → 8。
- 新增残余未知两条：**有失败时收据不产出**、**重试是"补跑"非"重跑"**。
- 同步范围（《定稿落地清单》10 处）：执行卡、理解卡、总账、进度总览、API 契约表（含 §四 抬头一处此前遗漏的 `undesign` 残留）、换皮配置总表、决策记录、task_plan。系统地图无需改动（SYS-ENTITY 不涉及三条桥）。
- 边界：**仅文档**，不改 `game/`、`src/`、`tests/`、`sample/`；不推送。

- **整体大目标**：逆向 + 后端 + 后台 + 换皮做各校园网站（Human 9-7 复述）。
- **Phase 1（当前）**：逆向 + 复刻验证 + 16 系统骨架准备。
- **Phase 2（远期）**：在 Phase 1 骨架上补后端、后台、换皮能力。
- **协作模式**：单人开发（Human + 单个 AI 助手在主对话推进）。AGENTS.md 7.5/7.6 是扩展规则，仅在第二位协作者或外部 API 规范提交时启用。
- **详细复盘**：[`doc/复盘-2026-09-07.md`](复盘-2026-09-07.md)。

## 目标
以已完成的`sample/`公开证据为基础，在`03-执行层/`维护文档先行的16张系统卡、总账和操作手册；先恢复原站系统知识，再由Human逐工作项授权正式`src/`实现。

## 范围
- 建立需求分析、概要设计、详细设计、验证和逆向计划五类文档。
- 建立系统、对象、事件、数据与约定的统一模板和索引。
- 明确区分原站事实、推断、设计决定和未确认，避免将推断写成事实。
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
| 轻量任务接力制度 | 已通过并完成首次真实试点 | 正常关闭已完成工作项；无预授权下一项时进入选择状态 | 把内部小步骤全部升级为 门禁或完整 P/A；制造虚假选择工作项 | 按既有权威来源滚动提出下一项候选 |
| SYS-CHUNK CORE 实现授权与执行 | 已通过、验证并关闭 | 维护已验证的 CORE 结果和授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、扩大为通用框架 | 下一项需重新选择和授权 |
| 世界装配与图层边界调查及设计 | 已通过、验证并关闭 | 维护已接受正式设计和验证基线 | 正式代码、Phaser/Vite集成、旧项目修改和复用提取 | 当前已进入最小视觉补证 |
| 图层最小视觉补证 | 已授权、证据已验证、Human通过并关闭 | 维护已关闭的5场景证据结论 | 扩大镜像、私有资源、source map、正式代码、旧项目修改 | 已关闭；进入下一工作项选择 |
| 总文档入口单仓迁移 | 已接受、验证并关闭 | 维护已迁入的人话入口和单仓边界 | 修改证据或代码 | 已完成 |
| 旧总文档收敛与GitHub推送 | 已接受、验证并关闭 | 维护单README跳转、两份可恢复原件和远端同步关系 | 删除旧目录本身、force-push、历史/Phase 2搬迁、代码或证据修改 | 已完成 |
| 执行层16卡与历史归档迁移 | 已接受、验证并关闭 | 维护16卡、总账、操作手册、旧doc归档和当前入口 | 修改`sample/src/tests`、旧Phaser、证据结论、内容TBD | 已完成；当前入口只认`03-执行层/` |
| SYS-ASSET CORE 实现授权与执行 | 已验证并关闭（类型检查 + 37 测试通过） | 维护 `src/asset/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、扩大为通用框架 | 已完成；转 SYS-LAYER |
| SYS-LAYER CORE 实现授权与执行 | 已验证并关闭（类型检查 + 12 项测试通过） | 维护 `src/layer/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Tilemap 写入、扩大为通用框架 | 已完成；转 SYS-WORLD |
| SYS-WORLD CORE 实现授权与执行 | 已验证并关闭（当前 `tests/world/` 32 项；全库149项通过） | 维护 `src/world/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存、渲染、Tilemap 真实写入、碰撞重算、扩大为通用框架 | 已完成；本次运行时安全补偿回滚已验证，完整世界仍需独立范围 |
| SYS-INPUT CORE 实现授权与执行 | 已验证并关闭（类型检查 + 23 项测试通过） | 维护 `src/input/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、rexVirtualJoystick 插件集成、真实键鼠/触摸监听、扩大为通用框架 | 已完成；真实运行时接入已由 `WI-SYS-INPUT-TOUCH-001` 有界验证 |
| SYS-MOVE CORE 实现授权与执行 | 已验证并关闭（类型检查 + 8 项测试通过） | 维护 `src/move/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Arcade 物理引擎集成、分轴碰撞、真实 body 注册、扩大为通用框架 | 已完成；转 SYS-PLAYER |
| SYS-PLAYER CORE 实现授权与执行 | 已验证并关闭（类型检查 + 13 项测试通过） | 维护 `src/player/` 已验证结果与授权边界 | 修改旧 Phaser、接入 Phaser/Vite、网络/缓存/渲染、Phaser Sprite/动画创建、真实贴图加载、被抓/换装/传送完整流程、扩大为通用框架 | 已完成；转 SYS-CAMERA |
| SYS-CAMERA CORE 实现授权与执行 | 已验证并关闭（类型检查 + 10 项本系统测试通过，结果进入 `4f980c5`） | 维护 `src/camera/` 已验证结果与授权边界 | 修改旧 Phaser、扩大为通用框架 | 已完成；后续渲染授权已消费该结果 |
| 联网渲染可玩雏形 | 已接受、已落盘、自动验证和Human视觉验收均通过（结果提交 `7c5a738`） | 保留现有雏形并完成基础浏览器视觉验收 | 在验证入口落地前继续局部补丁、扩展功能或宣称完整原站一致 | 已关闭；后续动态分块另行授权 |
| 当前工作项关闭验证入口 | 已接受（签字 `ok。开始增加吧`，2026-08-17） | 新增只读验证器、测试数据 测试和必要命令入口；同步当前状态 | 修改 `src/game/sample`、自动签署 Human验收关、引入新角色/模板或全项目重审 | 工具自测、项目实测和一致性检查通过后关闭 |
| 文档总控修复 | 已接受、已落盘、已验证（结果提交 `c40f6df`） | 恢复 `计划表.md` 一页总控、拆清 CORE/完整系统进度、同步公式与状态口径 | 修改 `src/`、`game/`、`public/`、`sample/`；修复运行时；自动关闭后续工作项 | 已关闭；下一项需Human重新选择并授权资源修复 |
| 资源可复现性调查 | 已接受、已落盘、已验证（结果提交 `f8a9014`） | 盘点入口、地图、tileset和public资源的可复现来源，形成三种方案比较 | 修改 `src/`、`game/`、`public/`、`sample/`；下载新资源；直接修复地图 | 已关闭；方案 A/B/C 需Human选择后再单独授权实现 |
| 资源可复现性实现 | 已接受、已落盘、已验证（结果提交 `6815a6f`） | 从仓库内 sample 公开镜像生成4个运行资源和sanitized地图，接入构建生命周期，增加资源检查 | 修改 `src/`、`game/`、`sample/`；纳入粒子tileset；改动确定性CORE；推送远端 | 已关闭；浏览器验证需下一项单独选择和授权 |
| 浏览器启动与入口验证 | 已接受、已落盘、自动验证和Human视觉验收均通过（结果提交 `7c5a738`） | 把 `game/` 纳入类型检查，真实启动页面并记录 Tilemap/资源/视口结果 | 修改 `src/`、`public/`、`sample/`；纳入粒子完整渲染；自动替Human签署视觉验收关 | 已关闭；编译预览和视觉验收关 均通过 |
| 多人协作 PR 规则吸收 | 已接受、已落盘、已验证（结果提交 `9bd475b`） | 将 PR #2 核心理念整合进当前 `AGENTS.md` 和执行层手册，保持 `task_plan.md` 唯一动态状态源 | 原样合并PR #2；复制PR Todo；修改 `src/`/`game/`/`sample/`；自动push/merge | 已关闭；后续正式协作按新规则执行 |
| API 协作审查流程融合 | 已接受、已落盘、已验证（结果提交 `6da5755`） | 把 PR #3 的外部规范审查方法融入当前工作流，保持项目 API 契约和系统卡为权威 | 把外部收据当作事实；没有源文档就宣称已验证；直接修改 API 契约或代码 | 流程已关闭；实际外部文档仍需单独输入和审查 |
| 浏览器视觉验收 | 已接受、已落盘、已验证（编译预览与截图由Human确认，2026-08-19） | 确认构建产物的地图、玩家、视口和基础画面可接受 | 自动扩展功能、自动修改缩放、代替Human签署后续视觉结论 | 已关闭；下一项需重新选择和授权 |
| 运行时安全有界修复 | 已接受、已落盘、已验证；结果提交 `632a0c9` | 处理 World 部分写入回滚、生产环境诊断/钩子 限制、入口启动失败收敛、test hook 清理和 网站图标 入口清理 | 不扩展完整 Phaser 清理、完整图层、粒子、NPC、交互、验证器或远端 Git 操作 | 普通 生产环境构建、普通/跨块/安全 验收 与 测试钩子 碰撞 验收均通过；工作项已关闭 |
| SYS-ZONE 区域触发逆向与设计 | 已接受、已落盘、已验证；结果提交 `05c2274` | 核对公开 marker/区域触发来源、坐标/区域边界、进入/离开和防重复行为；补 `04-内容层/作品集内容.md` 内容索引、SYS-ZONE 七格、接口和未知队列 | 不写 `src/`/`game/` 正式代码；不实现 SYS-INTERACT 弹窗；不猜未证实文案、资源或触发器 | 设计已通过 Human review；工作项关闭，正式实现需另行授权 |
| SYS-LAYER 图层运行时语义收束 | 设计与有界实现均已完成 | 证据、`Q-LAYER-002`/`003`、24 层策略、写入/清除 边界和 World/Chunk 职责已收敛；设计关闭提交 `c82aa4a`，有界实现提交 `10c7d88`；完整节点仍为 `designed` | 不把有界实现误报为完整系统；不擅自关闭 粒子3层 或特殊13层未确认事项 | 当前回到工作项选择；后续完整语义需另行授权 |
| SYS-WORLD + SYS-CHUNK 地图生命周期收口 | 已完成，结果提交 `d61faa1` | 可取消请求、过期回写守卫、异步 数据变更 等待、Phaser Tilemap/碰撞器 显式 清理 和固定场景资源边界指标已验证 | 不把固定场景指标写成完整 FPS/内存结论；不实现 NPC/车辆/粒子/完整24层消费者或原站13层事实 | 当前转入 SYS-INPUT 真实运行时接入 |
| SYS-CHUNK + SYS-WORLD 动态运行时集成 | 已接受、已落盘、自动验证和Human视觉验收均通过；结果提交 `b707553` | 在隔离 worktree 中实现 master/chunk 动态目标、请求缓存/去重、World 原子 写入/清除/回滚、销毁守卫和 Phaser 适配；已修正 瓦片集起始GID 与空 GID 映射 | 修改 `sample/`、旧 Phaser 项目；纳入粒子/NPC/完整交互；绕过 SYS-LAYER；自动替Human签署视觉验收关 | 类型检查、145项测试、构建、资源检查、浏览器验收和跨块 验收均通过；墙体/桥碰撞由后续独立工作项完成 |

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
4. 将未证实内容保留为未确认并登记后续调查；
5. 建立[SYS-CHUNK历史调查记录](migration-history/doc-v0.1/03-具体怎么做/系统/地图分块：从原站查到了什么（SYS-CHUNK 调查记录）.md)，更新证据追踪和验证计划；在Human审查前不登记为唯一详细主定义；
6. 做只读独立复核，确认没有写入正式 `src`、没有修改旧 Phaser、没有提前抽取复用模块；
7. 交 Human 审查工作稿、正式详细设计候选和验收标准。

完成标准：SYS-CHUNK 的原站事实、推断、未知项、边界、生命周期、失败路径和验收方式可定位且可审查；相关节点从 `undesign` 进入 `designed` 只能在 Human 审查该详细设计后发生；本阶段不写正式源码。

## 已完成工作项：WI-SYS-CHUNK-CORE-001

目标：使用已接受的最小 TypeScript 测试环境，实现并验证 SYS-CHUNK 确定性 CORE。

结果：批准路径内的 master 契约、行优先索引、坐标/边界换算、玩家3×3、相机+1和目标集合已实现；类型检查、3文件26项测试、供应链审计、治理检查和独立复核均通过。Phaser、Vite、网络、缓存、重试、Tilemap、浏览器集成和完整生命周期仍未授权。

## 已完成工作项：WI-SYS-LAYER-VISUAL-EVIDENCE-001

目标：只检查玩家遮挡、roof、bridge、粒子3层和footsteps共5个原站公开运行场景，为图层结论提供最小截图和运行状态。

结果：5 场景证据全部 VERIFIED（layer8 遮挡、factory roof 淡隐恢复、bridge1 进出、footsteps 0→5），粒子3层 为 VERIFIED_WITH_RESIDUAL_UNKNOWN 并转 `Q-LAYER-002`；证据在 `sample/analysis/layer-visual-evidence/`。Human 证据结论审查 `通过`（2026-08-15），工作项关闭。历史任务卡归档于 [migration-history/doc-v0.1/03-具体怎么做/系统/图层与遮挡：最小视觉补证任务卡（SYS-LAYER）.md](migration-history/doc-v0.1/03-具体怎么做/系统/图层与遮挡：最小视觉补证任务卡（SYS-LAYER）.md)。

## 当前工作项

当前没有 active 工作项（`current-work-item: none`）。上一项 `WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001`（两波并行集成：M1 地图运行时收口 + P1 玩家运行时）的设计阶段已完成并通过 Human 签字，但 WSL 沙箱拦截 `git worktree` 命令导致正式代码窗口尚未创建——所以暂停了实现阶段。并行设计的产出（接口文档、文件所有权划分、M1/P1/CAMERA 范围）已落盘于 `task-todos/` 和 API 契约表。

皮/骨架接口仍以 [`02-接口层/API契约表.md`](02-接口层/API契约表.md) 为唯一索引；SYS-CAMERA 正式实现当前禁止开工（需等 M1+P1 先跑通）。

## 已阻塞或暂停工作项

- `WI-VERIFY-CURRENT-WORK-ITEM-001`：已接受但验证器文件尚未落地；不能误报为已实现或已验证。
- `WI-RENDER-PLAYABLE-001`：已通过类型检查、133项测试、构建、编译预览、浏览器验收和Human视觉验收；结果提交 `7c5a738`。不代表完整原站功能或16个正式系统已完成。
- 当前没有技术阻塞；SYS-ZONE 设计已关闭。但完整24层动态消费者、世界交互弹窗、NPC和交互系统、完整玩法线以及最终 FPS/GPU/纹理内存性能基准测试都仍需后续独立工作项来覆盖。
- `WI-RESOURCE-REPRO-001`：调查已完成，结果提交 `f8a9014`。
- `WI-RESOURCE-IMPLEMENT-001`：方案 A 已完成，结果提交 `6815a6f`。
- `WI-BROWSER-STARTUP-001`：自动启动验证已通过并关闭，结果提交 `7c5a738`；视觉验收关不自动签署，转由 `WI-RENDER-PLAYABLE-001` 等待Human。
- `WI-DOC-COLLABORATION-ADOPT-001`：PR #2 核心规则已吸收，结果提交 `9bd475b`。
- `WI-API-COLLABORATION-REVIEW-001`：PR #3 审查理念已融合，结果提交 `6da5755`；不改变当前 API 事实。
- 当前没有技术阻塞；`Q-LAYER-002/003` 继续保持未确认。请求取消和当前重构清理逻辑已有界验证；最终硬件性能阈值、完整动态消费者和完整玩法线不并入本设计项。

## 近期候选

| 候选 | 来源 | 当前处置 |
|---|---|---|
| `WI-SYS-ZONE-DESIGN-001` | 已完成，结果提交 `05c2274` | SYS-ZONE 公开证据逆向与设计已完成；正式代码和 SYS-INTERACT 仍未授权 |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-001` | 已完成，结果提交 `c82aa4a` | SYS-LAYER 证据与有界运行时设计已接受、落盘并验证；不代表代码或完整系统完成 |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` | 已完成，结果提交 `10c7d88` | 有界视觉/屋顶/标记/脚印运行时语义、失败诊断、粒子3层未消费保留和数据清洗边界已验证；完整地图生命周期仍不在范围 |
| `WI-SYS-MAP-LIFECYCLE-CLOSURE-001` | 已完成，结果提交 `d61faa1` | SYS-WORLD/SYS-CHUNK 请求取消、过期结果、异步数据变更、地图网格/碰撞器清理和固定场景边界指标已验证；不代表完整地图系统完成 |
| `WI-SYS-INPUT-TOUCH-001` | 已完成，结果提交 `66a20f8` | 接入移动端原生 Phaser pointer 摇杆；桌面隐藏、单指、键盘优先级切换、释放恢复和移动端浏览器验收已验证；不代表完整 SYS-INPUT 节点完成 |
| `WI-PARALLEL-MAP-RECON-001` | 已完成，结果基线 `85af370` | A-D 报告和 D 可复核收据已提交；`Q-LAYER-002/003` 保留；转入两波并行设计 |
| `WI-MAP-GAMEPLAY-PARALLEL-DESIGN-001` | 已完成，结果提交 `a16ae54` | 接口、所有权、两波门禁 和三个实施包已获 Human 接受 |
| `WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001` | Human 已授权；原记载的「因 WSL 阻塞暂停」经 2026-09-14 复核不成立，当前不是 work-item 状态而是等待 Human 选定下一项 | M1 地图与 P1 玩家并行；SYS-CAMERA 已授权暂缓 |
| `WI-RUNTIME-SAFETY-001` | 已完成，结果提交 `632a0c9` | World 同步/异步部分写入回滚、生产环境诊断/钩子限制、入口启动失败收敛、测试钩子清理和网站图标入口均已验证；完整资源清理、完整图层、粒子/NPC/交互和验证器仍不在范围 |
| `WI-VERIFY-CURRENT-WORK-ITEM-001` | 已接受但只读验证器文件尚未落地 | 作为后续协作交付门禁候选；不与运行时安全工作项混写 |
| `WI-API-COLLABORATION-REVIEW-001` | PR #3 审查理念已融合，结果提交 `6da5755`；实际外部文档未进入项目事实源 | 若未来取得源文档，按已落盘流程单独审查；当前不合并PR #3、不宣称外部规范已验证 |
| SYS-MOVE + SYS-LAYER + SYS-WORLD 碰撞集成 | `WI-SYS-MOVE-WORLD-COLLISION-001` 已关闭 | 已实现并验证；结果提交 `e3f412a`，当前转入运行时安全收尾；完整系统语义仍不自动扩展 |

## 已关闭工作项索引

不追溯为历史阶段补建 WI。只为实际建立过的正式工作项保留轻量关闭记录。

> `WI-SYS-LAYER-RUNTIME-SEMANTICS-001` 与 `WI-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` 均已关闭；本表登记设计和有界实现结果，完整 SYS-LAYER 节点仍按系统卡保持 `designed`。

| 工作项 ID | 结果 | 涉及节点 | 产物 | result-commit | Human 决定 |
|---|---|---|---|---|---|
| `WI-SYS-ENTITY-DESIGN-001` | completed | SYS-ENTITY | SYS-ENTITY 执行层卡（5 骨架落地 + 皮 + 配置点 + 验收标准 + 残余未知 + 原站证据边界）；理解层卡按代码修正三处；`Q-ENTITY-001` 关闭；API 契约表三条接口按实际设计改写；总账/进度总览同步 | `ec3df47` | `DEC-SYS-ENTITY-DESIGN-001` |
| `WI-MAP-GAMEPLAY-PARALLEL-DESIGN-001` | completed | SYS-ASSET; SYS-WORLD; SYS-LAYER; SYS-CHUNK; SYS-PLAYER; SYS-CAMERA | 两波并行设计、皮/骨架接口、文件所有权、M1/P1/Camera 候选包和验收门禁 | `a16ae54` | `DEC-MAP-GAMEPLAY-PARALLEL-DESIGN-001` |
| `WI-PARALLEL-MAP-RECON-001` | completed | SYS-ASSET; SYS-WORLD; SYS-LAYER; SYS-CHUNK | A-D 四份 `task-todos/` 报告；D 可复跑探针、27 样本原始收据和确定性校验 | `85af370` | `DEC-PARALLEL-WORKTREE-001` |
| `WI-SYS-CHUNK-WORLD-INTEGRATION-001` | completed | SYS-CHUNK; SYS-WORLD; SYS-ASSET; SYS-LAYER | master/chunk 运行时、World事务、Phaser动态装卸、GID兼容修复、验证器页面清理和视觉验收 | `b707553` | `DEC-SYS-CHUNK-WORLD-INTEGRATION-001` |
| `WI-SYS-MOVE-WORLD-COLLISION-001` | completed | SYS-MOVE; SYS-LAYER; SYS-WORLD; SYS-CHUNK | 玩家 Arcade Body、walls/bridge 碰撞、桥状态切换、`body.blocked` 反馈、碰撞器 安全清理、碰撞/桥/跨块 验收 | `e3f412a` | `DEC-SYS-MOVE-WORLD-COLLISION-001` |
| `WI-RUNTIME-SAFETY-001` | completed | SYS-WORLD; SYS-CHUNK; SYS-APP | World 当前层同步/异步回滚补偿、生产环境诊断/钩子 限制、入口启动失败收敛、网站图标 清理、普通安全/普通/跨块/测试钩子 碰撞 验收 | `632a0c9` | `DEC-RUNTIME-SAFETY-001` |
| `WI-SYS-ZONE-DESIGN-001` | completed | SYS-ZONE | 11 个 marker 公开来源、严格 `<30px`/100ms 区域规则、visited/手动关闭语义、`menuId` 内容桥接、内容索引、SYS-ZONE 设计和皮/骨架接口 | `05c2274` | `DEC-SYS-ZONE-DESIGN-001` |
| `WI-RENDER-PLAYABLE-001` | completed | SYS-APP; SYS-GAME-UI | `game/` 可玩雏形；编译 预览；浏览器验收；Human视觉验收 | `7c5a738` | `DEC-RENDER-PLAYABLE-001` |
| `WI-API-COLLABORATION-REVIEW-001` | completed | not-applicable | `AGENTS.md`；`03-执行层/README.md`；API协作审查边界和状态分层 | `6da5755` | `DEC-API-COLLABORATION-001` |
| `WI-DOC-COLLABORATION-ADOPT-001` | completed | not-applicable | `AGENTS.md`；`03-执行层/README.md`；协作决策和状态同步 | `9bd475b` | `DEC-GIT-PR-WORKFLOW-001` |
| `WI-BROWSER-STARTUP-001` | completed | SYS-APP; SYS-GAME-UI | `game/phaser.d.ts`；`scripts/browser-smoke.mjs`；真实页面资源与Tilemap 验收 | `7c5a738` | `DEC-BROWSER-STARTUP-001` |
| `WI-RESOURCE-IMPLEMENT-001` | completed | SYS-ASSET; SYS-APP | `scripts/prepare-runtime-assets.mjs`；`scripts/check-runtime-assets.mjs`；`package.json`；干净检出验证 | `6815a6f` | `DEC-RESOURCE-IMPLEMENT-001` |
| `WI-RESOURCE-REPRO-001` | completed | not-applicable | 资源必需文件清单、外部 tileset 对比、方案 A/B/C 调查记录（工作日志） | `f8a9014` | `DEC-RESOURCE-REPRO-001` |
| `WI-DOC-CONTROL-REPAIR-001` | completed | not-applicable | [项目总控台](计划表.md)；[进度总览](01-理解层/00-进度总览.md)；接口、系统卡、总账和状态口径同步 | `c40f6df` | `DEC-DOC-CONTROL-REPAIR-001` |
| `WI-SYS-CHUNK-CORE-001` | completed | SYS-CHUNK | [当前SYS-CHUNK卡](03-执行层/01-地图线/04-地图分块.md)；`src/chunk/`；`tests/chunk/`；历史授权包在`migration-history/doc-v0.1/` | `f04568f953821e8cc56c33a694171ddab759051f` | `DEC-SYS-CHUNK-CORE-001`；`DEC-WORK-RELAY-002` |
| `WI-SYS-WORLD-LAYER-DESIGN-001` | completed | SYS-WORLD; SYS-LAYER | [SYS-WORLD卡](03-执行层/01-地图线/02-世界与地图.md)；[SYS-LAYER卡](03-执行层/01-地图线/03-图层与遮挡.md)；历史调查/验证在`migration-history/doc-v0.1/` | `8c7fff7525e8dd77c6367b662f65fec12175d33f` | `DEC-SYS-WORLD-LAYER-DESIGN-001` |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-001` | completed | SYS-LAYER | SYS-LAYER 运行时证据、Q-LAYER-002 保留、24 层策略和有界 写入/清除 设计 | `c82aa4a` | `DEC-SYS-LAYER-RUNTIME-SEMANTICS-DESIGN-001` |
| `WI-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` | completed | SYS-LAYER; SYS-WORLD; SYS-CHUNK | 视觉/屋顶/标记/脚印 有界运行时、marker 回滚诊断、粒子3层 未消费保留、数据清洗 边界和浏览器 验收 | `10c7d88` | `DEC-SYS-LAYER-RUNTIME-SEMANTICS-IMPLEMENT-001` |
| `WI-SYS-MAP-LIFECYCLE-CLOSURE-001` | completed | SYS-WORLD; SYS-CHUNK | 取消信号 请求取消、过期 数据变更 补偿、协调器/调度器 异步销毁、碰撞器/Tilemap 清理、生命周期 验收 与固定数量上界 | `d61faa1` | `DEC-SYS-MAP-LIFECYCLE-CLOSURE-001` |
| `WI-SYS-INPUT-TOUCH-001` | completed | SYS-INPUT; SYS-MOVE | 原生 Phaser pointer 摇杆、桌面隐藏、移动端显示、单指 所有权、最小力度 死区、键盘优先级/释放恢复、适配器测试和移动输入 验收 | `66a20f8` | `DEC-SYS-INPUT-TOUCH-001` |
| `WI-DOC-PORTAL-MIGRATION-001` | completed | not-applicable | 五层人话文档与三份人话入口；[根README](../README.md)；历史任务卡在`migration-history/doc-v0.1/` | `cda98173a24df1b605019d3b7126ea092dd4b6cf` | `DEC-DOC-PORTAL-MIGRATION-001` |
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

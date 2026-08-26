---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
phase: p5.4-05e-factory-smoke
system: SYS-FX
type: bounded-verification-and-repair
status: cross-system-human-visual-rejected-awaiting-audit
decision: DEC-P5.4-05E-S1-STOP-AI-001
candidate-base: ea8751260984fa6ef5e4589c2fbf196a6b28aa8c
updated: 2026-08-25
---

# 05-E 公开烟雾实施包

## Human范围修正

Human指出显眼烟雾在Stop AI道路两边。公开Bundle复核已确认：`(808,539.2)`只是多个无业务名white smokeGenerators之一；另有Stop AI周边红/橙烟雾罐分层emitters和trajectory fog owner。此前“唯一factory smoke”范围与命名不完整，单点candidate `8586196`状态为automated-verified / human-visual-rejected-scope-incomplete。全量审计后S1已实现并自动验证，当前等待Stop AI Human视觉Gate。

## 全量审计结果与S1修正方案Gate

[公开烟雾全量审计](WI-SYS-FX-FACTORY-SMOKE-001-05E公开烟雾审计.md)已完成并由脚本复核：10个white configs/14 emitters、Stop AI 3处/9层彩烟、9个fog regions/60 cells。当前代码仍只覆盖1/10 white config；S1另已覆盖Stop AI三处/九层彩烟与`orange_smoke`13-cell fog，均保持独立owner。

推荐`S1 Stop AI彩烟+orange_smoke → S2全量white generators → S3其余8 fog regions → S4联合回归`。S1中彩烟与fog保持独立owner，但共同做Stop AI场景视觉Gate；每批独立自动与Human验收，不再完成全量后第一次看。

Human已接受上述顺序，并只授权[S1 Stop AI实施包](WI-SYS-FX-FACTORY-SMOKE-001-05E-S1-StopAI实施包.md)：显式修复彩烟离屏重建后的wind loop续接；cars未实现时保留可注入清雾接口和测试，不伪造production车辆清雾已集成。S2–S4仍未授权。

## 历史单点目标（已撤回）

在不恢复旧入口烟雾预览的前提下，沿正常游戏短路径验证并必要时修正唯一factory smoke owner：可见烟雾上升/放大/淡出，离开视口停发，返回复用同一emitter/generation，scene shutdown清理完整。

## 当前事实与合同冲突

- **FACT**：公开资源`smoke-white.webp`；锚点`(808,539.2)`；width `7→32`、pathHeight `35`、quantity `2`、frequency `80`、scale `1.6→4`、alpha `.1→0`且max `.25`、lifespan `2000`、core depth `500`；不响应cars/player。
- **FACT**：公开owner约50ms更新路径；锚点在扩展视口外时停发/隐藏，返回时恢复，不按chunk销毁。
- **DECISION**：当前factory roof depth为3200/3300，presentation smoke depth使用3400；core FACT仍为500。
- **已接受冲突处理**：R4曾通过入口中间镜头让smoke可见约2.10秒；C3后来由Human接受“Play当前视角直接落玩家”，取消该中间镜头。05-E不得恢复旧入口路径，过期的`browser-side-smoke`入口2秒断言必须转为正常短路径验收。
- **UNKNOWN**：公开Bundle没有证明统一scene teardown；重构runtime必须显式清理emitter/path/listener并保留为DECISION。

## 历史单点允许范围（已撤回）

优先只修改：

- `scripts/browser-side-smoke.mjs`中的过期入口烟雾断言；
- 新增独立factory smoke production probe及必要`package.json`命令；
- `tests/fx/factory-smoke.test.ts`。

只有production重放证明runtime不符合下述expected时，才允许有界修改：

- `src/fx/factory-smoke.ts`；
- `game/PhaserFactorySmokeRuntime.ts`；
- 必要`game/CampusScene.ts`接线。

## 禁止

- 不修改任何NPC代码或把B1 candidate并入本工作项；
- 不恢复入口烟雾中间镜头，不改玩家、地图、相机、火车、roof、30FPS；
- 不改`sample/`、远端或Windows仓库；
- 不实现S2/S3未授权owner、天气、raw tile或通用粒子系统；cars production输入仍未接线。S1按已接受合同实现Fog player clearing与cars可注入接口。

## 历史单点执行步骤

1. 修正`browser-side-smoke`：保留train/sprayer合同，但删除已被C3替代的“入口连续可见2秒”要求；仍断言smoke owner存在、generation稳定且无异常。
2. 新建无production debug hook的05-E探针，使用正常键盘路径从玩家区域前往factory smoke；不得teleport或恢复入口镜头。
3. 在锚点附近连续采样至少2秒，断言emitting、alive particles和可见bounds；记录截图/收据。
4. 正常移出视口，断言paused/hidden；返回后断言emitting恢复、generation仍为1且只有一个emitter。
5. 停止scene并验证emitter/path/listener清理；复用现有unit/lifecycle门禁补足不可直接观察项。
6. 只有上述真实行为失败才修runtime；随后执行typecheck、FX专项、全量测试、build、05-E production、side smoke、performance和complete production。

## 历史单点验收

- **配置**：公开锚点与粒子参数不漂移，presentation depth偏离明确标DECISION。
- **可见**：正常短路径到达factory后，Human能连续观察烟雾上升、放大、淡出，不靠teleport或入口航拍。
- **生命周期**：离屏停发/隐藏，返回复用generation 1且不重复emitter；shutdown对象与listener为0。
- **安全**：无console exception、failed request或bad response；性能不回归。
- **Human**：自动探针和截图不代替Human视觉验收。

## S1自动验证收据（待Human视觉）

- candidate：代码隔离分支提交 `e07d2c7`；仅修改S1允许路径，未push。
- 实现：Stop AI三处/九层彩烟、3 graphics、`orange_smoke`13 cells；独立owner接入`CampusScene`；彩烟离屏重建后显式重新绑定wind；Fog cars接口快照保持`carsInputIntegrated=false`。
- PASS：`npm run typecheck`；S1与factory FX专项10项；全量`npm test`（68 files / 363 tests）；`npm run build`；`node --check scripts/browser-stop-ai-smoke-production.mjs`；performance smoke（median16.7ms、无>34ms帧）。
- PASS：无production debug/test hook的真实键盘探针 `browser:stop-ai-smoke-production`。正常路径到Stop AI时9层/13-cell active；离场后彩烟9层destroy、Fog13 emitter保留且inactive；返回后9层generation=2并观察到wind；shutdown后两类owner emitter/graphics为0；console、exception、failed request、bad response均为空。
- 独立verifier结果：`UNVERIFIED`（所有客观检查PASS，未代替Human视觉）。
- 证据：`.pi/worktrees/visible-product-integration/.pi/audit-evidence/05e-s1/receipt.json` SHA-256 `b36e41537972e9e1331f65ea909f785d1013a912f01de6e5c883f8bd8577265e`；performance `performance.json` SHA-256 `8a188bc019f283b1bcd9889d0a6e0481622dbb22e028813ce8e439267c9a32a3`；截图见同目录`screenshots/`。
- Human Gate（视觉拒绝后修复方案已通过，但又发现跨系统问题，2026-08-25）：编译production截图中的红烟运动“卡卡的、不丝滑”。quantity4→2的修复candidate `c4b2d6a`已自动/production验证通过，但Human新增烟雾清除突兀、直升机/警车缺贴图、Stop AI NPC闪烁、NPC消失/冒出四类问题；当前返回统一systemic差异表和审计，不关闭05-E。

## 历史单点自动验证收据

- 结论：现有`FactorySmokeRuntime`和`PhaserFactorySmokeRuntime`已符合05-E合同，无需修改产品runtime。
- candidate：`8586196`只新增`scripts/browser-factory-smoke-production.mjs`、`browser:factory-smoke-production`命令，并移除已被C3替代的side smoke入口2秒断言。
- 正常production无公开debug/test hooks；等待火车离场后，真人键盘走`east→south→west→south`到factory，连续27个100ms样本均证明emitting、alive particle bounds进屏、generation=1。
- 离开到约`(1288.67,406.67)`后state=`paused`、alive=0、emitter保留、generation=1；键盘返回后恢复emitting；正式shutdown `smokeEmitterActive=false`。
- PASS：typecheck、FX 4项专项、357项全量测试、build、05-E production、performance smoke、complete production（首次Memo6路径距阈值1.33px停止，原命令重放PASS）。
- 证据：`.pi/worktrees/visible-product-integration/.pi/audit-evidence/05e/receipt.json`，SHA-256 `edb69fbe2ffc66365b2503d62efb095a646cf07d753df318559acdce3b555eab`；截图hash见同目录`SHA256SUMS`。
- 已知非05-E失败：`browser-side-smoke`在火车collider计数已为0后仍于地图坐标`(600,348)`受阻，重复两次一致；不在烟雾任务中删除火车断言或修改路线，留待05-F验证门禁整理。
- 结论限制：上述收据只证明单个`(808,539.2)`白烟owner技术行为，不能代表完整05-E。
- 尚未完成：公开烟雾家族审计、Human计划Gate、全量实现与视觉验收。

## 依据

- `03-执行层/05-旁支/03-动效与粒子.md`
- `task-todos/WI-VISIBLE-SIDE-WAVE-001-P1-调查报告.md:124-147`
- `task-todos/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05A-实施包.md`
- `src/fx/factory-smoke.ts`
- `game/PhaserFactorySmokeRuntime.ts`
- `tests/fx/factory-smoke.test.ts`

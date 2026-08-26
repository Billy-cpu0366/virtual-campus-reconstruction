---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
phase: p5.4-05e-factory-smoke
system: SYS-FX
type: bounded-verification-and-repair
status: implementation-authorized
decision: DEC-P5.4-05E-FACTORY-SMOKE-001
candidate-base: ea8751260984fa6ef5e4589c2fbf196a6b28aa8c
updated: 2026-08-25
---

# 05-E 工厂烟雾实施包

## 目标

在不恢复旧入口烟雾预览的前提下，沿正常游戏短路径验证并必要时修正唯一factory smoke owner：可见烟雾上升/放大/淡出，离开视口停发，返回复用同一emitter/generation，scene shutdown清理完整。

## 当前事实与合同冲突

- **FACT**：公开资源`smoke-white.webp`；锚点`(808,539.2)`；width `7→32`、pathHeight `35`、quantity `2`、frequency `80`、scale `1.6→4`、alpha `.1→0`且max `.25`、lifespan `2000`、core depth `500`；不响应cars/player。
- **FACT**：公开owner约50ms更新路径；锚点在扩展视口外时停发/隐藏，返回时恢复，不按chunk销毁。
- **DECISION**：当前factory roof depth为3200/3300，presentation smoke depth使用3400；core FACT仍为500。
- **已接受冲突处理**：R4曾通过入口中间镜头让smoke可见约2.10秒；C3后来由Human接受“Play当前视角直接落玩家”，取消该中间镜头。05-E不得恢复旧入口路径，过期的`browser-side-smoke`入口2秒断言必须转为正常短路径验收。
- **UNKNOWN**：公开Bundle没有证明统一scene teardown；重构runtime必须显式清理emitter/path/listener并保留为DECISION。

## 允许范围

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
- 不实现天气、raw tile、cars reaction、player reaction或通用粒子系统。

## 执行步骤

1. 修正`browser-side-smoke`：保留train/sprayer合同，但删除已被C3替代的“入口连续可见2秒”要求；仍断言smoke owner存在、generation稳定且无异常。
2. 新建无production debug hook的05-E探针，使用正常键盘路径从玩家区域前往factory smoke；不得teleport或恢复入口镜头。
3. 在锚点附近连续采样至少2秒，断言emitting、alive particles和可见bounds；记录截图/收据。
4. 正常移出视口，断言paused/hidden；返回后断言emitting恢复、generation仍为1且只有一个emitter。
5. 停止scene并验证emitter/path/listener清理；复用现有unit/lifecycle门禁补足不可直接观察项。
6. 只有上述真实行为失败才修runtime；随后执行typecheck、FX专项、全量测试、build、05-E production、side smoke、performance和complete production。

## 验收

- **配置**：公开锚点与粒子参数不漂移，presentation depth偏离明确标DECISION。
- **可见**：正常短路径到达factory后，Human能连续观察烟雾上升、放大、淡出，不靠teleport或入口航拍。
- **生命周期**：离屏停发/隐藏，返回复用generation 1且不重复emitter；shutdown对象与listener为0。
- **安全**：无console exception、failed request或bad response；性能不回归。
- **Human**：自动探针和截图不代替Human视觉验收。

## 依据

- `03-执行层/05-旁支/03-动效与粒子.md`
- `task-todos/WI-VISIBLE-SIDE-WAVE-001-P1-调查报告.md:124-147`
- `task-todos/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05A-实施包.md`
- `src/fx/factory-smoke.ts`
- `game/PhaserFactorySmokeRuntime.ts`
- `tests/fx/factory-smoke.test.ts`

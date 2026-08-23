---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-R4
status: bounded-verified
implementation-commit: da68d0887995b9cfff9749dcf7ad179702afcb95
implementation-tree: bdd9d834c354b816c23c4047761258570c5bf22a
base-commit: 5d0d96d2acca5fdf6596e01ef4a5399ea91e2017
verified-date: 2026-08-23
---

# P5.1 R4 train / sprayer / smoke 可见编排收据

## 1. 结论

R4已在integration分支完成并有界验证：

1. train的公开路线、scale、5秒到站/3秒停留/9秒离场、碰撞宽度全部不变；只把呈现depth改为520，使玩家和四个sprayer在train前方可辨识。
2. 3秒入口相机总时长不变；其中先预览factory smoke，再回到玩家。smoke锚点、数量、频率、lifespan和path不变；adapter呈现depth=3400，解决被3200/3300 factory roof盖住的问题。
3. smoke实际粒子bounds连续进屏约2.10秒；train连续进屏约10.62秒。
4. train离场后提示切换到`Trackside crew · east 20, south 7, west 8`；真人键盘路线触发sprayer后，再切换到`Factory smoke · west 30, south 8`。没有teleport、auto-open或auto-trigger。
5. 桌面1920×1080与移动375×667的正常production截图均来自无test-hooks构建；smoke、train+player+sprayers和train离场后的环境提示均可见。

自动和截图证据只证明R4有界合同；最终仍由R1–R7后的Human整体视觉Gate签字。

## 2. FACT与DECISION边界

### 未改变的FACT

- train `(2480,310) → (480,310)`、scale公式、5s/3s/9s与碰撞带；
- 四个sprayer锚点、触发窗、300ms级联、速度140和逃跑路线；
- smoke `(808,539.2)`、quantity=2、frequency=80、lifespan=2000、pathHeight=35；
- production继续禁用约111秒六点相机序列。

### R4主动DECISION

- train presentation depth=`520`；
- sprayer presentation depth=`500 + (y+24)*0.1`；
- smoke presentation depth=`3400`，只补偿当前重构roof层级；core FACT仍保留depth=500；
- 3秒入口拆为`200ms`到smoke、`1750ms`停留、`1050ms`回玩家；
- train complete与sprayer trigger发布非强制环境路线提示。

## 3. 量化证据

- train holding：约`5025ms`；complete：约`17060ms`；
- train真实screen intersection：约`10615ms`；
- smoke真实alive-particle bounds intersection：约`2101ms`；
- holding depth：train `520`、player `532.8`、sprayers约`542.4`；
- sprayer真人路径：抵达约`(1280,416)`后触发，四人`fleeAt`保持300ms级联；
- lifecycle：train collider/shape/sprite、sprayer sprites、smoke emitter最终均为0；
- production性能：入口和4秒移动无LoAF/long task，最大input handler延迟约`5.3ms`。

## 4. 验证

- `npm test`：54 files / 304 tests PASS；
- typecheck、runtime assets、test-hooks/production两种build PASS；
- entry、chunk、camera、collision、lifecycle、mobile-input、content、visual-smoothing、side PASS；
- production smoke、runtime-safety、performance PASS；
- desktop/mobile production visible-entry PASS，且production hooks均`undefined`；
- 独立verifier确认`src/route|npc|fx` FACT文件无diff、类型与目标单测PASS；其side重放发生在`dist`被production覆盖后，标为UNVERIFIED，Main此前已在独立test-hooks build实际PASS。

证据目录：[`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R4/`](evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R4/)

## 5. 状态

- **accepted**：方案A及R4边界已由`DEC-P5.1-SYSTEMIC-REPAIR-001`授权。
- **persisted**：实现、自动门禁、双视口截图和本收据已落盘。
- **verified**：R4在WSL本机范围内bounded verified。
- **尚未解决**：factory roof真实进入/离开tween、confirmed footsteps、HUD/导航/视觉密度与最终Human整体视觉；父流程继续R5。

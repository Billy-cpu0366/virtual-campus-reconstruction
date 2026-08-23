---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-R7-C1-C2
status: auto-verified-awaiting-repeat-human-acceptance
implementation-commit: 54c0e2922ce3fc6b3ced78118db6b2b867b6eff7
implementation-tree: 3b05f56ed58c0e0861eff3cbff6787ce93aa0290
base-commit: 1e24fd1e9e4cfa7e06ed8db0243b4f214364569c
verified-date: 2026-08-23
---

# P5.1 R7 Human失败补救 C1+C2 收据

## 1. 结论

Human接受的C1+C2已实现并完成本机完整回归：

1. **C1入口cleanup预算**：异步Tilemap清理每4层显式让出一个rAF；碰撞层仍先移除/等待collider、隐藏，再销毁，World原子收敛和shutdown边界不变。
2. **C2火车世界深度**：train depth由`playerDepth(TRAIN_Y)`得`533.4`，形成出生玩家`532.8 < train 533.4 < sprayer 542.4`；路线、scale、5s进场+3s停留+9s离场和碰撞带不变。
3. **垃圾堆不删碰撞**：`OUR ART / OUR / OUR RULES`空白地面真实键盘可走；招牌和垃圾堆按最终位置证明不可穿越，保留与原站一致的walls数据。
4. 1920×1080慢网和375×667正常网络均完成无项目hooks的完整R7 production session；3/5/8秒玩家在车厢后，不再画在车身表面；17秒火车离场后玩家恢复可见，sprayer保持前景。

自动与Main截图检查不能代替Human实际设备对开头流畅度和临时遮挡观感的签字。

## 2. C1量化

- READY：25 rendered chunks / 525 Tilemap layers / 0 async clears；
- cleanup完成：15 chunks / 315 layers；
- 每次固定清理210层，`CLEAR_LAYERS_PER_FRAME=4`，52次rAF yield，余数2；
- 3秒camera与约5秒PLAYING/control边界保持；最终visual-smoothing中cleanup在PLAYING后831ms收敛；
- production入口P95约16.8ms，>34ms帧、LoAF、long task均0。

## 3. C2与碰撞量化

- depth：player `532.8`、train `533.4`、四个sprayer均`542.4`；
- `OUR ART`空白路面500ms左移约74.7px，`blockedSamples=0`；
- 招牌从`y=1180`向上最终停在约`y=1124`；垃圾堆从约`y=1315.3`最终停在约`y=1296.7`，均未穿过视觉实体；
- 当前/原站walls数据SHA-256继续同为`a1fb8b28f7108f8b9460339d552d59e6b43ac3c453f0656575a2f73ebb2788b1`。

## 4. 完整验证

- `npm test`：56 files / 314 tests PASS；typecheck、runtime assets、双build、脚本语法和diff PASS；
- production：双视口完整主路径、smoke、runtime-safety、visible-entry、map、performance PASS；最终恢复production后再次runtime-safety PASS；
- test-hooks：entry、garbage-collision、map、lifecycle、side、chunk、layer、camera、collision、mobile-input、content、visual-smoothing、app-retry、roof-footsteps PASS；
- 独立verifier首次指出entry缺显式初始25/525、sign仍依赖瞬时blocked；两项门禁修正并重跑后复核PASS；
- 未修改`sample/`、`src/route/train.ts`、`src/move/`、30 FPS、111秒入口或particles3/69360。

证据目录：[`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R7-C1-C2/`](evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R7-C1-C2/)

## 5. 状态

- **accepted**：`DEC-P5.1-R7-REPAIR-001`已授权C1+C2边界。
- **persisted**：实现提交、双视口截图/收据、性能、定点碰撞和本收据已落盘。
- **verified**：本机自动、production主路径、test-hooks辅助和独立复核PASS。
- **awaiting Human**：Human仍需实际操作判断开头是否还卡顿，以及3–8秒玩家被train正确遮住的观感是否可接受；未通过前工作项不关闭。
- **尚未解决**：Human设备blocking trace仍未取得；particles3/69360及既有UNKNOWN不补猜。

---
work-item: WI-VISIBLE-SIDE-WAVE-001
phase: P3-parallel-implementation
status: authorized-after-p2-design-clean-baseline
authorization: DEC-VISIBLE-WAVE-P2-001
branch: feature/05-side-visible-wave
parent-report: 035017aee3f5166e952f4a44f2a95970e3d2f4ee
---

# 05旁支：P2批准的P3实现包

## 目标

同时交付三个真实可见对象：四个`npc-sprayer`、`crowdTrain`火车路线、factory smoke。任一no-code或静态tile都不能替代。

## 冻结行为

- Sprayer：公开四锚点、喷洒等待、玩家横向≤2 tile/纵向0..2 tile触发、300ms组间逃跑、公开路线、完成/取消销毁。
- Train：`(2480,310)→(480,310)` 5000ms Cubic.easeOut，约3000ms后离场9000ms Quad.easeIn；碰撞带随动，重复/中断/shutdown全清。
- Smoke：公开锚点约`(808,539.2)`和报告参数；视口内发射、外部停发、返回复用、shutdown清emitter/path/timer/listener。
- 三者各自owner；不创建Entity基类、registry或通用旁支框架。

## 允许文件

- `src/npc/**`、`src/route/**`、`src/fx/**`
- 新增专属`game/PhaserSprayer*.ts`、`game/PhaserTrain*.ts`、`game/PhaserFactorySmoke*.ts`，不得修改现有Main文件
- `tests/npc/**`、`tests/route/**`、`tests/fx/**`
- 已批准公开精灵资源的独占目录
- 本任务执行报告

禁止修改`CampusScene/main/index/package`、地图核心、sample、API/权威文档和通用Entity。

## 检查与交付

fake clock覆盖5s/3s/9s与300ms级联；测试重复创建、取消、资源失败、视口进出和teardown。再跑typecheck、全测试、build和CRLF-aware范围检查。只提交允许文件，返回commit/tree/parent/clean，停在ready-for-integration，不push。

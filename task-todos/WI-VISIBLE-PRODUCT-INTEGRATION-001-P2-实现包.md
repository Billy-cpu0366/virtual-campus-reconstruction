---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
phase: P3-main-implementation-and-integration
status: paused-p2.1-shared-contract-first
p2-design-commit: c21f7ce8ddeafc071aa77988d69fe2d1b538637e
authorization: DEC-VISIBLE-WAVE-P2-001
branch: integration/visible-product-wave
parent-report: b5708b42a08022226da0e9420e278a6f69481104
---

# Main产品入口：P2批准的P3实现与集成包

## 目标

Main并行实现共享入口，随后按顺序接收04、03、05成果，交付Human可直接验收的新产品纵切片。

## 冻结入口

- Scene ready前显示真实Loading；ready后显示Play。
- Play只触发一次：创建/显示玩家并锁控制；相机3000ms Power2落到出生点；火车同时进场，5000ms完成后开放控制。
- 桌面逻辑世界视口固定480×270并缩放到可用屏幕；终态玩家居中、zoom1、硬跟随。移动端保持同一逻辑构图并验证375×667 UI可用。
- playable后显示非阻塞Memo 6方向引导；真人移动触发真实英文内容。
- factory smoke在入口镜头/短路径可见；sprayer在玩家短移后触发；火车完整离场并清理。
- production绝不调用六点111秒序列。

## P2.1优先提交

Main当前clean。先按`WI-VISIBLE-CONTENT-BRIDGE-001`只改shared content contract、CampusContentResolver和对应tests，形成可独立cherry-pick且全绿的提交；不得混入本包入口实现。同步03/04后再恢复本包。

## Main独占文件

- `game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`
- 共享Phaser adapter/contract、资源preload接线
- 共享browser Smoke和integration报告

不得在分支成果未交付时复制第二套内容/App/NPC/Route/FX私有逻辑；不得修改sample。

## 合并与门禁

1. 先完成Main入口有界实现，不自行接收未通过分支。
2. 三分支返回clean收据后按04独立件→03内容→05旁支串行接收。
3. 跑typecheck、全测试、production/test-hooks build、runtime safety及既有全部browser gates；新增Loading/Retry、entry、Memo6 normal-path和side-visible Smoke。
4. 自动检查通过后先停在Human视觉Gate，提供同基线桌面1920×1080和移动375×667短录像/截图。
5. Human必须肉眼看到Loading、3秒镜头、5秒火车、480×270构图、sprayer、smoke和Memo6内容；未通过不得关闭文档。
6. 不push、PR、Windows同步。

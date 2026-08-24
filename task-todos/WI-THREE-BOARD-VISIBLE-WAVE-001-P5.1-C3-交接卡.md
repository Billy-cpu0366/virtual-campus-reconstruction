---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
handoff: p5.1-c3-real-product-repair
status: active
source-of-truth: task_plan.md
updated: 2026-08-24
---

# P5.1 C3 真实产品修复交接卡

## 目标

只解决Human当前优先的三项：

1. Play后约两秒停顿与相机回到主角的跳变感；
2. Loading/开始游戏界面与原站差异；
3. 进入右侧party建筑后屋顶未淡隐，不能看到内部。

NPC、喷泉粒子、缺失贴图和其他细节继续deferred。

## 当前状态

- 路线：`systemic-failure / systemic-flow`；
- 阶段：`p5.1-c3-preimplementation-evidence`；
- Gate：`p5.1-c3-evidence-completeness`，`audit-in-progress`；
- 当前不写产品代码；先完成三项可观察证据和单一实施包。

## 连续执行规则

在本轮预算内，本地仍可运行浏览器、读取代码、采样、复现或检查时继续调查。
子任务停止、单项测试失败或`NOT OBSERVABLE`不停止主任务；转下一条本地路径。
仅在需要Human产品/视觉决定、缺少不可本地或公开获得的事实、超出授权范围，或达到本轮预算时停止。

## 新窗口第一步

1. 完整读取根`AGENTS.md`、`03-执行层/README.md`、`03-执行层/00-总账.md`、根`决策记录.md`、`task_plan.md`；
2. 读取当前P5任务卡及C3相关证据/实施包；
3. 在不改代码前，连续完成：入口真实trace、原站/复刻同视口Loading对照、party合法进入/离开路径与屋顶图层调查；
4. 将事实、未知和可修根因写入同一差异表，再形成一个有界实施包交Human Gate。

## 禁止

- 不把自动测试、hook、对象计数、单张截图或WSL指标当作体验已修好的证明；
- 不接入111秒相机序列；不改30 FPS物理FACT；
- 不零散补丁、不修改冻结candidate、不碰deferred内容；
- 不push、PR、merge或改main。

## 完成证据

修前与修后均走同一正常路径，保留连续记录或逐帧trace；Loading使用原站/复刻同视口对照；party使用合法步行进入和离开记录。最终视觉是否通过仍由Human判断。

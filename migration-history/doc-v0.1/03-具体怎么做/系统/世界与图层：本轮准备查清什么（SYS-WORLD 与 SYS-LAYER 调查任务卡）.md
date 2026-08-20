---
title: 世界与图层：本轮准备查清什么（SYS-WORLD 与 SYS-LAYER 调查任务卡）
type: work-item-task-card
status: completed
work-item-id: WI-SYS-WORLD-LAYER-DESIGN-001
work-item-level: level-1
work-item-type: investigation
node-refs: SYS-WORLD; SYS-LAYER
main-definition: false
decision-refs:
  - DEC-SYS-WORLD-LAYER-INVESTIGATION-001
  - DEC-SYS-WORLD-LAYER-DESIGN-001
result-commit: 8c7fff7525e8dd77c6367b662f65fec12175d33f
updated: 2026-08-11
---

# 世界与图层：本轮准备查清什么（SYS-WORLD 与 SYS-LAYER 调查任务卡）

> **一句话：这一轮只查清25个分块怎样组成世界、24个图层分别怎样使用，以及三个地图系统的职责边界；不写正式代码。**

## 1. 为什么现在做

既定P0调查顺序在地图分块之后安排世界装配与图层边界。`SYS-CHUNK CORE`已经实现坐标、索引和目标集合，但Phaser写入、图层语义和世界生命周期仍未处理。世界与图层边界又是后续`SYS-ASSET`失败路径和Phaser集成的共同前置。

Human已通过`DEC-SYS-WORLD-LAYER-INVESTIGATION-001`选择本工作项。它是level-1调查工作项，不是代码实施授权。

## 2. 本轮目标

1. 建立24个chunk图层的完整清单、顺序、数据特征和证据位置；
2. 查清原站怎样建立世界、写入和清除chunk数据，以及已能证明的图层处理；
3. 区分`FACT / INFERRED / DECISION / UNKNOWN`；
4. 划清`SYS-CHUNK`、`SYS-WORLD`、`SYS-LAYER`和`SYS-ASSET`的职责；
5. 说明创建、部分失败、卸载和销毁边界；
6. 形成可交Human审查的调查记录、设计候选和验证计划；
7. 尽可能关闭`Q-LAYER-001`，证据不足时明确残余未知和最小补证要求。

## 3. 纳入范围

- `master.json`、25个chunk、`final_map.json`中的世界与图层数据；
- 公开Bundle中可重复定位的世界创建、chunk写入/清除、图层创建、depth、遮挡和碰撞调用；
- `layer1`至`layer10`、`walls`、`cars`、roof、bridge、particles和`footsteps`等24层的已证实语义；
- 原站公开证据与旧Phaser只读基线之间的差距；
- 世界、图层、分块和资源系统的状态所有权、输入输出与生命周期边界；
- 与本轮结论相符的文档和验证计划回写。

## 4. 不纳入范围

- 不修改正式`src/`；
- 不修改、清理、提交或合并旧Phaser及其任何dirty Worktree；
- 不接入Phaser、Vite、网络、缓存或渲染实现；
- 不设计通用资源加载框架；
- 不量化玩家移动、完整相机行为、NPC或车辆路线；
- 不刷新或扩大`sample/`采集；现有证据不足时只提出最小补证申请；
- 不提前抽取可复用模块。

## 5. 允许使用的证据

- `sample/original-public-build/mirror/assets/maps/`中的已冻结地图文件；
- 已镜像公开Bundle及现有`sample/analysis/`记录；
- `doc/v0.1`中已确认的SYS-CHUNK事实、系统依赖、节点和证据差距；
- 旧Phaser权威基线的只读实现盘点和行为基线；未经单独授权不扩大旧资料追溯。

## 6. 执行步骤

1. 用确定性脚本或`mechanical-worker`提取24层结构清单；
2. 用`recon`对大型Bundle调用链和复杂外部证据做有界只读调查；
3. 由Main抽查关键证据，形成世界装配事实、图层语义和责任边界；
4. 建立`main-definition: false`的调查记录和必要设计候选，不提前改变节点工程状态；
5. 更新证据与差距、未知问题和验证计划；
6. 运行文档治理检查，并在里程碑结束时做一次客观独立复核；
7. 停在Human设计审查，不自动进入代码实现。

当前已建立的工作产物：

- [[世界与地图：从原站查到了什么（SYS-WORLD 调查记录）]]；
- [[图层与遮挡：从原站查到了什么（SYS-LAYER 调查记录）]]；
- [[世界与地图：游戏世界怎样建立和装卸（SYS-WORLD）#SYS-WORLD]]；
- [[图层与遮挡：24层怎样显示和清理（SYS-LAYER）#SYS-LAYER]]；
- [[../../04-怎么验证与还差什么/世界与地图：怎样验证做对了（SYS-WORLD 验证计划）]]；
- [[../../04-怎么验证与还差什么/图层与遮挡：怎样验证做对了（SYS-LAYER 验证计划）]]。

## 7. 退出标准

- 24个图层逐项有名称、顺序、证据位置和`FACT / INFERRED / UNKNOWN`状态，无遗漏或重复；
- 世界创建、chunk写入、清除和销毁链路达到可审查程度；
- `SYS-CHUNK / SYS-WORLD / SYS-LAYER / SYS-ASSET`责任表无明显重叠或空洞；
- 图层渲染、遮挡和碰撞顺序已回答，或残余未知及最小补证方法明确；
- `Q-LAYER-001`关闭或保留理由与阻塞对象同步；
- 调查记录、设计候选、证据与差距和验证计划互相可追溯；
- `SYS-WORLD`和`SYS-LAYER`在Human接受正式设计前继续保持`undesign`；
- 正式`src/`、`sample/`冻结证据和旧Phaser零修改；
- `sync`、`pilot`和`git diff --check`通过，工作结果进入clean Git基线。

## 8. Human停点

退出标准满足后交Human审查世界与图层设计。只有Human另行接受正式设计，节点才可以进入`designed`；任何正式代码、Phaser集成或资源加载实现仍需独立level-2 Human Gate。

## 9. 复用观察

本工作项是第一次研究世界装配与图层边界，当前没有第二个独立真实场景。保持“未发现”，不得因未来校园设想提前抽象。

## 10. Human审查结果

Human已通过`DEC-SYS-WORLD-LAYER-DESIGN-001`接受两份正式设计，并通过`DEC-SYS-LAYER-VISUAL-EVIDENCE-001`预授权下一独立补证工作项。当前只完成验证与关闭；不在本工作项内执行新采集或正式代码。

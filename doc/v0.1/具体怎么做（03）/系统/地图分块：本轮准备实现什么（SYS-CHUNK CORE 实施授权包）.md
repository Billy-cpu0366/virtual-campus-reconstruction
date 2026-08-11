---
title: 地图分块：本轮准备实现什么（SYS-CHUNK CORE 实施授权包）
type: implementation-authorization-package
status: approved
decision-status: accepted
implementation-authorization: authorized
version: v0.1
work-item-id: WI-SYS-CHUNK-CORE-001
work-item-level: level-2
node-refs: SYS-CHUNK
design-ref: doc/v0.1/具体怎么做（03）/系统/地图分块：玩家移动时怎样加载地图（SYS-CHUNK）.md#SYS-CHUNK
verification-ref: doc/v0.1/怎么验证与还差什么（04）/地图分块：怎样验证做对了（SYS-CHUNK 验证计划）.md
main-definition: false
updated: 2026-08-11
---

# 地图分块：本轮准备实现什么（SYS-CHUNK CORE 实施授权包）

> **一句话：Human 已批准并完成最小正式工程基础和地图分块确定性核心；本包保留为该工作项的实施与审计边界。**

> [!important]
> 当前授权为 `approved / accepted / authorized`，决定引用为 `DEC-SYS-CHUNK-CORE-001`。授权只覆盖本文第3节和指定路径；Phaser、Vite、网络、缓存、渲染和旧项目修改继续未授权。

## 1. 这轮为什么现在做

`SYS-CHUNK` 的详细设计和验证计划已经通过 Human 审查，但正式工程仍只有空入口。第一轮实现需要同时证明两件事：最小工程可以运行测试；证据最充分的分块纯逻辑可以按已接受设计得到确定结果。

本轮不追求完整地图显示，而是先把可独立验证、失败后容易定位的核心建立起来。

## 2. 提议的工作项

| 字段 | 值 |
|---|---|
| 工作项 | `WI-SYS-CHUNK-CORE-001` |
| 类型与级别 | `implementation / level-2` |
| 涉及节点 | `SYS-CHUNK` |
| 当前状态 | `completed`；结果提交、验证和关闭索引均可定位 |
| 正式主定义 | [[地图分块：玩家移动时怎样加载地图（SYS-CHUNK）#SYS-CHUNK]] |
| 退出标准 | [[../../怎么验证与还差什么（04）/地图分块：怎样验证做对了（SYS-CHUNK 验证计划）#2. 重构设计验收]] 中与本轮范围对应的确定性检查 |

## 3. 提议纳入的范围

### 3.1 最小工程基础

建议本轮只确定并建立：

- Node.js 22 LTS 运行基线；
- npm 包管理与锁文件；
- TypeScript 严格类型检查；
- Vitest 单元测试；
- 最小的 `typecheck` 和 `test` 命令。

Human 已通过 `DEC-SYS-CHUNK-CORE-001` 接受这组最小工具链；它只服务当前 CORE，不自动授权 Phaser、Vite 或后续完整工程栈。

### 3.2 SYS-CHUNK 确定性核心

- 读取并校验当前 `master.json` 的关键契约；
- 在合法边界内换算 chunk 坐标与 `index = y * width + x`；
- 根据玩家位置计算边界裁剪后的 3×3 坐标集合；
- 根据相机矩形计算加 1 块边距后的坐标集合；
- 合并玩家与相机集合，保证去重、无越界且结果可重复；
- 使用公开镜像或最小受控 fixture 编写单元测试，不修改 `sample/`。

### 3.3 允许建立或修改的路径

原子激活进入 clean Git 基线后，只允许在本工作项范围内使用：

```text
package.json
package-lock.json
tsconfig.json
src/README.md
src/chunk/*.ts
tests/chunk/*.test.ts
```

如实现需要超出这些路径，AI 必须停止并重新提交范围审查。

## 4. 本轮明确不做

- 不接入 Phaser、Vite、浏览器自动化或正式游戏入口；
- 不发起真实网络请求；
- 不实现请求去重、缓存、重试、取消或销毁；
- 不写入 Tilemap，不处理完整24层语义；
- 不实现 Play 前相机序列预载；
- 不创建 `WI-SYS-CHUNK-PHASER-*`；
- 不修改、迁移或清理旧 Phaser 项目；
- 不提取通用加载器、坐标库或未来校园框架。

## 5. 完成标准

本工作项只有同时满足以下条件才能关闭：

1. Human 已接受本包及准确范围，授权决定为 `DEC-SYS-CHUNK-CORE-001`；
2. 类型检查和全部单元测试在 clean 结果基线上通过；
3. master、行优先索引、边界裁剪、玩家3×3、相机+1及集合并集均有成功与失败用例；
4. 实际文件未超出授权路径，`sample/` 与旧 Phaser 项目没有修改；
5. 结果提交可定位，关闭索引记录产物和提交；
6. [[../README#复用观察表]] 仍按真实重复更新；当前预期保持“未发现”；
7. `SYS-CHUNK` 节点仍保持 `designed`，不得因本轮部分实现提前标记 `implemented`。

## 6. 成本和主要风险

| 项目 | 预计 |
|---|---|
| Human 审查 | 只需确认工具链、范围和是否授权；不要求逐项检查机器字段 |
| 实施规模 | 小型；工程初始化、纯函数核心和单元测试，不包含浏览器集成 |
| 主要风险 | master 契约被过度写死；坐标单位混淆；纯逻辑接口提前抽象 |
| 控制方式 | 只实现当前证据支持的字段；明确 tile/world/chunk 单位；代码保留在 `chunk` 领域内，不抽取通用模块 |
| 回退方式 | 全部改动位于新正式工程且由 Git 跟踪；不触碰旧项目，可整体回退本工作项提交 |

## 7. Human 决定

Human 于 2026-08-11 明确接受：

1. Node.js 22 LTS、npm、TypeScript strict 和 Vitest 作为当前 CORE 的最小工具链；
2. 第3节准确范围，并授权 `WI-SYS-CHUNK-CORE-001`；
3. Phaser 集成继续未授权，CORE 完成后另行审查。

决定引用：`DEC-SYS-CHUNK-CORE-001`。本包不允许通过实现细节扩大范围。

## 8. 实施结果

- 结果提交：`f04568f953821e8cc56c33a694171ddab759051f`；
- 实际路径：`package.json`、`package-lock.json`、`tsconfig.json`、`src/chunk/*.ts`、`tests/chunk/*.test.ts`，未超出授权范围；
- 验证：TypeScript strict PASS，3文件26项测试 PASS，npm 官方源审计0漏洞；
- 治理：sync 835项、pilot 840项 PASS；`sample/` 与旧 Phaser 零修改；
- 独立复核：PASS，无 blocking/high/medium/low 缺陷；
- 复用观察：未发现，没有提取通用模块；
- 未完成范围：Phaser、网络、缓存、渲染和完整生命周期继续未授权；
- 工作项关闭：`DEC-WORK-RELAY-002` 允许无预授权下一项时正常关闭；当前正式工作项为 `none`。

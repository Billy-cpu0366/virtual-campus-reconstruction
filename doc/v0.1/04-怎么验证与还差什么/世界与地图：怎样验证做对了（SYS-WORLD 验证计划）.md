---
title: 世界与地图：怎样验证做对了（SYS-WORLD 验证计划）
type: system-verification-plan
status: approved
version: v0.2
node-id: SYS-WORLD
design-ref: ../03-具体怎么做/系统/世界与地图：游戏世界怎样建立和装卸（SYS-WORLD）.md#SYS-WORLD
implementation-status: not-authorized
updated: 2026-08-11
---

# 世界与地图：怎样验证做对了（SYS-WORLD 验证计划）

> **一句话：先证明世界数据、职责和失败边界自洽；未来实现后再证明24层能完整写入、清除和销毁。**

> 本计划验证Human已接受的正式设计，但不代表代码已授权或实现。

## 1. 原站事实基准

| ID | 要证明什么 | 证据与方法 |
|---|---|---|
| WORLD-FACT-001 | master为5×5、chunk为28×28、世界为140×140、tile为16px | master与25个chunk结构检查 |
| WORLD-FACT-002 | 25个chunk可无损重建24层整图 | 行主序拼接后与final_map逐格比较，差异必须为0 |
| WORLD-FACT-003 | 发布Bundle建立140×140空Tilemap | 搜索`this.make.tilemap({tileWidth:`并核对master |
| WORLD-FACT-004 | 发布代码保留只写layer1的普通局部fallback和默认优化22层整图写入两条路径 | 搜索`USE_OPTIMIZED_TILESETS`、`o=["layer1"]`和`loadChunk(e,t)` |
| WORLD-FACT-005 | 已定位卸载只清11层且不删除原始JSON缓存 | 搜索`unloadChunk(e,t)`并核对SYS-CHUNK证据 |

## 2. 正式设计验收

| ID | 操作 | 通过条件 | 失败判定 |
|---|---|---|---|
| WORLD-DESIGN-001 | 对照SYS-CHUNK、SYS-WORLD、SYS-LAYER、SYS-ASSET责任表 | 每个状态只有一个修改者，没有请求、世界和图层策略互相越权 | 同一状态多所有者或关键责任无人承担 |
| WORLD-DESIGN-002 | 输入有效master、资源和24层策略 | 只有全部创建成功才发布ready世界 | 半成品世界可被外部使用 |
| WORLD-DESIGN-003 | 输入完整28×28、24层chunk | 全部层转换和写入成功后才登记已渲染 | 写一半仍报告成功 |
| WORLD-DESIGN-004 | 让任一层转换或写入失败 | 当前chunk所有局部结果回滚，失败可定位 | 留下半个chunk、marker或碰撞状态 |
| WORLD-DESIGN-005 | 重复apply/remove同一坐标 | 返回AlreadyApplied/AlreadyAbsent且状态不漂移 | 重复写入、重复清除或抛出不可解释错误 |
| WORLD-DESIGN-006 | 世界销毁时存在晚到结果 | 禁止新写入；释放世界拥有资源；重复destroy安全 | 回调继续操作已销毁Tilemap |
| WORLD-DESIGN-007 | 检查运行数据来源 | 第一版只使用master+chunk；final_map只作Oracle | 同时维护两条运行真相导致结果分叉 |

## 3. 未来实现测试

正式代码另行授权后至少建立：

1. WorldSpec边界与像素尺寸单元测试；
2. 24层空世界创建测试；
3. 单chunk写入、重复写入、清除和重复清除测试；
4. 第N层失败后的整块回滚测试；
5. walls/bridge碰撞区域重算测试；
6. destroy前后晚到写入拒绝测试；
7. 5×5全图重建与final_map逐格对照；
8. Phaser场景创建/销毁后的监听、空闲任务、Tilemap和碰撞泄漏检查。

## 4. 保护边界

- 不为迁就实现修改master、chunk或final_map证据；
- 不把浏览器画面相似代替数据和失败路径测试；
- 不把只完成11层报告为世界装配完成；
- 未经level-2 Human Gate不创建Phaser实现。

## 5. 当前状态

- 事实检查：24层重建0差异，已通过；
- 正式设计：Human已接受；
- 实现：未授权；
- 节点：`designed`；
- 残余未知：发布优化路径重复写入、特殊13层持久策略和显式teardown。

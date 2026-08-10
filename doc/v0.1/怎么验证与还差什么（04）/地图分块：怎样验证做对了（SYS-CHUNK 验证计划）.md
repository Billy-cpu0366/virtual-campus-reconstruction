---
title: 地图分块：怎样验证做对了（SYS-CHUNK 验证计划）
type: system-verification-plan
status: approved
version: v0.1
node-id: SYS-CHUNK
design-ref: ../具体怎么做（03）/系统/地图分块：玩家移动时怎样加载地图（SYS-CHUNK）.md#SYS-CHUNK
implementation-status: not-authorized
updated: 2026-08-10
---

# 地图分块：怎样验证做对了（SYS-CHUNK 验证计划）

> **一句话：这份文件列出未来怎样检查地图分块是否按设计工作、是否接近原站。**

> 本计划验证已接受的地图分块详细设计，不代表已有代码实现。原站事实基准、重构设计验证和实现结果必须分别记录。

## 1. 原站事实基准

| ID | 要证明什么 | 证据 |
|---|---|---|
| BASE-MAP-001 | 游戏世界请求 `chunk0.json` 至 `chunk24.json` | [[原站实际表现是什么（行为基准）]]、运行时 Network、镜像文件 |
| CHUNK-DATA-001 | master 是5×5、每块28×28，索引为 `y*5+x` | master、25块重组与 `final_map.json` 对照 |
| CHUNK-RUNTIME-001 | 玩家3×3与相机范围+1块边距共同形成玩家阶段目标集合 | Bundle 搜索锚点 `getCurrentChunkIndex`、`getVisibleChunksForCamera` |
| CHUNK-PRELOAD-001 | Play 前相机序列预载与玩家阶段动态目标集合是两段不同流程 | `startCameraSequence`、`preloadChunksForCameraSequence`、Network 时序 |

## 2. 重构设计验收

| ID | 前置条件 | 操作 | 预期结果 | 失败判定 |
|---|---|---|---|---|
| CHUNK-DESIGN-001 | 读取 master 与25块 | 按 `(x,y)` 计算文件名并重组 | 与 `final_map.json` 的24层逐格一致 | 索引、边界或任一格不一致 |
| CHUNK-DESIGN-002 | 给定玩家位置和相机视口 | 计算目标集合 | 等于边界裁剪后的玩家3×3与相机+1集合并集 | 漏块、越界或集合来源混淆 |
| CHUNK-DESIGN-003 | 同一坐标被重复请求 | 观察在途登记 | 同一时刻只有一个在途工作 | 多次请求或状态无法解释 |
| CHUNK-DESIGN-004 | 块离开目标集合 | 执行场景清除 | 已渲染集合收敛；数据缓存与渲染状态可分别观察 | 将已下载误当成仍渲染，或遗漏清除 |
| CHUNK-DESIGN-005 | 请求失败、结果过期或场景销毁 | 触发对应路径 | 不向错误/已销毁场景写入；失败可定位 | 静默吞错、旧结果写入或资源继续操纵已销毁场景 |
| CHUNK-DESIGN-006 | 13个图层语义未确认 | 运行覆盖审计 | 不报告为已正确支持 | 未证实图层被纳入通过结论 |

## 3. 实现后附加验证

只有 `GATE-SYS-CHUNK-IMPLEMENTATION` 明确通过后才执行：

- 在正式 `src` 上运行数据重组、目标集合、单一在途、失败和销毁测试；
- 对至少一个桌面视口复核首屏预载和玩家阶段装卸；
- 报告多视口、完整图层语义、原站取消/重试策略仍未验证的范围；
- 回写 [[原站和旧版本差在哪（证据与差距）]]，但不得为迁就代码修改原站事实基准。

## 4. 当前状态

- 详细设计：已通过 Human 审查；
- 正式实现：未授权；
- 原站未知：并发实现细节、取消、重试、销毁清理和13个图层语义仍保留；
- 复用观察：未发现。
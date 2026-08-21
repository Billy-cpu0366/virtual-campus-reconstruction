---
window: C
system: SYS-ENTITY
status: planned
branch: recon/entity-lifecycle
worktree: .pi/worktrees/entity-lifecycle-recon
parent: WI-PARALLEL-CONTENT-FOUNDATION-RECON-001
updated: 2026-08-21
---

# 窗口 C：SYS-ENTITY 调查与设计包

## 目标

查清玩家、NPC、车辆等运行对象的创建、注册、更新、停用与销毁边界，回答 `Q-ENTITY-001` 是否存在直接证据支持共享实体生命周期，并在同一窗口形成完整 SYS-ENTITY 七格设计候选。

## 只回答这些问题

1. 玩家、NPC、车辆分别由谁创建、保存、逐帧/定时更新和销毁？
2. 它们是否继承同一公开 Bundle 类、消费同一 registry/group，或只是表面相似？
3. chunk 装卸、scene shutdown、传送、禁用与对象销毁如何影响这些实体？
4. listener、timer、tween、physics body、sprite、route/trajectory 引用如何清理？
5. NPC 与车辆依赖哪些路线、地图层或资源；哪些归 SYS-NPC/SYS-ROUTE 而非 ENTITY？
6. 是否已出现至少两个独立真实场景，足以提出共享生命周期；稳定部分与变化部分分别是什么？

## 证据白名单

- `03-执行层/04-独立件/03-实体生命周期.md`
- `03-执行层/05-旁支/01-NPC.md`
- `03-执行层/05-旁支/02-车辆与路线.md`
- `03-执行层/00-总账.md` 的 `Q-ENTITY-001/Q-ROUTE-001`
- `02-接口层/API契约表.md`
- `sample/original-public-build/mirror/chunk-WMFY56ZM.js`
- Bundle 明确引用的公开 NPC/route/trajectory 数据文件；不得猜路径或扩大下载
- 当前实现使用 `git show 798eda6:<path>` 核对玩家、World、renderer 和 scene shutdown 的现状

## 所有权边界

- C 只调查生命周期与所有权，不完整逆向 NPC 行为、车辆路线算法或 FX。
- 没有直接共享基类/registry/生命周期证据时，`Q-ENTITY-001` 保持 open。
- 不为了未来 NPC/车辆预设通用 Entity 框架；复用观察必须列出真实重复证据。
- 唯一允许写入：`task-todos/WI-PARALLEL-CONTENT-FOUNDATION-RECON-001-窗口C-SYS-ENTITY调查报告.md`。

## 报告必须产出

- 玩家/NPC/车辆三条生命周期对照表；
- 创建者、所有者、更新者、销毁者矩阵；
- scene/chunk/route/physics 依赖图；
- `Q-ENTITY-001` 的 FACT 支持、反证或残余 UNKNOWN；
- 复用观察：稳定部分、变化部分、收益、成本和风险；
- 完整七格设计候选：事实/数据/流程/失败清理/接口/验收/代码位置；
- 给 SYS-NPC/SYS-ROUTE 的后续边界，不顺手完成它们；
- FACT/INFERRED/UNKNOWN、证据定位和检查收据。

## 客观检查

```text
只新增本窗口一份报告
不修改 sample、系统卡、API、代码和其他任务文件
不把压缩类名冒充原始源码架构
Q-ENTITY-001 只有直接证据才允许建议关闭
CRLF-aware diff --check PASS
```

完成后提交自己的报告分支并停止，不 merge、不 push。

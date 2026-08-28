---
work-item: WI-VISIBLE-CONTENT-WAVE-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 03-content
status: human-visual-verified-awaiting-integration
branch: integration/visible-product-wave
worktree-path: .pi/worktrees/visible-product-integration
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
current-authorization: DEC-CONTENT-ENGLISH-VISIBLE-WAVE-001
candidate-commit: 1d163939c6b57cc9dcdab9d3dd98dd5c2c7e187e
candidate-tree: e051be264b4ce152e238406da806191f82968abd
human-gate: enabled-english-content-passed
worktree-receipt: implementation-71b00851-clean
updated: 2026-08-28
---

# 03内容线：可见内容波

## P1任务

- 核对About、Projects、Memo等公开正文、图片、链接与双语证据。
- 调查首个内容点怎样被玩家发现，不以test hook传送代替真人路径。
- 复核动态marker、内容失败和teardown残余UNKNOWN。
- 形成至少三类可见内容的实现候选和桌面/移动端验收场景。

## P1交付

只提交一份调查设计报告；区分FACT/INFERRED/DECISION候选/UNKNOWN，并列出允许文件、测试和停止条件。不得写正式功能代码。

## P1/P2交接

P1报告`0a5091db`已并入root`fbec3e2`。Human已选择Memo 6首引导；P2范围见[实现包](WI-VISIBLE-CONTENT-WAVE-001-P2-实现包.md)。设计clean提交前不得写代码。

## Memo6首个纵切片Human Gate（2026-08-28，已纳入英文内容波）

- **已接受范围**：Human已确认Memo6正常Play→真实键盘步行→区域触发→内容弹窗→关闭恢复的有界视觉结果；不使用传送、`setPosition`或直接打开modal。
- **已验证**：候选`integration/visible-product-wave@1d163939c6b57cc9dcdab9d3dd98dd5c2c7e187e`在普通production预览`http://127.0.0.1:4242/`完成Human复看；test-hooks内容Smoke以真实Play和左36格/上7格路径通过，显示英文正文与`card6_base.webp`，关闭后控制恢复，console/exception/failed request/bad response均为空。
- **阶段边界**：当时只确认Memo6；本卡后续已扩展并记录全部已启用英文内容。根`master`集成及完整内容系统仍未完成；不自动启动CV/Contact/Tech、Slovak、NPC或S2–S4。
- **下一步**：如需继续，另行授权候选集成或内容扩展；本卡不把已有candidate自动合并到根基线。

## 已启用英文内容波Human Gate（2026-08-28）

- **已接受范围**：Human确认About、Projects、Memo1–5剩余已启用英文内容可以；与Memo6合并后，已启用英文内容波完成Human视觉Gate，Memo6保留正常Play真实步行Gate，其他入口按正常地图UI进入查看。
- **已验证**：当前候选普通production Map Smoke通过；内容相关9个测试文件/56项测试通过，正文、资源映射、富内容渲染、地图入口和关闭恢复均有自动覆盖；普通production预览由Human复看。
- **状态边界**：已启用英文内容波的Human Gate通过，但候选仍在`integration/visible-product-wave`，尚未集成根`master`；Slovak正文、CV/Contact/Tech、完整UI视觉和完整内容系统仍未完成。
- **下一步**：如需继续，另行授权内容候选的root integration或未覆盖内容扩展；不自动合并、不启动NPC或S2–S4。

## P3阻塞收据

`4b36ad40ede8f0cff8428bb6ae7877a572a3db4f`仅提交阻塞报告，tree=`f49186a20c5e3e2a6ac8b1b3ce34cd30d74e7d8b`，parent=`0a5091db`，clean；未写功能代码。等待Main共享契约commit同步后恢复。

## 后续候选边界

P2通过后可候选修改`src/content/**`、必要`src/zone/**`/`src/interact/**`、对应测试和公开内容派生资源。不得修改Main共享入口；不得猜未公开内容。

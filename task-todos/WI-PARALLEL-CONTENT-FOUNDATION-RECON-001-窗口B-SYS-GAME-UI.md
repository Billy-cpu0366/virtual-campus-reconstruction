---
window: B
system: SYS-GAME-UI
status: planned
branch: recon/game-ui
worktree: .pi/worktrees/game-ui-recon
parent: WI-PARALLEL-CONTENT-FOUNDATION-RECON-001
updated: 2026-08-21
---

# 窗口 B：SYS-GAME-UI 调查与设计包

## 目标

查清原站游戏 UI 的呈现层：canvas 外/内的 DOM 结构、弹窗容器、按钮、遮罩、层级、响应式和移动端行为，并在同一窗口形成完整 SYS-GAME-UI 七格设计候选。

## 只回答这些问题

1. modal、HUD、菜单、地图、关闭按钮位于 Angular DOM 还是 Phaser scene，彼此层级如何？
2. modal 的容器、遮罩、可见/隐藏方式和内容插槽是什么？
3. 桌面与移动端的尺寸、定位、滚动、关闭入口和遮挡行为有什么差异？
4. 键盘、pointer、focus、页面滚动与 canvas 输入如何隔离？
5. 空内容、图片失败、窗口 resize、重复打开和销毁时 UI 怎么退化？
6. A 可以向 UI 提交什么呈现状态，UI 向 A 返回什么用户动作？

## 证据白名单

- `03-执行层/04-独立件/02-游戏UI.md`
- `03-执行层/03-内容线/02-世界交互(弹窗).md`
- `04-内容层/作品集内容.md`
- `02-接口层/API契约表.md`
- `sample/original-public-build/mirror/index.html`
- index 直接引用的公开 CSS 与负责 modal/HUD 呈现的公开 JS chunk
- 必要运行观察只能使用现有公开页面/本地镜像入口，不刷新或扩大采集
- 当前实现仅用 `git show 798eda6:<path>` 核对 canvas、诊断和 viewport 边界

## 所有权边界

- B 只负责呈现与输入隔离，不决定 visited、manual close、leave/re-enter 等业务状态；这些归 A。
- 不设计网站完整首页、Retry 流程或 SYS-APP；发现依赖只登记。
- 不调查 NPC/实体/路线。
- 唯一允许写入：`task-todos/WI-PARALLEL-CONTENT-FOUNDATION-RECON-001-窗口B-SYS-GAME-UI调查报告.md`。

## 报告必须产出

- DOM/Phaser UI 边界图；
- modal/HUD 层级和响应式表；
- open/close 呈现输入输出；
- pointer/keyboard/focus/scroll 隔离证据；
- 面向 A 的 UI capability 清单；
- 完整七格设计候选：事实/数据/流程/失败清理/接口/验收/代码位置；
- 失败、resize、销毁和移动端 UNKNOWN；
- FACT/INFERRED/UNKNOWN、证据定位和检查收据。

## 客观检查

```text
只新增本窗口一份报告
不修改 sample、系统卡、API、代码和其他任务文件
不把 HTML/CSS 类名直接冒充原始源码组件结构
所有运行观察与静态 Bundle 事实分开标记
CRLF-aware diff --check PASS
```

完成后提交自己的报告分支并停止，不 merge、不 push。

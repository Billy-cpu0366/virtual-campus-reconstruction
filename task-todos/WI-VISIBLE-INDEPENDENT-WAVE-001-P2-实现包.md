---
work-item: WI-VISIBLE-INDEPENDENT-WAVE-001
phase: P3-parallel-implementation
status: integrated-auto-verified-human-pending
p2-design-commit: c21f7ce8ddeafc071aa77988d69fe2d1b538637e
authorization: DEC-VISIBLE-WAVE-P2-001
branch: feature/04-independent-visible-wave
parent-report: d4d848379489843984962d4616eb7cc9ab46b819
---

# 04独立件：P2批准的P3实现包

## 目标

实现可复用但不接Main入口的App状态与正式DOM UI Provider：真实Loading、Play、ERROR/Retry、modal focus和响应式行为。

## 冻结行为

- 状态：BOOT→LOADING→READY→ENTERING_GAME→PLAYING↔MODAL_OPEN；ERROR→RETRYING；任意状态可SHUTDOWN。
- 百分比只接受真实loader回调，失败不补100%。
- Play/Retry幂等；Retry先清旧generation，stale回调无效。
- optional图片失败保留正文/尺寸；required失败进入ERROR。
- Play/Retry/close有可见focus；modal隔离游戏输入并恢复焦点。
- Entity继续NO-GO，不新增`src/entity/**`。

## P2.1前置修正

保留当前dirty实现；root authority提交后，先完成并验证不依赖富内容schema的App/UI foundation提交，再同步Main共享contract。之后由04在`src/game-ui/**`实现sections安全DOM渲染。

## 允许文件

- `src/app/**`
- `src/game-ui/**`
- 对应`tests/app/**`、`tests/game-ui/**`
- 本任务执行报告

禁止修改`game/main.ts`、`CampusScene.ts`、`index.html`、`package.json`、相机/地图、sample、API和权威文档。

## 检查与交付

覆盖状态转移、真实进度、错误/Retry、generation、focus、Escape、responsive和destroy；再跑typecheck、全测试、build和CRLF-aware范围检查。只提交允许文件，返回commit/tree/parent/clean，停在ready-for-integration，不push。

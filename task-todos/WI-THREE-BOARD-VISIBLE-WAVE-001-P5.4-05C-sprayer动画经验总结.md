---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.4-05c-sprayer-animation-defect
status: human-visual-verified
updated: 2026-08-24
---

# 05-C Sprayer 逃跑动画：经验总结

## 已确认的根因

逃跑 NPC 先后出现两类独立问题：

1. 每帧调用 `setTexture("npc-sprayer-running")` 会把 Phaser 动画重置到首帧，因此视觉上像一张静态贴图在移动。
2. 初始实现把 64 帧精灵图按四方向猜测分行，和已经验证的玩家 8 向帧序不一致，因此会背对镜头或朝向错误。

最终修复 `a372564`：不在每帧重设贴图；按路线实际位移输出完整 8 向 facing，并复用 `src/player/appearance.ts` 的已验证帧序：east=0、north-east=8、north-west=16、north=24、south-east=32、south-west=40、south=48、west=56。

## 无效路径（以后避免）

- 只通过替换某一行精灵帧来修“背对镜头”；没有完整方向状态时，这只能偶然改善单段路线。
- 从精灵图外观或常见排列猜测 frame row；同为 8×8 帧图不代表方向排序一致。
- 只验证动画对象已创建、贴图已切换；这不能证明帧实际推进，也不能证明朝向匹配路线。

## 可复用检查顺序

1. Human 报告“动作奇怪”时，先区分：帧不推进、方向错误、路线方向错误或深度/遮挡错觉。
2. 查是否在每帧重设 texture/frame；若有，先确认它不会重置动画进度。
3. 优先复用仓库内同规格且已视觉验证的方向→帧序映射；没有直接证据时标为 UNKNOWN，不凭经验猜。
4. 让运行时快照或单元测试覆盖路线段的 facing；浏览器验收确认至少正交和斜向段。
5. 多次局部修复无效时，停止改常数，审计状态机、资源帧序、更新调用和真实浏览器表现的完整链。

## 验证收据

- `tests/npc/sprayer.test.ts` 通过。
- `npm run typecheck` 通过。
- `npm run build` 通过。
- Human 在 `http://localhost:4247/` 确认“可以，现在修好了”。

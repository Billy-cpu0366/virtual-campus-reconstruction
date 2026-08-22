---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: P2
status: accepted-persisted-implementation-authorized
p2-design-commit: c21f7ce8ddeafc071aa77988d69fe2d1b538637e
p2-design-tree: ec2884530db465a57b5dd20cd7811fc215e7df52
authorization: DEC-VISIBLE-WAVE-P2-001
p1-root-tip: 1b4bc034d33675ebe6ddd4045f5c47a1739da9f4
human-visual-target: accepted
updated: 2026-08-22
---

# 三板块可见成果波：P2统一设计

## 1. 需求依据

Human已否决`8ae7692b`“技术通过但首屏几乎无变化”的产品效果，并接受：

1. Play后使用公开证据支持的**3秒Power2镜头落到玩家**；火车同时进场，约5秒后开放控制。
2. 桌面采用原页面证据支持的**480×270逻辑世界画面**，再缩放到可用屏幕；不继续使用此前被否决的浏览器等比扩世界视野。
3. 首个内容引导使用距出生点最近的**Memo 6**，玩家必须真人移动到触发区，不使用teleport/test hook冒充发现。
4. 03内容、04独立件、05旁支三个一级板块各自交付明显可见成果；Main只负责产品入口、共享文件和最终接线。
5. 六点约111秒序列只保留能力证据，正常入口触发保持UNKNOWN，production禁止调用。

P1报告：内容`0a5091db`、独立件`d4d84837`、旁支`035017ae`、产品入口`b5708b42`；root集成tip=`1b4bc03`。

## 2. 冻结体验

```text
page-init
  → asset-loading（真实Phaser文件队列进度）
  → scene-ready（世界/必要资源就绪）
  → Play
  → entry-transition
       ├─ 相机3000ms Power2落到玩家出生点(1088,304)
       ├─ crowdTrain同时从右侧进场，5000ms到达
       ├─ 玩家/键盘/摇杆保持锁定
       └─ factory smoke与sprayer按各自owner创建
  → playable（火车到达后开放控制）
  → 非阻塞Memo 6方向引导
  → 真人移动约43格到Memo 6并打开真实英文内容
```

- 相机终态：玩家居中、zoom=1、offset=0、deadzone=0、硬跟随lerp=1、roundPixels=true。
- 逻辑世界视口：桌面480×270；CSS缩放适配可用区域，不把桌面窗口变大解释为看见更多世界。移动端保持同一逻辑构图并让DOM UI/摇杆适配可用区域，最终以375×667视觉验收为准。
- 控制：相机3秒结束不等于可玩；火车5秒进场完成才释放统一控制lease。引导不得重新锁控制。
- 火车：5秒进场、约3秒停留后9秒离场；重复触发、中断和shutdown必须清Sprite、碰撞带、blocking zone和timer/tween。
- FX：factory smoke位于公开锚点约(808,539.2)，应在入口镜头路径或短路径中可见；视口外停发、返回恢复、shutdown清理。
- NPC：保留四个公开sprayer锚点和300ms组间逃跑；玩家从出生点向row25短移即可触发。不得建通用Entity框架。
- 内容：实现已证实英文About、Projects、Memo内容；首个引导指向Memo 6。Memo 6候选路线为左36格、上7格，实际行为以碰撞和`<30px`触发为准。图片/文案不得猜测Slovak版本。

## 3. App与失败设计

状态冻结为：

```text
BOOT → LOADING → READY → ENTERING_GAME → PLAYING ↔ MODAL_OPEN
              ↘ ERROR → RETRYING ───────↗
任何状态 → SHUTDOWN
```

- 百分比只来自Phaser loader文件队列，不伪造时间、字节或后续chunk进度。
- required：入口代码、初始world/chunk、玩家、Memo 6 base内容、train、sprayer、smoke资源；失败进入可见ERROR。
- optional：未用于首个路径的卡片效果、已知`card5_foil.webp`等失败资源、外链实时可达性；失败时保留正文和稳定占位，不阻断首个可玩路径。
- Retry是本重构DECISION，不冒充原站FACT；用户显式触发，先shutdown旧generation，再创建新generation。晚到Promise/event/timer不得改写新状态。
- Play与Retry幂等；ERROR不得补成100%；production不暴露debug hooks。
- modal打开时隔离游戏输入，关闭后恢复；Play/Retry/close有可见focus，Escape和焦点返回按DOM测试验收。

## 4. 所有权

| 线 | 独占范围 | 禁止 |
|---|---|---|
| 03内容 | `src/content/**`，任务明确需要的`src/zone/**`/`src/interact/**`，对应测试和已批准内容资源 | `CampusScene/main/index/package`、共享UI、猜文案/资源 |
| 04独立件 | `src/app/**`、`src/game-ui/**`、对应测试；只交纯状态与DOM Provider | Main共享入口、相机/地图、`src/entity/**` |
| 05旁支 | `src/npc/**`、`src/route/**`、`src/fx/**`、新增专属Phaser适配器、对应测试和已批准精灵资源 | 修改现有Main文件、通用Entity/registry、地图核心 |
| Main integration | `game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、共享adapter/contracts、browser Smoke和合并 | 在各分支未交付前复制第二套私有逻辑 |

`sample/`始终只读；API/系统卡由Main统一维护。任何owner外修改先停止。

## 5. 实现与合并顺序

1. P2设计进入clean根提交后，三个板块和Main入口可并行实现，各自只提交允许文件。
2. 各线先typecheck、定向测试、全测试、build和范围检查，返回commit/tree/parent/clean收据。
3. Main按“独立件→内容→旁支”串行接收，冲突只由Main解决；共享入口只在integration分支修改。
4. Main运行两种build、全测试、runtime safety和所有browser gates；新增Loading/entry/content/side/retry Smoke。
5. 自动门禁通过后先交Human视觉验收：Loading、3秒镜头、5秒火车、480×270构图、sprayer、smoke、Memo 6真实路径均必须肉眼可见。
6. Human未通过不得关闭P7/P8文档；仍不push、PR或同步Windows。

## 6. 完成标准

- 03内容：About/Projects/Memo真实英文payload可见；Memo 6可由正常Play和真人移动触发，关闭/离开/重入正确。
- 04独立件：真实Loading/Play/Error/Retry、响应式DOM、focus与generation cleanup可见且可测。
- 05旁支：sprayer组、火车路线、factory smoke均有创建—更新—销毁行为，不以静态tile/no-code替代。
- Main：入口严格3秒相机+5秒控制门，480×270逻辑构图，不触发111秒序列；四线只保留一个生命周期owner。
- 浏览器无新增pageerror、未处理console error、失败请求漂移、重复Phaser实例、listener/timer/object单调增长。
- Human明确接受最终桌面与移动端录像/截图后，才能更新完整状态或关闭工作项。

## 7. 风险与停止条件

- 480×270在移动端造成不可操作、遮挡或错误世界范围：停止在视觉Gate，不静默改缩放。
- train/smoke/sprayer资源未进入正式runtime：停止并走批准资源流程，不猜URL。
- Memo 6自然路线与静态BFS不一致：保留UNKNOWN，修正引导，不使用传送通过。
- Retry无法证明旧generation清理：不得报告恢复完成。
- 任一实现要求改其它owner共享文件：停止交Main。
- 出现第二个真实生命周期消费者后只登记复用观察；Human确认前Entity仍NO-GO。

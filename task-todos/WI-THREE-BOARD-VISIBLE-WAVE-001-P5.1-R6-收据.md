---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-R6
status: bounded-verified
implementation-commit: 32e7f74506085c9d6ba23d7fa518e4f4fb2f9ec1
implementation-tree: 0deb597c5563913a20eb21d4157c31b64bb0d648
base-commit: 6c8c66d6961d1de4e86a12a969b07ddf9f955ac9
verified-date: 2026-08-23
---

# P5.1 R6 HUD / 地图导航 / 对话联动收据

## 1. 结论

R6已在integration分支完成并有界验证：

1. 正常Play完成后持续显示公开证据对应的左下mini-map支架、地图图像、11个真实marker与动态玩家点；guide移到安全区，地图或内容modal显示时隐藏。
2. 点击mini-map打开big-map；面板使用公开`big-map.webp`、Info/Memo/Visited图例、11个真实位置点、玩家点、关闭按钮与backdrop。
3. About、Projects和Memo1–6共8个已核对内容可从big-map进入现有Interact/resolver/DOM modal；CV、Contact、Technologies完整正文仍UNKNOWN，因此保留位置但禁用，不补写内容。
4. big-map复用共享`map-open`玩法控制lease；map、内容modal和HUD互斥，close/backdrop/marker选择/Retry/shutdown均成对释放。地图直接打开内容不会伪造物理Zone visited；真人/Zone到访后Visited状态同步到mini/big两层。
5. 1920×1080桌面和375×667移动正常production均未暴露test hooks；HUD、big-map、Memo6直达、关闭恢复和玩家点随键盘移动已由Main逐张检查。

自动和截图证据只证明R6有界合同；最终仍由R7完整回归后的Human整体视觉Gate签字。

## 2. FACT与DECISION边界

### 保持的FACT

- 11个marker的`sunburn/vortex`类型、id、Bundle名称、menuId和坐标与`04-内容层/作品集内容.md`完全一致；
- 原站存在持续mini-map、可点击big-map、玩家点、marker、Visited状态及Info/Memo/Visited图例；
- big-map marker点击可进入对应内容；modal打开时隐藏speech bubble、marker和joystick；
- 公开资源：`mini-map.webp` SHA-256 `2355cde9...7efd`、`big-map.webp` `f0e90a99...ba8d`、`map-holder-mini3.webp` `5dedcf1c...2a07`。

### R6主动DECISION

- 当前只启用已逐字核对的About、Projects、Memo1–6；CV/Contact/Technologies仅显示禁用位置点，等待内容权威补证。
- 地图打开使用现有玩法控制lease；地图直接内容使用独立`map-residence-*`身份，UI成功但不冒充物理Zone visited。
- 移动端保留原站左下地图方向，但不照搬会与当前右下摇杆冲突的quick-actions；顶部完整菜单和quick-actions parity延期。
- Escape关闭big-map仍未宣称原站parity；本轮保证close button、backdrop和可见focus。

## 3. 量化证据

- marker：11个；enabled 8，disabled 3；Visited在物理到访Memo6后mini/big各1；
- 玩家点：production键盘右移后mini-map横坐标约`48.6%→52.9%`；
- desktop HUD：289×205，1920×1080左下；mobile HUD：169×120，375×667左下安全区；
- lifecycle：map HUD/root hidden、map lease inactive，且R4/R5对象与physics collider全部清零；
- production性能：入口P95约16.8ms、4秒移动P95约16.7ms，>34ms帧、LoAF和long task均为0，最大input handler延迟1.5ms；
- production hooks：debug/collision/lifecycle/content均为`undefined`。

## 4. 验证

- `npm test`：56 files / 312 tests PASS；
- typecheck、runtime资产哈希、production/test-hooks两种build PASS；
- desktop 1920×1080与mobile 375×667 production map正常路径PASS；
- test-hooks map、lifecycle、side、entry、chunk、layer、camera、collision、mobile-input、content、visual-smoothing、app-retry、roof-footsteps PASS；
- production smoke、runtime-safety、visible-entry、performance PASS；
- 独立verifier首次发现`Resume(CV)`空格和`sunburn/vortex`被UI名替代的FACT边界问题；修正后再次复核PASS，无阻塞缺陷。

证据目录：[`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R6/`](evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R6/)

## 5. 状态

- **accepted**：方案A及R6边界已由`DEC-P5.1-SYSTEMIC-REPAIR-001`授权。
- **persisted**：实现提交、资源哈希、自动门禁、双视口截图与本收据已落盘。
- **verified**：R6在WSL本机范围内bounded verified。
- **尚未解决**：R7完整production主路径回归、Human硬件trace与最终Human整体视觉；顶部全菜单、移动quick-actions、CV/Contact/Technologies完整内容、particles3/69360和111秒序列继续延期或UNKNOWN。

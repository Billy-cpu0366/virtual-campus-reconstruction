# WI-SYS-CAMERA-RUNTIME-001 Main 集成报告

- 工作项：`WI-SYS-CAMERA-RUNTIME-001`
- integration 分支：`integration/map-gameplay-p0`
- 接入基线：`19ac98b`
- 当前状态：`integration-ready-for-preview`
- Git 状态：未提交、未 push

## 1. 实际集成文件

```text
game/CampusScene.ts
game/PhaserWorldRenderer.ts
package.json
scripts/browser-camera-smoke.mjs
scripts/browser-chunk-smoke.mjs
tests/world/renderer.test.ts
task-todos/WI-SYS-CAMERA-RUNTIME-001-集成报告.md
```

没有修改 gameplay 分支的相机状态机、玩家适配器、资源脚本、`sample/`、内容线或远端 Git。

## 2. CampusScene 接线

- 动态 World、renderer 和 coordinator ready 后才创建并启动 `PhaserCameraRuntime`。
- 统一控制门只调用 `PhaserPlayerRuntime.disableControls/enableControls`；相机不接触键盘或摇杆实例。
- 玩家位置只读取 `PhaserPlayerRuntime.position`；Sprite/Body 仍由 Scene 独占。
- `startHardFollow` 只由 Main 闭包持有玩家 Sprite，并恢复 lerp `(1,1)`；zoom、offset、deadzone 和 roundPixels 由适配器恢复。
- 相机输出只覆盖一个 `pendingCameraViewport`；现有500ms分块循环消费后立即清空，继续使用唯一 `targetChunks`、coordinator、cache 和 Tilemap 生命周期。
- production 调用默认6点序列（111000ms）和3000ms Power2 返回；只有 `MODE=test-hooks` 使用显式压缩序列（5次200ms飞行、每点100ms停留、200ms返回）。
- Scene shutdown 先 shutdown 相机并清 pending viewport，再 shutdown 玩家、摇杆和动态世界；Promise 失败只在 Scene 存活时报告。
- test-hooks debug 增加相机状态、结果、viewport 次数、控制门次数、nativeScale 和后处理可用性；production 不暴露这些 hooks。

## 3. 集成时发现并修复的既有缺陷

左下 chunk 回归首次触发：

```text
TypeError: Cannot read properties of undefined (reading 'baseTileWidth')
```

根因不是相机直接操作 Tilemap，而是相机扩大装卸范围后触发了 renderer 的既有双重注销：

1. `PhaserWorldRenderer.destroyLayer()` 先 `map.removeLayer(layer)`；
2. 随后调用无参 `TilemapLayer.destroy()`；
3. Phaser 3.90 vendor 实现中 `destroy()` 默认参数为 `true`，会再次执行 `tilemap.removeLayer(this)`；
4. 第二次移除破坏剩余 LayerData 索引，后续渲染读取到 undefined。

修复为显式 `layer.destroy(false)`，并新增单元断言证明先 remove 后 destroy 不再要求第二次移除。保持原有 collider → layer → Tilemap 清理顺序，不关闭动态卸载、不改变相机 viewport 或分块公式。

修复后同一场景不再出现 runtime exception。

## 4. Browser Smoke 调整

### 新增相机 Smoke

`scripts/browser-camera-smoke.mjs` 在 test-hooks build 中验证：

- 实际观察到 runtime `running` 和控制门 disabled；
- 航拍完成后 result/status 均为 completed；
- 控制门 disable/enable 各一次；
- 约155次真实 Phaser tween viewport update；
- pending viewport 被现有500ms循环消费并清空；
- zoom=1、roundPixels=true、玩家控制恢复；
- nativeScale 设置可计算；
- HeatHaze/Fire/Morph 均显式 unavailable，不阻断流程；
- 航拍过程中 chunk 资源从0增长到25；
- exception、failed request、bad response 均为0。

### 收紧 chunk Smoke

航拍路线会预载24块，唯一未经过的是左下 `chunk20`。旧“方向键移动后必须新增请求”受路线、碰撞和距离影响，不能确定性覆盖该块。

新口径仅在 test-hooks 下复用现有位置 hook，将玩家放到 `(224,2016)`（chunk20 内），然后验证：

- 初始24块（缺 chunk20）；
- 最终25块；
- 唯一新增请求是 `chunk20.json`；
- runtime exception、failed request、bad response 均为0。

输入和碰撞行为继续分别由 mobile-input/collision Smoke 验证，没有用位置 hook替代这些门禁。

## 5. 自动检查

### 基础门禁

- `npm run typecheck`：PASS。
- `npm test -- --run`：PASS，36个测试文件、192项测试。
- `npm run prepare:runtime`：PASS。
- `npm run check:runtime`：PASS。
- `npm run build`：PASS。
- `npm run build:test-hooks`：PASS。
- `git -c core.whitespace=cr-at-eol diff --check`：PASS。

### test-hooks 浏览器门禁

- camera Smoke：PASS；约155次 viewport update，控制锁/恢复和后处理降级正确，事件0/0/0。
- chunk Smoke：PASS；24→25，明确新增 chunk20，事件0/0/0。
- layer Smoke：PASS；renderer layers 420、markers 719、particles3 diagnostics 86，事件0/0/0。
- collision Smoke：PASS；玩家 y `304→348`、57个 blocked samples、100 collision layers，事件0/0/0。
- lifecycle Smoke：PASS；销毁后 debug/lifecycle/collision hooks 全部 undefined，事件0/0/0。
- mobile-input Smoke：PASS；桌面隐藏、移动端显示、east 输入、释放和键盘恢复，事件0/0/0。

### production 浏览器门禁

- production browser Smoke：PASS；Phaser/canvas 正常，异常、失败请求、坏响应均为0。
- runtime-safety Smoke：PASS；production debug/test hooks 全部 undefined，事件0/0/0。
- production 截图：`/home/mizhou/pi-sandbox/workspace/.pi/verification/camera-integration-production.png`，261179 bytes，Main 目视正常。
- preview PID `20902` 已由受限脚本正常 TERM，`CAMERA_PREVIEW_STOPPED=yes`。

## 6. 性能口径

本轮不重跑9组/27样本长测，原因：

- SYS-CAMERA 第二波明确排除最终硬件性能阈值；
- test-hooks 压缩航拍时序，不代表 production 111秒行为；
- 第一波 `85af370` 的环境 baseline 继续作为有界参考，不升级为验收阈值；
- 本轮已通过真实 camera/chunk/layer/lifecycle 资源上界和零异常回归。

该决定由 Human 以“ok。开始”接受。最终硬件 FPS/GPU/纹理内存及完整111秒长时性能继续未解决。

## 7. 未解决与边界

- 尚未在浏览器中等待完整111秒并观察 production 航拍自然完成；默认时长与3秒返回由自动测试固定，production Smoke 只证明正式配置启动后无异常。
- 当前无已确认可用 HeatHaze/Fire/Morph pipeline，真实行为为显式降级。
- nativeScale 已按实际 `window.devicePixelRatio` 读取，但未做多 DPR 真机视觉验收。
- 不覆盖传送相机、怪物抓人相机、完整灯光/FX、内容线或最终硬件性能阈值。
- `Q-LAYER-002/003`、特殊13层原站语义等地图未知不因相机集成关闭。

## 8. 结论

相机有界结果 `19ac98b` 已完成 Main Scene/分块/生命周期接线；集成期间发现的 TilemapLayer 双重注销已用最小修复和回归测试关闭。基础门禁、两种 build、全部 test-hooks 浏览器门禁、production Smoke、安全隔离和截图均通过。

当前为 `integration-ready-for-preview`；等待 Human 接受实际集成 diff 后才允许创建 integration 本地提交。不 merge 到 master，不 push。

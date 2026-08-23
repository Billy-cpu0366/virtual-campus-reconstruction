---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
package: R1-app-loading
status: bounded-implemented-verified
implementation-commit: ae2bf33
baseline: 0fadf309
updated: 2026-08-23
---

# P5.1 R1 App / Loading / Play / Retry 收据

## 结果

- 使用公开镜像内`peter-oravec.gif`和`peteroravec-logo.webp`恢复白底Loading与Logo/Play层次；资源进入prepare/check可复现链。
- `DomAppUi`只把viewport高度和padding写到`#app-shell`根，不再把loading section、Play button和error section拉到全屏高度。
- 进度按Phaser资源72%→master 80%→world owner 88%→initial targets 92–98%→ready 100%单调推进；100%绑定world/side owner ready，不再在Phaser文件队列结束时冒充完整ready。
- App `markReady`把generation进度收敛到100%；Error/Retry/generation清理合同保持。
- 桌面1920×1080慢网和移动375×667截图确认壳不裁切、不拉伸；R2继续负责100%后的原子揭示和chunk/camera屏障。

## 代码

- integration分支：`integration/visible-product-wave`
- 提交：`ae2bf33`（`fix: restore evidence-backed loading shell`）
- 修改：`game/CampusScene.ts`、`game/main.ts`、`index.html`、两份runtime资源脚本、`src/app/runtime.ts`、`src/game-ui/app-shell.ts`及对应测试。

## 检查

- `npm test -- --run`：53 files / 298 tests PASS。
- `npm run typecheck`：PASS。
- `npm run check:runtime`：PASS。
- `npm run build`、`npm run build:test-hooks`：PASS。
- production：`browser:smoke`、`browser:runtime-safety-smoke` PASS。
- test-hooks串行：`browser:entry-smoke`、`browser:app-retry-smoke`、`browser:mobile-input-smoke` PASS。
- 并行首跑曾因多个浏览器门禁争用同一Chromium而超时；串行30秒窗口重放通过，未据此修改产品代码。
- 独立`lightweight-verifier`：PASS。
- 视觉证据与哈希：`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R1/`。

## 尚未解决

- R2：100%后揭示、camera corridor、chunk mutation原子屏障与viewport初始化稳定性。
- R3：Human硬件卡顿、30Hz物理下视觉步进。
- 最终Human视觉Gate仍FAIL，不由R1自动收据替代。

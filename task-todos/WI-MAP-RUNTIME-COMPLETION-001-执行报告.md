# WI-MAP-RUNTIME-COMPLETION-001 执行报告

- 分支：`impl/map-runtime-completion`
- 执行包基线：`638d4c6`
- 工作项状态：`ready-for-preview`
- 提交状态：未 commit、未 merge、未 push
- 动态状态：未修改；唯一权威仍为根工作区 `task_plan.md`

## 1. 实际修改文件

实现与测试：

- `game/PhaserWorldRenderer.ts`
- `scripts/check-runtime-assets.mjs`
- `scripts/prepare-runtime-assets.mjs`
- `scripts/sanitize-runtime-maps.mjs`
- `src/layer/contract.ts`
- `src/layer/index.ts`
- `src/layer/strategy.ts`
- `tests/asset/runtime-assets.test.ts`
- `tests/layer/markers.test.ts`
- `tests/layer/strategy.test.ts`
- `tests/world/renderer.test.ts`

本报告：

- `task-todos/WI-MAP-RUNTIME-COMPLETION-001-执行报告.md`

所有路径均在任务卡白名单内。未修改 `game/CampusScene.ts`、`package.json`、共享 browser Smoke、权威状态文档、`sample/` 或玩法代码。

## 2. Diff 摘要

1. 资源生成脚本从只读公开证据复制 `tileset-particles.png` 到被忽略的 `public/maps/`；`public/` 不进入 Git。
2. sanitizer 将 `tileset-particles.tsx` 的已证实元数据受限内联为：
   - name：`tileset-particles`
   - firstgid：`69355`
   - tile：`16x16`
   - tilecount/columns：`7/7`
   - image：`tileset-particles.png`（`112x16`）
3. `particles` / `particles2` 从 marker-only 改为 depth 0 的 raw visual，只允许 GID `69355–69359`。
4. sanitizer 将 `69360` 清零；renderer 若绕过 sanitizer 直接收到未知 raw GID，会显式失败，不静默赋予语义。
5. `particles3` 继续保留 GID `69361` marker 和未消费诊断；cars、footsteps 继续只保留 marker/数据。
6. renderer 对 raw particle Tilemap 使用现有 chunk-owned layer 生命周期；write、clear、destroy 与 World 的 24 层原子回滚合同保持一致。
7. 新增资源合同、raw visual、未知 GID 回滚、marker 边界和 destroy 回归测试。

未实现车辆、NPC、路线、trajectory、footprint Sprite、抗议者或其他动态消费者；未替换 exterior atlas。

## 3. 检查与结果

独立验证窗口逐条执行任务卡规定命令：

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm test -- --run` | PASS，33 个测试文件 / 170 项测试 |
| `npm run prepare:runtime` | PASS |
| `npm run check:runtime` | PASS |
| `npm run build` | PASS，45 modules |
| `npm run build:test-hooks` | PASS，45 modules |
| `npm run check:perf-baseline-evidence` | PASS，9 groups / 27 samples，FPS 样本范围 25.6–60.7 |
| `git -c core.whitespace=cr-at-eol diff --check` | PASS |

额外核对：

- 粒子 PNG 为 `112x16`，运行资源与公开证据大小一致。
- 27 份 runtime 地图 JSON 均无 external tileset 引用，并各含一个受限内联 `tileset-particles`。
- `particles` / `particles2` 只保留 `69355–69359`；`69360` 残留为 0。
- 目标集合与 baseline 文件无 diff；27/27 样本的 target/rendered/stable 收据继续通过。
- `CampusScene.ts`、`package.json`、共享 Smoke、权威文档和 `sample/` 无 diff。

主窗口尝试直接运行组合检查和定向 `npx vitest` 时，命令被 WSL 沙箱白名单拒绝；未尝试绕过。上述正式结果由只读验证窗口逐条执行原命令取得。

## 4. 失败与销毁边界

### 资源失败

- 公开粒子图片缺失、复制后大小不一致、PNG 尺寸不是 `112x16` 时，`check:runtime` 失败。
- external tileset 未消除、内联 metadata 缺失/重复/字段不符时，`check:runtime` 失败。
- raw particle 层出现 `69360` 或任何非 `69355–69359` 的非零 GID 时，资源检查失败。
- cars、particles3、footsteps 出现各自白名单外的非零 GID 时，资源检查失败。

### Apply 失败

- renderer 对 `particles` / `particles2` 写入前校验 raw GID。
- 未知 GID（含 `69360`）抛出带 layer、local tile 和 gid 的错误。
- World 将当前已尝试层纳入补偿清理；测试确认失败后 Tilemap layer、marker 和 diagnostics 均无残留，chunk 不登记成功。

### Remove 与 shutdown

- 24 层仍按现有 World 合同对称 apply/remove；不复制原站只卸载 11 层的路径。
- raw particle visual clear 销毁该 chunk 的 Tilemap layer；cars/particles3/footsteps clear 撤销该 chunk marker/diagnostic。
- remove 中任一层失败时，现有 World 合同回写已清层并保留 chunk 登记，不留下已确认的半清状态。
- renderer `destroyAsync()` 保持幂等，清理 Tilemap layers、marker、diagnostics、roof/collision 状态并销毁 Tilemap。
- coordinator 请求取消、mutation idle 和既有 shutdown 顺序未改；全量生命周期测试继续通过。

## 5. UNKNOWN 与风险

### 继续 UNKNOWN

- `69360` 的语义和消费者仍为 UNKNOWN（`Q-LAYER-003`）；本次仅按已接受运行资源合同清零，不关闭未知。
- `particles3` / GID `69361` 到 `protesters_rising` 或其他动态消费者的直接链路仍未证明（`Q-LAYER-002`）。
- 原站 HTTP cache/响应头、真实资源故障画面及完整 GPU/Scene teardown 仍未由本工作项证明。

### 风险与交接

- 本窗口按任务卡禁止修改 `CampusScene`。因此粒子图片的 Phaser preload、`addTilesetImage("tileset-particles", ...)` 和第三 tileset 注入仍需由 integration Main 在共享接线阶段完成；当前 renderer 与 runtime metadata 已具备接入条件。
- 本窗口未运行共享 browser Smoke；任务卡明确由 Main 在 integration 分支执行。当前 `ready-for-preview` 表示 M1 白名单实现和自动检查已就绪，不表示浏览器粒子视觉已经由 Human 验收。
- baseline 只证明当前 9 组/27 样本收据未退化，不能作为最终 FPS、GPU 或纹理内存门槛。

## 6. 状态结论

- 已讨论：M1 任务卡定义的资源、raw visual、24 层生命周期和回归边界。
- 已接受：`DEC-MAP-RUNTIME-COMPLETION-001` 授权范围。
- 已落盘：上述白名单代码、测试与本执行报告。
- 已验证：任务卡 7 项自动检查全部通过，白名单和禁止路径审计通过。
- 尚未解决：共享浏览器接线、Human 视觉预览、`Q-LAYER-002`、`Q-LAYER-003` 和最终性能门槛。

结论：`ready-for-preview`，按任务卡在此停止。

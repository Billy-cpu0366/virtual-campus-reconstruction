# WI-VISIBLE-CONTENT-WAVE-001：P3 实现完成报告

- **工作项**：`WI-VISIBLE-CONTENT-WAVE-001`
- **阶段**：P3 parallel implementation
- **状态**：`ready-for-integration`
- **基线**：`c2567b5ddd3e3d4a73d8533f089f127bf79562b2`，进入恢复实现时 clean
- **授权**：`DEC-VISIBLE-CONTENT-BRIDGE-001`、`DEC-VISIBLE-WAVE-P2-001`
- **范围**：只实现 03 内容线 registry 和对应测试；不修改 Main resolver、`src/game-ui/**`、`game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、API/系统卡、`sample/` 或旧 Phaser 项目

## 1. 本次实现

### 1.1 Evidence-backed registry

新增 `src/content/registry.ts` 和 `src/content/index.ts`：

- `VISIBLE_CONTENT_MENU_IDS` 明确限制为 `about`、`projects`、`memo1`–`memo6`；不为 CV、Contact、Technologies 猜测正文。
- `CONTENT_REGISTRY` 提供 About、Projects、Memo 1–6 的英文 `title`、逐字 `body` fallback 和结构化 `sections`。
- About sections 包含已确认头像、职位、四段英文介绍和 LinkedIn 外链。
- Projects sections 包含引导正文、三个项目正文/标签/图片/外链；图片路径与 Bundle/资源收据一致。
- Memo 1–6 包含 P1 核对的标题、正文和 `cardN_base.webp`；`card5_foil.webp` 不作为 required 资源。
- registry 和嵌套数组/对象通过本地深冻结；resolver/UI 可安全取得只读数据。

### 1.2 资源收据

`CONTENT_RESOURCE_RECEIPTS` 登记 10 个实际内容图片的公开来源、镜像 localPath、HTTP 200 状态和 SHA-256：头像、3 个 portfolio 图片、6 个 Memo base 图片。未修改 `sample/`，未登记 `card5_foil.webp` 或其它 unavailable 资源为 required。

本提交只登记已核对镜像成功文件的来源/哈希，不扩大 Main 的 runtime asset pipeline；最终浏览器资源可见性由 Main integration Gate 验收。

### 1.3 Memo 6 引导

`MEMO6_DISCOVERY_GUIDE` 是只读候选路线模型：

- start `(1088,304)`；target `(496,176)`；candidate end `(512,192)`。
- candidate route：left 36 tiles，再 up 7 tiles。
- `interactionDistancePx=30`，由既有 Zone 的严格 `<30px` 规则消费。
- `autoTeleport=false`、`autoOpenModal=false`、`markVisited=false`。

本模块不移动玩家、不打开 modal、不写 visited；实际真人路径和触发仍由 Main/Zone 集成验证。

## 2. 定向测试

新增 `tests/content/registry.test.ts`，共 6 项，覆盖：

1. registry 入口和 menuId 完整性；
2. About/Projects 正文、图片和链接映射；
3. Memo 1–6 标题、正文和 base 图片；
4. 资源 200/哈希/fallback 以及 foil unavailable 隔离；
5. registry、sections、资源收据和 Memo 6 guide 深冻结；
6. Memo 6 候选路线无传送/自动打开/visited 副作用。

定向命令：

```text
npm test -- tests/content/registry.test.ts tests/content/contract.test.ts tests/content/campus-content-resolver.test.ts
```

结果：3 files / 20 tests PASS。

## 3. 全量验证收据

- `npm run typecheck`：PASS。
- `npm test`：43 files / 255 tests PASS。
- `npm run build`：PASS；runtime asset check PASS，Vite production build PASS。
- 内容文件 CRLF-aware 检查：PASS，新增文件均 LF、无 CRLF。
- `sample/`、Main/UI/API/权威文件和 owner 外文件：未修改。

## 4. 未解决与交接边界

- **已实现/已验证**：03 内容 registry、sections、body fallback、资源收据、Memo 6 只读候选模型和定向/全量自动验证。
- **待 Main integration 验证**：默认 resolver 消费 registry 的最终接线、真实 DOM rich renderer、资源实际可服务性、正常 Play 后真人移动到 Memo 6、About/Projects/Memo 三类实际可见性。
- **保持 UNKNOWN**：完整 Slovak modal 正文、`card5_foil.webp` 的视觉降级、真人路径与实际碰撞的最终一致性。
- **禁止宣称**：本分支不使用 test hook 冒充真人可发现性，不把自动测试或本报告当作 Human 视觉 Gate。

## 5. 交付停止点

本分支完成 03 owner 范围后停在 `ready-for-integration`，不 push、不 PR、不修改 Main 文件，等待既定的 Main 串行接线和 Human 视觉验收。

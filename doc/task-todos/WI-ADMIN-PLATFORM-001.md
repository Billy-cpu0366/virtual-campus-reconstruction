---
work-item: WI-ADMIN-PLATFORM-001
status: authorized-for-spec
phase: admin-platform-a0-foundation
updated: 2026-10-19
authorization-ref: Human-2026-10-19-admin-platform-goal-alignment
---

# 校园内容与配置运营平台（后台管理系统）实施规格

> **给 Codex 的启动指令**
>
> 你在 `virtual-campus-reconstruction` 仓库里工作。先完整阅读本文件，再按 §12 的顺序执行。
> **本轮只做 §4 的范围**，不要实现 §17 的后续模块；**不要碰 §15 的禁止项**；不要自动 `commit` / `push`。
> 每完成一步就运行对应的验证命令；最后按 §16 的格式报告实际修改、实际命令和实际结果。

---

## 0. 开工前必须读的文件

按顺序读，读完再动手：

1. `AGENTS.md`（项目协议、配置工作八条规矩、当前阶段门禁）
2. `CLAUDE.md`（怎么跟本项目的 Human 协作；验证要求）
3. `config/README.md`（配置工作现状：16 板块、40 份配置）
4. `config/文档/配置方案.md`
5. `config/文档/配置格式规范.md`
6. `config/文档/换皮配置总表.md` 的「怎么读这张表」「三根轴」「配置点总览」三节
7. `config/骨架/公共/config-source.ts`
8. `config/骨架/公共/normalize-config-file.ts`
9. `config/骨架/公共/validate.ts`
10. `config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.ts` 与 `shapes.ts`
11. `vite.config.ts` 里 `configFiles()` 插件（理解配置在开发/构建时怎么被提供）

**不要**为了“了解项目”递归读整个仓库，也不要改 `sample/`。

---

## 1. 已对齐的目标（Human 2026-10-19 确认）

做一个 **校园内容与配置运营平台**：

```text
后台平台
└── 校园（一个学校 = 一个运营单元）
     ├── 皮肤/品牌        主题色、logo、页面壳、文案风格
     ├── 游戏配置          16 系统 / 40 份 JSON / 513 个配置点
     ├── 素材              贴图、音频、视频、地图、分块
     ├── 内容              公告、剧情、任务、活动……（以后扩展）
     ├── 发布              草稿 → 预览 → 线上 → 历史/回滚
     └── 人与记录          账号、权限、操作审计
```

已确认的六条边界：

1. **一个后台管多个校园**，校园是最高一层；每个校园有独立的配置、素材、内容、发布历史。
2. **配置点分两种编辑形态**：单个值用表单，多实例用表格。
3. **素材文件和素材配置点要打通**，能互相查“谁在用谁”。
4. **公告、剧情等内容也归后台管**，但它们可以有独立的数据结构和编辑器，不必硬塞进 40 份配置 JSON。
5. **所有改动都要经过“草稿 → 预览 → 发布 → 可回滚”**，不能点一下保存就影响线上。
6. **后台骨架统一，内容模块可插拔**；以后加任务、活动，不再重做底层。

本轮只验证第 1、2、5 条里最窄的一条竖切；第 3、4、6 条留到后续阶段。

---

## 2. 产品边界（本轮只做“骨架 + 一条竖切”）

### 后台是什么

一个能安全读写校园配置文件的工具，外加账号、审计、版本和发布。

### 后台不是什么

- 不是游戏运行时的一部分。游戏仍然只读静态 JSON，**不得新增对后台服务的依赖**。
- 不是 WorkAdventure 的宇宙/世界/房间/成员/封禁后台。不要照搬那个仓库的业务模型。
- 不是完整游戏编辑器。地图编辑、剧情编排、任务系统都不在本轮。

### 参考项目怎么用

可参考 `BAWES-Universe/workadventure-universe-admin` 的**工程套路**：

- Next.js App Router + Route Handlers
- Prisma 关系模型
- 权限位标记
- 路由表 / 面包屑
- 草稿保留
- 存储适配层

**不要复制它的业务对象和代码。** 该仓库未看到 LICENSE，业务对象也和我们无关。

---

## 3. 总体架构

```text
浏览器
├── 游戏静态站
│     └── 只读 /config/<集名>/*.json（运行时 fetch，现有行为不变）
│
└── 管理后台（独立的 Next.js 应用，位于 admin/）
      ├── 读 config/骨架 里现成的 Spec / loader
      │     → 校验规则只有一份
      ├── 草稿目录 → 预览集 → 发布到 config/<校园>
      └── SQLite：只存账号、校园元数据、版本索引、审计
```

三条硬原则：

1. **配置文件是配置值的唯一真相。** 数据库不存配置正文。
2. **校验只有一份。** 复用 `config/骨架` 里的 `Spec`、`validate()`、各系统 `load*Configs()`，不另写一套规则。
3. **发布是整批原子替换。** 40 份文件同时加载，缺一份游戏起不来；发布必须全量校验 + 快照 + 整批替换，不能写一半。

---

## 4. 本轮（A0）范围

### 4.1 必须交付

一个能跑起来的后台，包含：

1. **登录**：账号密码，服务端会话；首个管理员由环境变量初始化。
2. **校园列表**：扫描 `CONFIG_ROOT` 下的配置集目录；显示已发布/草稿状态；`default/` 标记为只读基准。
3. **从 default 新建校园**：复制 `default/` 到草稿区，集名符合现有白名单 `^[a-z0-9_-]{1,64}$`。
4. **配置文档树**：按 `板块 / 系统 / 文件` 展示草稿里的所有 `.json`。
5. **JSON 编辑器**：读取、修改、格式化、保存草稿；保存前做 JSON 解析和校验。
6. **校验**：
   - 每份文件都做 `normalizeConfigFile()` 信封检查；
   - 对已登记的系统（本轮只有 `SYS-PLAYER`）调用 `loadPlayerConfigs()`，复用全部语义校验；
   - 整套校验：以 `config/default` 的文件清单为准，检查目标校园是否齐全。
7. **预览**：把草稿物化成 `CONFIG_ROOT/_preview-<校园>/`，返回可点击的 `GAME_ORIGIN/?config=_preview-<校园>`。
8. **发布**：全量校验 → 快照当前 `config/<校园>` → 整批替换 → 可选同步 `PUBLISH_ROOT/<校园>`。
9. **回滚**：列出发布快照，选择一份恢复；恢复也走“全量校验 + 快照 + 替换”。
10. **审计**：记录登录、保存草稿、预览、发布、回滚、新建校园；记录操作者、时间、文件、前后哈希。
11. **路径安全**：拒绝 `..`、绝对路径、符号链接、非法集名；所有写入限制在配置根内。
12. **测试**：路径安全、原子写、草稿覆盖、校验、发布、回滚各有用例。

### 4.2 本轮竖切验收路径（必须真的走通）

用 `set1`（或新建 `test-campus`）：

1. 登录后台。
2. 选中一个校园，打开 `02-玩法线/SYS-PLAYER/数据/player-config.json`。
3. 把 `displaySize` 从 `48` 改成 `56`，保存草稿。
4. 点“预览”，打开 `GAME_ORIGIN/?config=_preview-<校园>`，**刷新后玩家明显变大**。
5. 把 `displaySize` 改成 `99999` 再保存，**必须被校验拦下**（`pixel` 单位上限 2240），并显示字段路径。
6. 改回 `56`，执行“发布”。
7. 打开 `GAME_ORIGIN/?config=<校园>`，刷新后玩家仍然变大。
8. 打开“历史版本”，回滚到发布前；再刷新，玩家恢复原大小。
9. 打开“审计”，能看到上述每一步。
10. 尝试把 `default` 设为可编辑或保存，**必须被拒绝**。

> 如果本机没有运行游戏，第 4/7/8 步可以改为：检查 `config/_preview-<校园>/.../player-config.json` 与 `config/<校园>/.../player-config.json` 的实际内容是否正确；但必须在报告里写明“未做浏览器视觉验收”。

### 4.3 本轮不实现

- 表单自动生成（A1）
- 40 份文档的逐字段中文标签（A1）
- 与 default 的结构化 diff / 全站搜索（A1）
- 素材上传、贴图规格、地图/分块管理（A2）
- 公告、剧情、任务等内容模块（A3+）
- 多角色权限矩阵（A4；本轮只区分“已登录/未登录”，数据模型预留 role）
- 远程部署钩子、对象存储、Redis

---

## 5. 目录结构

新建独立应用 `admin/`，**不要改根目录的 `package.json`**。

```text
virtual-campus-reconstruction/
├── admin/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts            # 如使用 Tailwind
│   ├── prisma/
│   │   └── schema.prisma
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # 登录后跳转 /admin
│   │   ├── login/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx            # 侧边栏 + 顶部栏
│   │   │   ├── page.tsx              # 总览
│   │   │   ├── campuses/page.tsx     # 校园列表
│   │   │   ├── campuses/[slug]/page.tsx
│   │   │   ├── campuses/[slug]/documents/[...path]/page.tsx
│   │   │   ├── campuses/[slug]/revisions/page.tsx
│   │   │   ├── audit/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── admin/...             # 见 §9
│   ├── components/
│   │   ├── json-editor.tsx
│   │   ├── document-tree.tsx
│   │   ├── validation-report.tsx
│   │   └── status-badge.tsx
│   ├── lib/
│   │   ├── paths.ts                  # 集名白名单、路径解析与越界检查
│   │   ├── config-store.ts           # 读/写/复制/原子替换/快照
│   │   ├── disk-config-source.ts     # 实现 ConfigSource，供 load*Configs 使用
│   │   ├── validate-set.ts           # 单文件 + 整套校验
│   │   ├── publish.ts                # 预览、发布、回滚
│   │   ├── auth.ts                   # Auth.js 配置
│   │   ├── audit.ts
│   │   ├── db.ts                     # Prisma client
│   │   └── constants.ts
│   ├── admin-data/                   # 运行时生成，加入 .gitignore
│   │   ├── admin.db
│   │   ├── drafts/<校园>/
│   │   ├── revisions/<校园>/<时间戳>-<id>/
│   │   └── locks/
│   └── __tests__/
│       ├── paths.test.ts
│       ├── config-store.test.ts
│       ├── validate-set.test.ts
│       ├── publish.test.ts
│       └── api-auth.test.ts
└── config/                           # 现有目录，不移动、不重排
```

`admin/admin-data/`、`admin/.next/`、`admin/node_modules/` 必须写进新建的 `admin/.gitignore`。

---

## 6. 技术栈

| 项 | 要求 |
|---|---|
| 运行时 | Node.js 22（根项目 `engines` 已要求 `>=22 <23`） |
| 框架 | Next.js App Router（优先 16 稳定版；装不到就用当前最新稳定版并记录版本） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS；不强制引入组件库，原生表单 + 少量本地组件即可 |
| 数据库 | SQLite + Prisma |
| 登录 | Auth.js（NextAuth）Credentials Provider，JWT 会话 |
| 密码哈希 | `bcryptjs`（纯 JS，避免 Windows 原生编译问题） |
| 测试 | Vitest（与根项目一致） |
| 包管理 | npm |

**不要**引入 Redis、S3、队列、GraphQL、tRPC；本轮用不到。

### 与现有配置代码的引用方式

后台需要 import：

```ts
import { normalizeConfigFile } from "../../config/骨架/公共/normalize-config-file.js";
import { validate } from "../../config/骨架/公共/validate.js";
import { loadPlayerConfigs } from "../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";
```

处理顺序：

1. 先在 `admin/tsconfig.json` 使用 `"moduleResolution": "Bundler"`，允许 `.js` 后缀映射到 `.ts`。
2. 如 Next.js 报“不能引用 root 之外的源码”，在 `admin/next.config.ts` 设置 `experimental: { externalDir: true }`。
3. 如果仍然不行，**不要复制一份 Spec**。改为在 `admin/lib/` 写一个极薄的再导出文件，或把 `config/骨架` 加进 TypeScript 的 `include`；在报告里写明实际采用的方式和原因。

---

## 7. 数据模型

`admin/prisma/schema.prisma`：

```prisma
model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         String   @default("admin")   // admin | editor | viewer（本轮只用到 admin）
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model CampusMeta {
  slug        String   @id
  displayName String
  status      String   @default("draft")    // draft | active | archived
  basedOn     String?                        // default | 其他校园
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Revision {
  id          String   @id @default(cuid())
  campusSlug  String
  kind        String                         // publish | rollback | manual
  number      Int
  dir         String                         // 相对 ADMIN_DATA_ROOT 的快照目录
  fileCount   Int
  createdBy   String
  note        String?
  createdAt   DateTime @default(now())

  @@unique([campusSlug, number])
  @@index([campusSlug, createdAt])
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String                         // login | save-draft | preview | publish | rollback | create-campus
  campusSlug String?
  path       String?
  beforeHash String?
  afterHash  String?
  detail     String?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([campusSlug, createdAt])
  @@index([action, createdAt])
}
```

**配置正文不进数据库。** `CampusMeta` 只存显示名、状态等元数据；配置内容在磁盘。

---

## 8. 存储层规则（最容易写出事故的部分）

### 8.1 路径与集名

- 集名必须匹配现有白名单 `^[a-z0-9_-]{1,64}$`。直接复用 `config/骨架/公共/config-location.ts` 的 `isConfigSetName`，不要另写正则。
- 所有路径先 `path.resolve()`，再检查结果以“配置根 + 分隔符”开头；不满足直接拒绝。
- 拒绝绝对路径、`..` 段、空段。
- 写入前 `lstat` 目标；如果是符号链接，拒绝。
- URL 里的中文目录名按“逐段 `encodeURIComponent` / `decodeURIComponent`”处理，不要把整条路径一次性编码。

### 8.2 三个目录

```text
CONFIG_ROOT/<校园>/                 已发布（游戏线上读这里）
ADMIN_DATA_ROOT/drafts/<校园>/      草稿（游戏不读）
ADMIN_DATA_ROOT/revisions/<校园>/   历史快照
```

- `default/` **永远只读**。后台可以列出、预览、复制，但不能保存、不能发布覆盖。
- 新建校园：把 `CONFIG_ROOT/default/` 完整复制到 `ADMIN_DATA_ROOT/drafts/<新集名>/`；此时还没有已发布目录。
- 第一次编辑某个已有校园：如果草稿不存在，把 `CONFIG_ROOT/<校园>/` 完整复制到草稿区。**草稿一定是整套齐全的**，否则整套校验没有意义。
- 保存草稿：只写 `ADMIN_DATA_ROOT/drafts/<校园>/<相对路径>`。
- 游戏永远不会读草稿区。

### 8.3 原子写

单个文件：

1. 写 `目标文件.tmp-<随机串>`（同目录）
2. `fsync`（如实现方便）
3. `fs.rename(tmp, 目标文件)`

整目录替换（发布/回滚）：

1. 在配置根下建 `.<校园>.publish-tmp-<随机串>/`，把草稿完整复制进去。
2. 把当前 `CONFIG_ROOT/<校园>` 重命名为 `.<校园>.old-<随机串>`。
3. 把临时目录重命名为 `CONFIG_ROOT/<校园>`。
4. 成功后再删除旧目录；如果第 3 步失败，把旧目录改回来，并报错。
5. 整个过程持有 `ADMIN_DATA_ROOT/locks/<校园>.lock`（`fs.open(..., 'wx')`，超过 10 分钟视为陈旧锁，允许清理并记录）。

**保存草稿的并发保护（A0 必须做，不是可选）：**

- `GET /api/admin/campuses/[slug]/documents/[...path]` 返回内容时，同时返回该文件的 `sha256`。
- `PUT` 同一个路径时，请求体必须带 `baseHash`。
- 保存前对比当前草稿文件的哈希：
  - 一致 → 写入；
  - 不一致 → 返回 `409 STALE_WRITE`，提示“这份文件已被其他人修改”，并返回当前哈希；**不得静默覆盖**。
- 首次保存（草稿文件还不存在）时，`baseHash` 取已发布文件的哈希；还没有已发布文件时允许为空。

这是多人同时使用的最低保障：不同文件可以并行改，同一文件后保存的人会收到冲突提示。

### 8.4 文件格式

- 写出 JSON 用 **2 空格缩进 + 末尾换行**，与现有文件一致。
- 必须保留 `meta` 和 `data` 两个顶层字段，顺序为 `meta` 在前。
- 如果解析后的语义内容与原文完全相同，**不要写盘**，避免无意义的格式变更和审计噪音。
- 保存前拒绝超过 2 MB 的单份 JSON。

---

## 9. API（Route Handlers）

统一返回：

```json
{ "ok": true, "data": {} }
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [] } }
```

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/api/auth/[...nextauth]` | Auth.js |
| `GET` | `/api/admin/campuses` | 列出已发布/草稿校园、状态、最后发布时间 |
| `POST` | `/api/admin/campuses` | 从 `default` 新建校园（body: `{slug, displayName}`） |
| `GET` | `/api/admin/campuses/[slug]/documents` | 文档树（相对路径、大小、是否有草稿改动、校验状态） |
| `GET` | `/api/admin/campuses/[slug]/documents/[...path]` | 读取草稿（没有草稿则读已发布） |
| `PUT` | `/api/admin/campuses/[slug]/documents/[...path]` | 保存草稿 |
| `POST` | `/api/admin/campuses/[slug]/validate` | 整套校验，返回逐文件结果 |
| `POST` | `/api/admin/campuses/[slug]/preview` | 物化预览集，返回预览 URL |
| `POST` | `/api/admin/campuses/[slug]/publish` | 发布（body: `{note?}`） |
| `GET` | `/api/admin/campuses/[slug]/revisions` | 版本列表 |
| `POST` | `/api/admin/campuses/[slug]/revisions/[id]/restore` | 回滚到某版本 |
| `GET` | `/api/admin/audit` | 审计列表（分页、按校园/动作过滤） |

所有 `/api/admin/*` 必须检查会话；未登录返回 401。所有写操作必须做 CSRF 防护：校验 `Origin`/`Host` 同源，或使用 Auth.js 的 CSRF token。

---

## 10. 页面

### `/login`

- 邮箱 + 密码。
- 错误信息不要区分“账号不存在”和“密码错误”。

### `/admin`（总览）

- 校园数量、草稿数量、最近发布、最近操作。
- 不追求图表；本轮以列表和状态为主。

### `/admin/campuses`

- 卡片或表格：集名、显示名、状态（草稿/已发布）、最后发布时间、最后修改人。
- `default` 卡片带“只读基准”标记，只提供“复制为新校园”。
- “新建校园”按钮。

### `/admin/campuses/[slug]`

- 左侧：文档树，按 `01-地图线 / 02-玩法线 / ... / 06-网络协议层` 分组。
- 右侧：当前文档编辑区。
- 顶部按钮：保存草稿、整套校验、预览、发布、历史版本。
- 显示“草稿与已发布不同”的提示。

### `/admin/campuses/[slug]/documents/[...path]`

- 文本编辑器（`<textarea>` 即可）+ “格式化”按钮。
- 保存后显示校验结果；失败时列出字段路径。
- 提供“恢复为已发布版本”按钮（仅覆盖草稿，不影响线上）。

### `/admin/campuses/[slug]/revisions`

- 版本号、时间、操作者、说明、文件数。
- “回滚到这里”按钮，二次确认。

### `/admin/audit`

- 表格：时间、操作者、动作、校园、文件、前后哈希、IP。
- 分页与简单过滤。

### `/admin/settings`

- 只读展示当前环境变量（隐藏密钥）。
- 显示配置根、发布根、数据根、游戏地址。

---

## 11. 校验与发布算法

### 11.1 单文件校验

```ts
// 伪代码
const raw = JSON.parse(text);
const file = normalizeConfigFile(relativePath, raw);   // 信封 + meta
if (relativePath in REGISTERED_LOADERS) {
  await REGISTERED_LOADERS[relativePath](new DiskConfigSource(draftRoot));
}
```

- `REGISTERED_LOADERS` 本轮只登记：
  - `02-玩法线/SYS-PLAYER/数据/player-config.json` → `loadPlayerConfigs`
- `DiskConfigSource implements ConfigSource`：`read(key)` 从草稿根读，若草稿不存在则从已发布根读，返回 `{ meta, data }`。
- 未登记的文件只做 `normalizeConfigFile`；在 UI 上明确标注“本轮只校验信封，字段级校验尚未接入”。

### 11.2 整套校验

1. 递归列出 `CONFIG_ROOT/default/` 下所有 `.json`，得到“标准文件清单”。
2. 检查草稿里是否存在清单中的每一个文件；缺任何一个 → 失败，列出缺失项。
3. 多出来的文件 → 警告，不阻断（在报告中列出）。
4. 对每份文件跑 11.1。
5. 返回：

```json
{
  "ok": true,
  "data": {
    "fileCount": 40,
    "missing": [],
    "extra": [],
    "errors": [],
    "warnings": []
  }
}
```

### 11.3 预览

1. 整套校验必须通过。
2. 把草稿完整复制到 `CONFIG_ROOT/_preview-<校园>/`。
3. 集名长度检查：`_preview-` 前缀 + 校园名不得超过 64 字符；超了返回明确错误。
4. 返回 `GAME_ORIGIN/?config=_preview-<校园>`。
5. 旧预览目录可在成功后清理（至少保留最近一份）。

### 11.4 发布

1. 获取校园锁。
2. 整套校验，不通过直接返回错误。
3. 给当前已发布目录拍快照到 `ADMIN_DATA_ROOT/revisions/<校园>/<时间戳>-<id>/`；如果还没有已发布目录（新建校园首次发布），跳过这一步。
4. 用 8.3 的整目录替换，把草稿发布到 `CONFIG_ROOT/<校园>/`。
5. 如配置了 `PUBLISH_ROOT`，把同一份内容同步到 `PUBLISH_ROOT/<校园>/`；同步失败时返回 `PARTIAL_PUBLISH`，说明“源目录已更新、发布目标未更新”，并保留回滚入口。
6. 写 `Revision`、`AuditLog`。
7. 释放锁。

### 11.5 回滚

1. 读取指定 revision 目录。
2. 校验快照完整（对比 `fileCount`）。
3. 走与发布相同的“快照当前 → 整目录替换”流程。
4. `Revision.kind = "rollback"`，`note` 写明回滚到哪个版本。

---

## 12. 实施顺序（Codex 按这个顺序做）

1. **读文档与代码**：完成 §0。
2. **搭骨架**：创建 `admin/`、`package.json`、`tsconfig.json`、`next.config.ts`、Tailwind、Prisma、`.gitignore`；确认 `npm run dev` 能启动空页面。
3. **存储层**：`paths.ts`、`config-store.ts`、`disk-config-source.ts`；先写测试，再实现。
4. **校验层**：`validate-set.ts`；登记 `SYS-PLAYER` loader；用临时目录写测试。
5. **发布层**：`publish.ts`；实现预览、发布、回滚、锁、快照；写测试。
6. **数据库与登录**：Prisma schema、迁移、首管理员初始化、Auth.js、会话保护。
7. **API**：按 §9 实现；每个写接口加审计。
8. **页面**：按 §10 实现；先保证能用，不做视觉打磨。
9. **竖切验收**：按 §4.2 真的走一遍，记录实际结果。
10. **全量验证**：

```bash
cd admin
npm run typecheck
npm run test
npm run build
```

11. **按 §16 报告**。

每一步不要跳。存储层和发布层的测试没绿之前，不要开始写页面。

---

## 13. 验收标准（全部满足才算完成）

### 功能

- [ ] 登录、登出正常；未登录访问 `/admin/*` 被重定向到登录页。
- [ ] 能列出 `default`、`set1` 和新建的校园。
- [ ] 能从 `default` 新建一个校园，草稿完整。
- [ ] 能打开并保存 `player-config.json` 草稿。
- [ ] 非法 JSON、缺 `meta`、字段类型错误、数值越界都会被拦下，并显示字段路径。
- [ ] 预览集能生成，URL 能打开；预览不影响已发布目录。
- [ ] 发布后 `CONFIG_ROOT/<校园>/` 内容与草稿一致。
- [ ] 回滚后内容恢复到指定版本。
- [ ] 审计能查到保存、预览、发布、回滚。
- [ ] `default` 的保存/发布被拒绝。
- [ ] `../`、绝对路径、符号链接、非法集名全部被拒绝。

### 约束

- [ ] 未修改 `src/`、`game/`、`config/default/`、`config/set1/`、`dist/`、`sample/`。
- [ ] 未修改根 `package.json`。
- [ ] 未新增游戏运行时对后台的依赖。
- [ ] 未复制参考仓库代码。
- [ ] 未自动 `commit` / `push`。

### 验证命令

```bash
cd admin
npm run typecheck
npm run test
npm run build
```

三条都必须退出码 0。把实际输出摘要写进报告。

---

## 14. 测试要求

至少覆盖：

1. **paths**：合法集名、非法集名、`..`、绝对路径、前缀相同但越界的路径（如 `/config-evil`）、符号链接。
2. **config-store**：原子写、覆盖、复制整套、跳过语义未变化的写入、2 MB 上限。
3. **validate-set**：缺文件、多文件、非法 JSON、缺 meta、`displaySize` 越界（`99999`）、合法值。
4. **publish**：快照数量、发布内容、发布失败回滚、锁冲突、`PUBLISH_ROOT` 同步失败返回 `PARTIAL_PUBLISH`。
5. **api-auth**：未登录 401 / 重定向；CSRF 来源校验。
6. **竖切集成测试**：用临时 `CONFIG_ROOT`，复制一个最小 `default`（只放 `player-config.json`），走“保存 → 预览 → 发布 → 回滚”。

测试必须使用临时目录，不得读写真实的 `config/`。

---

## 15. 禁止项

1. 不修改 `src/`、`game/`、`config/default/`、`config/set1/`、`dist/`、`sample/`、根 `package.json`。
2. 不把配置正文存进数据库。
3. 不复制一份 `Spec` 或校验规则到 `admin/`；必须引用 `config/骨架`。
4. 不新增游戏运行时对后台的依赖；游戏仍然只读静态 JSON。
5. 不实现公告、剧情、任务、素材上传、地图编辑（后续阶段）。
6. 不照搬 WorkAdventure 的宇宙/世界/房间/成员/封禁/Bot/头像。
7. 不自动 `commit`、`push`、创建 PR 或合并。
8. 不把密钥、密码、数据库文件提交进仓库。

---

## 16. 交付报告格式

完成后按下面结构报告，**只写实际发生的事**：

```text
## 1. 实际修改文件
（逐条列路径；新增/修改分开）

## 2. 实际运行的命令与结果
（命令 + 退出码 + 关键输出）

## 3. 竖切验收结果
（§4.2 的 10 步，逐步写“通过/未通过/未验证”及证据）

## 4. 与规格的偏差
（没有就写“无”；有就写清原因和影响）

## 5. 未完成/未验证
（不要用“应该可以”掩盖）

## 6. 已知风险
（例如：Next 引用 root 外源码的兼容处理、Windows 目录 rename 行为）
```

---

## 17. 后续阶段（本轮不实现，只留接口方向）

| 阶段 | 内容 | 为什么排在这里 |
|---|---|---|
| **A1 表单化** | 配置元数据（中文名/提示/分组/控件）、自动表单、实例表格、与 default 的 diff、全站搜索 | 需要 A0 的读写与校验地基 |
| **A2 素材与地图** | 素材上传、贴图规格、素材引用关系、地图/分块替换 | 先把“值”管住，再管“文件” |
| **A3 内容模块** | 公告栏（定时上下线、面向校园/区域）；内容发布包导出 | 公告是最简单的结构化内容，用来验证内容管线 |
| **A4 剧情/玩法** | 对话树、触发条件、前置条件、任务/活动；独立的校验器（断头分支、不可达节点） | 结构复杂，必须等骨架稳定 |
| **A5 运营与权限** | 多角色权限、审批流、远程发布、监控与统计 | 有团队和线上量之后再上 |

后续模块统一遵守：

1. 自己声明数据结构与校验；
2. 自己声明编辑界面；
3. 自己声明发布后导出成什么；
4. 挂在同一套“校园 → 草稿 → 预览 → 发布 → 回滚 → 审计”骨架上。

---

## 18. 已知风险与处理

| 风险 | 处理 |
|---|---|
| Next.js 引用 `admin/` 之外的 TS 源码 | 先试 `externalDir` / tsconfig include；不行就写薄再导出文件；**绝不复制 Spec** |
| Windows 上目录 rename 可能因文件占用失败 | 捕获错误，回退旧目录，返回明确错误；测试覆盖 |
| 多人同时改同一份文件 | A0 必须实现 `baseHash` 乐观锁（§8.3）：冲突返回 `409 STALE_WRITE`，不静默覆盖；发布另有校园级锁 |
| `default` 被误改 | 存储层硬编码只读判断；API 与 UI 双重拒绝；测试覆盖 |
| 预览集残留 | 每次预览成功后清理旧 `_preview-*`，保留最近一份 |
| 同步 `PUBLISH_ROOT` 失败 | 返回 `PARTIAL_PUBLISH`，不得报告“发布成功” |
| 配置目录含中文名 | 路径逐段编码/解码；测试用中文路径 |

---

## 19. 环境变量

```env
# 必填
AUTH_SECRET=至少32位随机字符串
CONFIG_ROOT=../config
ADMIN_DATA_ROOT=./admin-data
GAME_ORIGIN=http://localhost:4175

# 首次启动初始化管理员（仅在数据库没有用户时使用）
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=请改成强密码

# 可选
PUBLISH_ROOT=../dist/config
ADMIN_DB=./admin-data/admin.db
MAX_JSON_BYTES=2097152
LOCK_STALE_MS=600000
KEEP_REVISIONS=50
```

- `CONFIG_ROOT` 与 `ADMIN_DATA_ROOT` 的相对路径以 `admin/` 为基准。
- 生产环境必须使用 HTTPS；会话 Cookie 设 `httpOnly`、`sameSite=lax`、`secure`。
- `.env*` 加入 `admin/.gitignore`；提供 `.env.example`，不提供真实密钥。

---

## 20. 多人使用与数据可见性（A0 的实际行为）

这一节回答两个必须提前说清的问题：**能不能多人同时登录**，以及**数据到底存在哪、谁能看见**。

### 20.1 能不能多人同时登录

**能，但前提是大家访问同一个已部署的后台地址。**

- `AdminUser` 每行一个账号；Auth.js 给每个浏览器独立的会话 Cookie。A 登录不会把 B 踢下线，也没有“单点登录/单会话”限制。
- 如果每个人各自在自己电脑上 `npm run dev`，那是各自的 SQLite 文件和各自的本地配置目录，**互相看不见，不是共享系统**。
- A0 的所有账号 `role` 默认 `admin`，权限相同；按校园分权、编辑者/发布者分离留到 A5。
- A0 不做审批流、不做实时协同编辑、不做“谁正在编辑”的在线状态。

### 20.2 信息存在哪

| 数据 | 存在哪 | 谁能看见 |
|---|---|---|
| 账号（邮箱、角色） | SQLite `admin.db` | 登录用户；设置页只显示邮箱/角色 |
| 密码 | SQLite，只存 bcrypt 哈希 | 任何人都看不到明文，包括管理员 |
| 校园元数据（显示名、状态） | SQLite | 登录用户 |
| 草稿配置 | 服务器磁盘 `ADMIN_DATA_ROOT/drafts/<校园>/` | 登录用户；**游戏不读** |
| 已发布配置 | 服务器磁盘 `CONFIG_ROOT/<校园>/` | 游戏公开读取；**任何知道 URL 的人都能 fetch** |
| 历史版本 | 磁盘快照 + SQLite 索引 | 登录用户 |
| 审计记录 | SQLite | 登录用户 |
| 素材 / 公告 / 剧情 | 后续阶段定义 | 后续阶段定义 |

### 20.3 “大家都能看见”分两层

**后台内部：共享。**

- 所有登录账号看到同一份校园列表、同一份草稿、同一份已发布内容。
- A0 **不按校园隔离权限**：只要有账号，就能看到所有校园。需要“张三只能管 A 校”时，等 A5。
- 多人改不同文件没问题；改同一文件时，按 §8.3 的 `baseHash` 返回冲突，不会静默覆盖。

**对外网：已发布内容是公开的，后台数据不是。**

- 游戏的配置是通过静态 URL `/config/<校园>/...` 取的，**已发布 JSON 本来就等于公开文件**。不要在里面写密钥、内部备注、未公开内容。
- 草稿、历史版本、审计、账号、密码哈希都不对公网开放，必须登录。
- 后台必须部署在需要登录的地址；不要把 `admin-data/` 或整个后台目录挂成静态站点。

### 20.4 A0 的多人边界（写清楚，避免误解）

- 支持：多个账号同时登录、查看、编辑不同文件。
- 支持：同一文件冲突检测（409），不静默覆盖。
- 不支持：实时看到别人正在输入的内容、自动合并、审批、按校园分权、账号自助注册。
- 不支持：两台各自独立部署的后台之间同步数据。

---

## 21. 与现有项目规则的关系

- 本轮新建的是独立 `admin/` 应用，不改 `src/` / `game/`，因此不触发项目“`src/` 写入门禁”。
- 但 `config/default/` 是复刻基准，**永久只读**。
- 本文件只是实施规格；正式 `DEC-` 记录和 `task_plan.md` 状态变更，等 Human 验收 A0 后再登记。
- 任何与本文冲突的项目规则，以 `AGENTS.md` 和 `doc/决策记录.md` 为准；发现冲突先停下并在报告中说明。

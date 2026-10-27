# 校园运营平台

独立 Next.js 后台。游戏仍然只读 `config/<集名>/` 静态 JSON。

需求、概要设计、详细设计和测试设计在 [`admin/doc/`](doc/README.md)；本文件只讲怎么启动和验证。

## 本地启动

1. 安装 Node.js 22（根项目与后台都要求 `>=22 <23`）。
2. 在 `admin/` 运行 `npm install`。
3. 复制 `.env.example` 为 `.env`，设置至少 32 位 `AUTH_SECRET` 和管理员邮箱、密码。
4. 运行 `npm run db:setup` 创建 SQLite 数据表并初始化首个管理员。
5. 运行 `npm run dev`，打开 `http://localhost:3000/login`。

`CONFIG_ROOT`、`ADMIN_DATA_ROOT`、`PUBLISH_ROOT` 的相对路径以 `admin/` 为基准。配置正文只写入磁盘草稿与快照；数据库存账号、校园元数据、版本索引和审计记录。

## 验证

```bash
npm run typecheck
npm run test
npm run build
```

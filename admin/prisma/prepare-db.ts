import { mkdir } from "node:fs/promises";
import path from "node:path";
async function main() {
  const dbFile = process.env.ADMIN_DB ?? path.join(process.env.ADMIN_DATA_ROOT ?? "./admin-data", "admin.db");
  await mkdir(path.dirname(path.resolve(dbFile)), { recursive: true });
  console.log(`数据库目录已准备：${path.dirname(path.resolve(dbFile))}`);
}
void main();

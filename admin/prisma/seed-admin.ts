import { hash } from "bcryptjs";
import { prisma } from "../lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error("请设置 ADMIN_EMAIL 和至少 12 位 ADMIN_PASSWORD");
  if (await prisma.adminUser.count() === 0) {
    await prisma.adminUser.create({ data: { email, passwordHash: await hash(password, 12), role: "admin" } });
    console.log(`首个管理员已创建：${email}`);
  } else console.log("已有管理员账号，未创建新账号");
  await prisma.$disconnect();
}
void main();

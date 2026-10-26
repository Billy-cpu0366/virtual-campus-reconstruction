import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.DATABASE_URL) {
  const dbFile = process.env.ADMIN_DB ?? path.join(process.env.ADMIN_DATA_ROOT ?? "./admin-data", "admin.db");
  process.env.DATABASE_URL = dbFile.startsWith("file:") ? dbFile : pathToFileURL(path.resolve(dbFile)).href;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

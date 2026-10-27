import type { NextRequest } from "next/server";
import { prisma } from "./db";

export async function audit(request: NextRequest, input: { userId?: string; action: string; campusSlug?: string; path?: string; beforeHash?: string | null; afterHash?: string | null; detail?: string }) {
  await prisma.auditLog.create({ data: {
    userId: input.userId, action: input.action, campusSlug: input.campusSlug, path: input.path,
    beforeHash: input.beforeHash ?? undefined, afterHash: input.afterHash ?? undefined, detail: input.detail,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  } });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "../auth";

export const success = (data: unknown, status = 200) => NextResponse.json({ ok: true, data }, { status });
export const failure = (code: string, message: string, status = 400, details?: unknown) => NextResponse.json({ ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });
export async function requireSession() {
  const session = await auth();
  return session?.user ? { session, userId: session.user.id } : null;
}
export function assertSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
export async function jsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try { const value: unknown = await request.json(); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
  catch { return null; }
}

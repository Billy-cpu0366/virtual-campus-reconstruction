import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials({
    credentials: { email: { type: "email" }, password: { type: "password" } },
    async authorize(credentials, request) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      const user = await prisma.adminUser.findUnique({ where: { email } });
      const valid = Boolean(user?.active && await compare(password, user.passwordHash));
      await prisma.auditLog.create({ data: {
        userId: valid ? user!.id : undefined, action: "login", detail: valid ? "success" : "failed",
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(), userAgent: request.headers.get("user-agent"),
      } }).catch(() => undefined);
      if (!valid || !user) return null;
      return { id: user.id, email: user.email, name: user.email, role: user.role };
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.sub = user.id; token.role = (user as { role?: string }).role; } return token; },
    session({ session, token }) { if (session.user) { session.user.id = token.sub ?? ""; (session.user as typeof session.user & { role?: string }).role = token.role as string | undefined; } return session; },
  },
});

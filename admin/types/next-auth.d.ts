import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; role?: string } & NonNullable<Session["user"]> }
}
declare module "next-auth/jwt" { interface JWT { role?: string } }

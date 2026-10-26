import Link from "next/link";
import { signOut } from "../../auth";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen md:flex"><aside className="w-full bg-slate-950 p-5 text-white md:min-h-screen md:w-60"><Link className="text-lg font-semibold" href="/admin">校园运营平台</Link><nav className="mt-8 grid gap-2 text-sm"><Link className="rounded px-3 py-2 hover:bg-slate-800" href="/admin/campuses">校园配置</Link><Link className="rounded px-3 py-2 hover:bg-slate-800" href="/admin/audit">操作审计</Link><Link className="rounded px-3 py-2 hover:bg-slate-800" href="/admin/settings">系统设置</Link></nav><form className="mt-8" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="text-sm text-slate-300">退出登录</button></form></aside><main className="min-w-0 flex-1 p-6 md:p-10">{children}</main></div>;
}

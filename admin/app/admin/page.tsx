import Link from "next/link";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/db";
import { adminDataRoot, configRoot } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [configEntries, draftEntries, published, recent] = await Promise.all([
    readdir(configRoot(), { withFileTypes: true }).catch(() => []),
    readdir(path.join(adminDataRoot(), "drafts"), { withFileTypes: true }).catch(() => []),
    prisma.revision.count({ where: { kind: "publish" } }),
    prisma.auditLog.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
  ]);
  const campuses = configEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_preview-")).length;
  const draftSlugs = new Set(draftEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const drafts = draftSlugs.size;
  return <><h1 className="text-3xl font-semibold">总览</h1><p className="mt-2 text-slate-600">管理校园配置、预览与发布记录。</p><section className="mt-8 grid gap-4 sm:grid-cols-3">{[["校园", campuses], ["草稿", drafts], ["发布记录", published]].map(([label, value]) => <article key={label} className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>)}</section><section className="mt-8 rounded-xl bg-white p-5"><div className="flex justify-between"><h2 className="font-semibold">最近操作</h2><Link className="text-blue-700" href="/admin/audit">查看审计</Link></div><ul className="mt-4 divide-y">{recent.map((item) => <li className="py-3 text-sm" key={item.id}>{item.action} · {item.campusSlug ?? "—"} · {item.createdAt.toLocaleString("zh-CN")}</li>)}</ul></section></>;
}

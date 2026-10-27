"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
type Campus = { slug: string; displayName: string; status: string; readOnly: boolean; published: boolean; draft: boolean; lastPublished: string | null; lastEditor: string | null };
export function CampusList() {
  const [items, setItems] = useState<Campus[]>([]), [error, setError] = useState("");
  async function load() { const res = await fetch("/api/admin/campuses"); const json = await res.json(); if (json.ok) setItems(json.data); else setError(json.error.message); }
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/campuses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: form.get("slug"), displayName: form.get("displayName") }) });
    const json = await res.json(); if (!json.ok) setError(json.error.message); else { event.currentTarget.reset(); await load(); }
  }
  return <><form onSubmit={create} className="my-6 flex flex-wrap gap-2 rounded-xl bg-white p-4"><input className="rounded border p-2" name="slug" placeholder="校园集名，如 set2" pattern="[a-z0-9_-]{1,64}" required /><input className="rounded border p-2" name="displayName" placeholder="显示名称" required /><button className="rounded bg-blue-700 px-4 text-white">从 default 新建</button></form>{error && <p className="mb-4 text-sm text-red-700">{error}</p>}<div className="overflow-hidden rounded-xl bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">校园</th><th className="p-3">集名</th><th className="p-3">状态</th><th className="p-3">最近发布</th><th className="p-3">最后修改人</th><th className="p-3">操作</th></tr></thead><tbody>{items.map((campus) => <tr className="border-t" key={campus.slug}><td className="p-3">{campus.displayName}</td><td className="p-3 font-mono">{campus.slug}</td><td className="p-3">{campus.readOnly ? "只读基准" : campus.published ? "已发布" : "草稿"}</td><td className="p-3">{campus.lastPublished ? new Date(campus.lastPublished).toLocaleString("zh-CN") : "—"}</td><td className="p-3">{campus.lastEditor ?? "—"}</td><td className="p-3">{campus.readOnly ? <span className="text-slate-400">复制以编辑</span> : <Link className="text-blue-700" href={`/admin/campuses/${encodeURIComponent(campus.slug)}`}>打开</Link>}</td></tr>)}</tbody></table></div></>;
}

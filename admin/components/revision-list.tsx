"use client";
import { useEffect, useState } from "react";
type Revision = { id: string; number: number; kind: string; note: string | null; fileCount: number; createdAt: string; createdBy: string };
export function RevisionList({ slug }: { slug: string }) {
  const [items, setItems] = useState<Revision[]>([]), [message, setMessage] = useState("");
  const [pending, setPending] = useState<Revision | null>(null);
  useEffect(() => { void fetch(`/api/admin/campuses/${encodeURIComponent(slug)}/revisions`).then((r) => r.json()).then((result) => result.ok ? setItems(result.data) : setMessage(result.error.message)); }, [slug]);
  async function restore(item: Revision) {
    const result = await fetch(`/api/admin/campuses/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(item.id)}/restore`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.json());
    setMessage(result.ok ? "回滚完成" : result.error.message); setPending(null);
  }
  return <><p className="my-4 text-sm text-slate-600">{message}</p>{pending && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">回滚到版本 {pending.number}？当前已发布内容会先保存为快照。<button className="ml-4 font-semibold text-blue-800" onClick={() => void restore(pending)}>确认回滚</button><button className="ml-3" onClick={() => setPending(null)}>取消</button></div>}<div className="overflow-hidden rounded-xl bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">版本</th><th className="p-3">时间</th><th className="p-3">操作者</th><th className="p-3">说明</th><th className="p-3">文件数</th><th className="p-3">操作</th></tr></thead><tbody>{items.map((item) => <tr className="border-t" key={item.id}><td className="p-3">{item.number} · {item.kind}</td><td className="p-3">{new Date(item.createdAt).toLocaleString("zh-CN")}</td><td className="p-3">{item.createdBy}</td><td className="p-3">{item.note ?? "—"}</td><td className="p-3">{item.fileCount}</td><td className="p-3"><button className="text-blue-700" onClick={() => setPending(item)}>回滚到这里</button></td></tr>)}</tbody></table></div></>;
}

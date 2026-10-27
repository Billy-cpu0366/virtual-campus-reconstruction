"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type FileInfo = { path: string; size: number; modified: boolean; validation: string };
type ApiResult = { ok: boolean; data: any; error: { message: string; details?: unknown } };
const api = async (url: string, init?: RequestInit): Promise<ApiResult> => fetch(url, init).then((response) => response.json());

export function JsonEditor({ slug, selected }: { slug: string; selected?: string }) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [current, setCurrent] = useState(selected ?? "");
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const base = `/api/admin/campuses/${encodeURIComponent(slug)}`;
  const fileUrl = (source?: string) => `${base}/documents/${current.split("/").map(encodeURIComponent).join("/")}${source ? `?source=${source}` : ""}`;

  const loadFiles = useCallback(async () => {
    const result = await api(`${base}/documents`);
    if (result.ok) {
      setFiles(result.data.files);
      if (!current && result.data.files[0]) setCurrent(result.data.files[0].path);
    } else setMessage(result.error.message);
  }, [base, current]);
  useEffect(() => { void loadFiles(); }, [loadFiles]);
  useEffect(() => {
    if (!current) return;
    void api(fileUrl()).then((result) => result.ok ? setText(JSON.stringify(JSON.parse(result.data.text), null, 2)) : setMessage(result.error.message));
  }, [base, current]);

  async function action(name: string, payload: unknown = {}) {
    setBusy(true); setMessage("");
    try {
      const result = await api(`${base}/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!result.ok) setMessage(`${result.error.message}${result.error.details ? ` · ${JSON.stringify(result.error.details)}` : ""}`);
      else if (name === "preview") { setMessage(`预览已生成：${result.data.url}`); window.open(result.data.url, "_blank", "noopener,noreferrer"); }
      else if (name === "validate") setMessage(result.data.ok ? `校验通过：${result.data.fileCount} 份文件` : `校验失败：${result.data.errors.map((item: { path: string; message: string }) => `${item.path}: ${item.message}`).join("；")}`);
      else setMessage(name === "publish" ? "发布完成" : "操作完成");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setMessage("");
    try {
      const result = await api(fileUrl(), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      setMessage(result.ok ? "草稿已保存并通过单文件校验" : `${result.error.message}${result.error.details ? ` · ${JSON.stringify(result.error.details)}` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function restorePublished() {
    const result = await api(fileUrl("published"));
    if (result.ok) { setText(JSON.stringify(JSON.parse(result.data.text), null, 2)); setMessage("已载入已发布版本；保存后才会覆盖草稿"); }
    else setMessage(result.error.message);
  }

  return <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">
    <aside className="rounded-xl bg-white p-4"><h2 className="font-semibold">配置文档</h2><ul className="mt-3 max-h-[65vh] overflow-auto">{files.map((file) => <li key={file.path}><button onClick={() => setCurrent(file.path)} className={`w-full break-all rounded px-2 py-2 text-left text-sm ${current === file.path ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"}`}>{file.path}{file.modified && <span className="ml-2 text-amber-700">· 草稿有改动</span>}</button></li>)}</ul></aside>
    <section className="min-w-0 rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{current || "选择一个文件"}</h2><Link className="text-sm text-blue-700" href={`/admin/campuses/${encodeURIComponent(slug)}/revisions`}>历史版本</Link></div>
        <div className="flex flex-wrap gap-2"><button disabled={busy || !current} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={save}>保存草稿</button><button disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => action("validate")}>整套校验</button><button disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => action("preview")}>预览</button>{confirmPublish ? <><span className="self-center text-sm">确认发布当前草稿？</span><button disabled={busy} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white" onClick={() => { setConfirmPublish(false); void action("publish"); }}>确认发布</button><button disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => setConfirmPublish(false)}>取消</button></> : <button disabled={busy} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white" onClick={() => setConfirmPublish(true)}>发布</button>}</div>
      </div>
      <textarea spellCheck={false} className="mt-4 min-h-[60vh] w-full rounded border p-3 font-mono text-sm" value={text} onChange={(event) => setText(event.target.value)} />
      <div className="mt-3 flex gap-3"><button className="rounded border px-3 py-2 text-sm" onClick={() => { try { setText(JSON.stringify(JSON.parse(text), null, 2)); setMessage("JSON 已格式化"); } catch { setMessage("JSON 格式错误，无法格式化"); } }}>格式化</button><button className="rounded border px-3 py-2 text-sm" onClick={() => void restorePublished()}>恢复为已发布版本</button></div>
      {message && <p className="mt-3 break-words text-sm text-slate-700">{message}</p>}
    </section>
  </div>;
}

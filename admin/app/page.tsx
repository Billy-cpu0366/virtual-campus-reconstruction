import Link from "next/link";

export default function Home() {
  return <main className="grid min-h-screen place-items-center"><section className="rounded-2xl bg-white p-10 shadow-sm"><p className="text-sm text-slate-500">校园内容与配置运营平台</p><h1 className="my-3 text-3xl font-semibold">管理后台已启动</h1><Link className="text-blue-700 underline" href="/login">进入登录</Link></section></main>;
}

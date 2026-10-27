export const dynamic = "force-dynamic";
export default function SettingsPage() {
  const rows = [["配置根", process.env.CONFIG_ROOT ?? "../config"], ["发布根", process.env.PUBLISH_ROOT ?? "未配置"], ["数据根", process.env.ADMIN_DATA_ROOT ?? "./admin-data"], ["数据库", process.env.ADMIN_DB ?? "./admin-data/admin.db"], ["游戏地址", process.env.GAME_ORIGIN ?? "http://localhost:4175"], ["AUTH_SECRET", process.env.AUTH_SECRET ? "已设置（内容隐藏）" : "未设置"], ["ADMIN_PASSWORD", process.env.ADMIN_PASSWORD ? "已设置（内容隐藏）" : "未设置"]];
  return <><h1 className="text-3xl font-semibold">系统设置</h1><p className="my-2 text-slate-600">当前进程读取的环境配置。</p><dl className="mt-6 divide-y rounded-xl bg-white px-5">{rows.map(([key, value]) => <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]" key={key}><dt className="text-slate-500">{key}</dt><dd className="break-all font-mono text-sm">{value}</dd></div>)}</dl></>;
}

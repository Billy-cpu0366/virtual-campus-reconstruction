import { JsonEditor } from "../../../../components/json-editor";
export default async function CampusEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <><h1 className="text-3xl font-semibold">校园配置：{decodeURIComponent(slug)}</h1><p className="mt-2 text-slate-600">编辑区只保存草稿；发布前会对照 default 做整套校验。</p><JsonEditor slug={decodeURIComponent(slug)} /></>;
}

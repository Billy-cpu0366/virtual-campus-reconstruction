import { RevisionList } from "../../../../../components/revision-list";
export default async function RevisionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <><h1 className="text-3xl font-semibold">历史版本：{decodeURIComponent(slug)}</h1><RevisionList slug={decodeURIComponent(slug)} /></>;
}

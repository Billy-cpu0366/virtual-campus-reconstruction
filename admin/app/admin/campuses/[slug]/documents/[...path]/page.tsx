import { JsonEditor } from "../../../../../../components/json-editor";
export default async function CampusDocumentPage({ params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params;
  return <><h1 className="text-2xl font-semibold">{decodeURIComponent(slug)}</h1><JsonEditor slug={decodeURIComponent(slug)} selected={path.map(decodeURIComponent).join("/")} /></>;
}

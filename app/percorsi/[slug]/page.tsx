import { notFound } from "next/navigation";
import { InternalPage } from "@/components/editorial/internal-pages";
import { paths } from "@/lib/editorial-content";
import { metadatiPagina } from "@/lib/seo";
export function generateStaticParams() {
  return paths.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = paths.find((x) => x.slug === slug);
  return p
    ? metadatiPagina({ titolo: p.title, descrizione: p.description, path: "/percorsi/" + slug })
    : {};
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!paths.some((x) => x.slug === slug)) notFound();
  return <InternalPage route={"percorsi/" + slug} />;
}

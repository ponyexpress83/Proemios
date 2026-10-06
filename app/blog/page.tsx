import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Guide editoriali",
  descrizione:
    "Guide pratiche su editing, impaginazione e pubblicazione. Le risposte alle prime domande di chi vuole trasformare un testo in un libro.",
  path: "/blog",
});
export default function Page() {
  return <InternalPage route="blog" />;
}

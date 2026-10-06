import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Servizi editoriali",
  descrizione:
    "Editing, correzione bozze, scrittura, copertina e pubblicazione: scegli il lavoro editoriale che serve al tuo libro.",
  path: "/servizi",
});
export default function Page() {
  return <InternalPage route="servizi" />;
}

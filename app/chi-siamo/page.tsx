import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Chi siamo",
  descrizione:
    "Conosci l’approccio di Proemios: confronto con l’autore, cura editoriale e responsabilità in ogni fase del libro.",
  path: "/chi-siamo",
});
export default function Page() {
  return <InternalPage route="chi-siamo" />;
}

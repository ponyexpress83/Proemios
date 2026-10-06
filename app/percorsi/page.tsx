import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Percorsi editoriali",
  descrizione:
    "Hai già scritto, parti da un’idea o vuoi raccontare la tua vita? Trova il percorso editoriale adatto al tuo punto di partenza.",
  path: "/percorsi",
});
export default function Page() {
  return <InternalPage route="percorsi" />;
}

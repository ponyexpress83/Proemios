import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Servizi editoriali",
  descrizione:
    "Un unico percorso editoriale, dall’idea al libro. Professionisti, cura e strumenti per seguire ogni fase.",
  path: "/servizi",
});
export default function Page() {
  return <InternalPage route="servizi" />;
}

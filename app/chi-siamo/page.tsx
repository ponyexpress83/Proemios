import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Chi siamo",
  descrizione:
    "Un unico percorso editoriale, dall’idea al libro. Professionisti, cura e strumenti per seguire ogni fase.",
  path: "/chi-siamo",
});
export default function Page() {
  return <InternalPage route="chi-siamo" />;
}

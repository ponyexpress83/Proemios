import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Casi studio",
  descrizione:
    "Un unico percorso editoriale, dall’idea al libro. Professionisti, cura e strumenti per seguire ogni fase.",
  path: "/casi-studio",
});
export default function Page() {
  return <InternalPage route="casi-studio" />;
}

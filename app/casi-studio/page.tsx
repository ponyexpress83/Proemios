import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Casi studio",
  descrizione:
    "Esplora un esempio dimostrativo del percorso editoriale, dal manoscritto alle consegne. I casi reali saranno pubblicati solo con autorizzazione.",
  path: "/casi-studio",
});
export default function Page() {
  return <InternalPage route="casi-studio" />;
}

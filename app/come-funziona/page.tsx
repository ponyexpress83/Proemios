import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Come funziona",
  descrizione:
    "Dal primo confronto alle consegne approvate: scopri le cinque fasi del percorso Proemios e come seguire il tuo progetto.",
  path: "/come-funziona",
});
export default function Page() {
  return <InternalPage route="come-funziona" />;
}

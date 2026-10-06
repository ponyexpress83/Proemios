import { AgencyForm } from "@/components/editorial/operational-pages";
import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Per agenzie",
  descrizione:
    "Servizi editoriali white-label per agenzie e publisher. Il tuo brand, un referente e un percorso coordinato per i tuoi clienti.",
  path: "/per-agenzie",
});
export default function Page() {
  return (
    <>
      <InternalPage route="per-agenzie" />
      <AgencyForm />
    </>
  );
}

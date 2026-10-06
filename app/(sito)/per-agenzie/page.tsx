import type { Metadata } from "next";
import { AgencyForm } from "@/components/editorial/operational-pages";
import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Produzione editoriale per agenzie",
  descrizione:
    "Proemios come reparto produttivo esterno per agenzie di ghostwriting, comunicazione e personal branding: white label, NDA, referente dedicato, listino riservato.",
  path: "/per-agenzie",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Per agenzie", path: "/per-agenzie" },
        ])}
      />
      <InternalPage route="per-agenzie" />
      <AgencyForm />
    </>
  );
}

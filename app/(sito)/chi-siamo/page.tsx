import type { Metadata } from "next";
import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Chi siamo",
  descrizione:
    "Proemios nasce da un lavoro editoriale reale: formazione filologica, mestiere sui testi e un modo diverso di far arrivare un preventivo.",
  path: "/chi-siamo",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Chi siamo", path: "/chi-siamo" },
        ])}
      />
      <InternalPage route="chi-siamo" />
    </>
  );
}

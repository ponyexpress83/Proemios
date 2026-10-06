import type { Metadata } from "next";
import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Come funziona",
  descrizione:
    "Il processo di Proemios dall'inizio alla pubblicazione: come si arriva al preventivo, come si lavora sul testo, chi approva cosa e come esce il libro.",
  path: "/come-funziona",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Come funziona", path: "/come-funziona" },
        ])}
      />
      <InternalPage route="come-funziona" />
    </>
  );
}

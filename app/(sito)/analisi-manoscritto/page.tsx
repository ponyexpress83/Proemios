import type { Metadata } from "next";
import { AnalysisPage } from "@/components/editorial/operational-pages";
import { env } from "@/lib/env";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Analisi gratuita del manoscritto",
  descrizione:
    "Carica il tuo testo e ricevi una prima diagnosi editoriale: leggibilità misurata, ritmo, ripetizioni, coerenza dei tempi verbali, lettore-tipo e fascia di costo.",
  path: "/analisi-manoscritto",
});

export default function AnalisiPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Analisi del manoscritto", path: "/analisi-manoscritto" },
        ])}
      />
      <AnalysisPage retention={env.MANUSCRIPT_RETENTION_DAYS} />
    </>
  );
}

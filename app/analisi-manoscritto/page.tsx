import type { Metadata } from "next";
import { Gabbia, Filetto } from "@/components/ui/primitivi";
import { FlussoAnalisi } from "@/components/analisi/flusso";
import { ANALISI } from "@/config/copy";
import { BRAND } from "@/config/brand";
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

      {/* Lato software: etichetta critico su fondo notte. */}
      <div className="bg-fondo-alto text-testo  py-14 sm:py-20">
        <Gabbia>
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="etichetta text-lime">Strumento · gratuito</p>
            <h1 className="mt-4 text-[2.2rem] leading-[1.08] font-medium sm:text-[2.9rem]">
              {ANALISI.titolo}
            </h1>
            <Filetto className="mx-auto mt-6 max-w-xs" />
            <p className="prosa text-testo-attenuato mt-6">{ANALISI.occhiello}</p>
          </div>

          <FlussoAnalisi giorniConservazione={env.MANUSCRIPT_RETENTION_DAYS} />

          <p className="editoriale text-testo-tenue mx-auto mt-12 max-w-2xl text-center">
            {BRAND.aiDisclaimer}
          </p>
        </Gabbia>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { Gabbia, Sezione, Impaginato, Folio, Filetto, Titolo } from "@/components/ui/primitivi";
import { ModuloContatto } from "@/components/moduli/modulo-contatto";
import { BRAND } from "@/config/brand";
import { publicEnv } from "@/lib/env";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Contatti",
  descrizione:
    "Scrivici o prenota una call con Proemios. Parliamo del tuo progetto editoriale: la prima conversazione è gratuita e senza impegno.",
  path: "/contatti",
});

export default function ContattiPage() {
  const calendario = publicEnv.NEXT_PUBLIC_CALENDAR_URL;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Contatti", path: "/contatti" },
        ])}
      />

      <section className="bg-fondo pt-14 pb-10 sm:pt-20">
        <Gabbia>
          <Impaginato margine={<Folio n="00" etichetta="Contatti" />}>
            <h1 className="text-[2.4rem] leading-[1.06] font-medium sm:text-[3.1rem]">
              Parliamone
            </h1>
            <Filetto className="mt-6" />
            <p className="text-lg leading-relaxed text-testo-attenuato lettura mt-6">
              Raccontaci a che punto sei. Se il progetto non è per noi te lo diciamo subito e ti
              indirizziamo altrove: fa risparmiare tempo a entrambi.
            </p>
          </Impaginato>
        </Gabbia>
      </section>

      <Sezione fondo="bassa">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="etichetta text-lime">§ 01 · Scrivici</p>
            <Titolo as="h2" className="mt-4 text-[1.7rem]">
              Manda un messaggio
            </Titolo>
            <div className="rounded-lg border-bordo bg-superficie mt-8 border p-6 sm:p-8">
              <ModuloContatto />
            </div>
            <p className="prosa mt-6 text-sm">
              Oppure scrivi direttamente a{" "}
              <a
                href={`mailto:${BRAND.email.general}`}
                className="text-viola-chiaro hover:text-lime font-medium"
              >
                {BRAND.email.general}
              </a>
              . Per le agenzie:{" "}
              <a
                href={`mailto:${BRAND.email.agencies}`}
                className="text-viola-chiaro hover:text-lime font-medium"
              >
                {BRAND.email.agencies}
              </a>
              .
            </p>
          </div>

          <div>
            <p className="etichetta text-lime">§ 02 · Prenota</p>
            <Titolo as="h2" className="mt-4 text-[1.7rem]">
              Una call di trenta minuti
            </Titolo>
            <p className="prosa mt-4 max-w-md">
              Scegli un orario e ne parliamo a voce. Serve a capire se il progetto sta in piedi e
              quanto lavoro richiede davvero.
            </p>

            {calendario ? (
              <div className="rounded-lg border-bordo bg-superficie mt-8 overflow-hidden border">
                <iframe
                  src={calendario}
                  title="Prenota una call con Proemios"
                  className="h-[620px] w-full"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="rounded-lg border-bordo bg-superficie mt-8 border border-dashed p-8">
                <p className="etichetta text-testo-tenue">Calendario non configurato</p>
                <p className="prosa mt-3 text-sm">
                  Il calendario si attiva impostando{" "}
                  <code className="font-mono text-[0.85em]">NEXT_PUBLIC_CALENDAR_URL</code>. Nel
                  frattempo scrivici via email e fissiamo noi l&rsquo;orario.
                </p>
              </div>
            )}

            {calendario && (
              <p className="editoriale text-testo-tenue mt-3">
                Se il calendario non si carica,{" "}
                <a
                  href={calendario}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-viola-chiaro underline"
                >
                  aprilo in una scheda nuova
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </Sezione>
    </>
  );
}

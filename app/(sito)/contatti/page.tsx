import type { Metadata } from "next";
import { ModuloContatto } from "@/components/moduli/modulo-contatto";
import { Collegamento } from "@/components/sito/collegamento";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { BRAND } from "@/config/brand";
import { publicEnv } from "@/lib/env";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Contatti",
  descrizione:
    "Scrivici o prenota una call con Proemios. Parliamo del tuo progetto editoriale: la prima conversazione è gratuita e senza impegno.",
  path: "/contatti",
});

export default async function ContattiPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; quote?: string }>;
}) {
  const sp = await searchParams;
  const motivo = sp.motivo === "editor" ? "editor" : undefined;
  // Solo un id di preventivo ben formato finisce nel messaggio.
  const quote =
    sp.quote && /^(demo-[a-z]+-\d+|[0-9a-f-]{36})$/.test(sp.quote) ? sp.quote : undefined;
  const calendario = publicEnv.NEXT_PUBLIC_CALENDAR_URL;
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Contatti", path: "/contatti" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h1 className="font-serif text-t-display text-balance text-inchiostro">Parliamone.</h1>
              <p className="mt-4 max-w-giustezza text-t-md text-grafite">
                Un&rsquo;idea da mettere a fuoco, una domanda sul manoscritto, un progetto da
                avviare. Raccontaci a che punto sei: se non è un lavoro per noi te lo diciamo
                subito.
              </p>
              {calendario && (
                <div className="mt-6">
                  <PulsanteLink href={calendario} variante="secondario">
                    Prenota una call
                  </PulsanteLink>
                </div>
              )}
              <p className="mt-8 text-t-sm text-grafite">
                Oppure scrivi a{" "}
                <Collegamento href={`mailto:${BRAND.email.general}`} className="text-t-sm">
                  {BRAND.email.general}
                </Collegamento>
                . Per le agenzie:{" "}
                <Collegamento href={`mailto:${BRAND.email.agencies}`} className="text-t-sm">
                  {BRAND.email.agencies}
                </Collegamento>
                .
              </p>
            </div>
            <div className="rounded-foglio bg-bianco p-6 shadow-foglio sm:p-8">
              <ModuloContatto motivo={motivo} quote={quote} />
            </div>
          </div>
        </Contenitore>
      </Sezione>
    </>
  );
}

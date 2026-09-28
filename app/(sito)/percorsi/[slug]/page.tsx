import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Gabbia, Sezione, Titolo, Occhiello } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { Scheda } from "@/components/ui/scheda";
import { Apparizione } from "@/components/marketing/apparizione";
import { FasciaCta, IntestazioneSezione, Passi, SchedaServizio } from "@/components/marketing/blocchi";
import { Prezzo } from "@/components/marketing/prezzo";
import { Faq } from "@/components/sezioni/faq";
import { PERCORSI, SLUG_PERCORSI, getPercorso } from "@/config/percorsi";
import { getServizio } from "@/config/catalogo";
import { metadatiPagina, JsonLd, breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return SLUG_PERCORSI.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const percorso = getPercorso(slug);
  if (!percorso) return metadatiPagina({ titolo: "Percorso", descrizione: "", path: "/percorsi" });
  return metadatiPagina({
    titolo: percorso.nome,
    descrizione: percorso.claim,
    path: `/percorsi/${percorso.slug}`,
  });
}

export default async function PaginaPercorso({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const percorso = getPercorso(slug);
  if (!percorso) notFound();

  const servizi = percorso.servizi.map(getServizio).filter((s) => s !== undefined);
  const altri = PERCORSI.filter((p) => p.slug !== percorso.slug).slice(0, 3);
  const hrefPreventivo = percorso.prefillPreventivo
    ? `/preventivo?tipo=${percorso.prefillPreventivo}`
    : "/preventivo";

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Percorsi", path: "/percorsi" },
            { nome: percorso.nome, path: `/percorsi/${percorso.slug}` },
          ]),
          serviceJsonLd({
            nome: percorso.nome,
            descrizione: percorso.claim,
            slug: percorso.slug,
          }),
          faqJsonLd(percorso.faq.map((f) => ({ q: f.domanda, a: f.risposta }))),
        ]}
      />

      {/* ── Apertura ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-bordo">
        <span className="alone -top-24 left-1/3 size-96 bg-viola/20" />
        <Gabbia className="relative">
          <div className="grid gap-12 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
            <div className="flex flex-col gap-6">
              <Occhiello>Percorso</Occhiello>
              <h1 className="text-4xl leading-tight font-semibold sm:text-5xl lg:text-6xl">
                {percorso.nome}
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-testo-attenuato">
                {percorso.claim}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <BottoneLink href={hrefPreventivo} variante="identita" misura="grande">
                  Fai il preventivo
                  <ArrowRight className="size-4" aria-hidden />
                </BottoneLink>
                <BottoneLink href="/contatti" variante="fantasma" misura="grande">
                  Parla con noi
                </BottoneLink>
              </div>
            </div>

            <Scheda variante="sollevata" className="flex h-fit flex-col gap-5 p-6">
              <div className="flex flex-col gap-1.5">
                <span className="etichetta text-testo-tenue">Per chi</span>
                <p className="text-sm leading-relaxed text-testo-attenuato">{percorso.perChi}</p>
              </div>
              <div className="flex flex-col gap-1.5 border-t border-bordo pt-5">
                <span className="etichetta text-testo-tenue">Prezzo</span>
                <Prezzo prezzo={percorso.prezzo} />
              </div>
              <div className="flex flex-col gap-1.5 border-t border-bordo pt-5">
                <span className="etichetta text-testo-tenue">Servizi coinvolti</span>
                <p className="cifre text-sm text-testo">{servizi.length}</p>
              </div>
            </Scheda>
          </div>
        </Gabbia>
      </section>

      {/* ── Il problema ────────────────────────────────────────────────── */}
      <Sezione ampiezza="compatta">
          <Apparizione className="lettura flex flex-col gap-4">
            <Occhiello>Il punto</Occhiello>
            <p className="editoriale text-2xl leading-snug text-testo sm:text-3xl">
              {percorso.problema}
            </p>
          </Apparizione>
      </Sezione>

      {/* ── Le tappe ───────────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <IntestazioneSezione
            occhiello="Come si svolge"
            titolo="Le tappe del percorso."
            sotto="Ogni tappa si chiude con una tua approvazione: si procede solo quando hai detto sì."
          />
          <Apparizione>
            <Passi passi={percorso.tappe} />
          </Apparizione>
      </Sezione>

      {/* ── Servizi coinvolti ──────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <IntestazioneSezione
            occhiello="Cosa comprende"
            titolo="I servizi di questo percorso."
            sotto="Sono tutti acquistabili anche singolarmente: il percorso li mette in ordine e in un solo preventivo."
            azione={{ href: "/servizi", testo: "Catalogo completo" }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servizi.map((s, i) => (
              <Apparizione key={s.slug} ritardo={(i % 3) * 0.06}>
                <SchedaServizio servizio={s} />
              </Apparizione>
            ))}
          </div>
      </Sezione>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <Titolo occhiello="Domande" livello={2}>
              Su questo percorso.
            </Titolo>
            <Faq voci={percorso.faq} />
          </div>
      </Sezione>

      {/* ── Altri percorsi ─────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <IntestazioneSezione occhiello="Altrove" titolo="Non è il tuo caso?" />
          <div className="grid gap-4 sm:grid-cols-3">
            {altri.map((p) => (
              <Link
                key={p.slug}
                href={`/percorsi/${p.slug}` as Route}
                className="garbo group flex flex-col gap-2 rounded-lg border border-bordo bg-superficie p-5 hover:border-bordo-forte hover:bg-superficie-viva"
              >
                <span className="text-base font-medium text-testo">{p.nome}</span>
                <span className="text-sm leading-relaxed text-testo-tenue">{p.claim}</span>
              </Link>
            ))}
          </div>
      </Sezione>

      <FasciaCta ctaPrimaria={{ href: hrefPreventivo, testo: "Fai il preventivo" }} />
    </>
  );
}

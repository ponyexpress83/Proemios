import type { Metadata } from "next";
import { Sezione, Titolo, Occhiello } from "@/components/ui/primitivi";
import { Apparizione } from "@/components/marketing/apparizione";
import { FasciaCta, SchedaServizio } from "@/components/marketing/blocchi";
import { SERVIZI, SERVIZI_PER_AREA } from "@/config/catalogo";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Servizi",
  descrizione:
    "Il catalogo completo: correzione, editing, ghostwriting, ricerca, impaginazione, copertina, EPUB, pubblicazione, traduzione, promozione e produzione white label.",
  path: "/servizi",
});

export default function PaginaServizi() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Servizi", path: "/servizi" },
        ])}
      />

      <Sezione ampiezza="compatta">
          <div className="flex flex-col gap-8">
            <Titolo
              livello={1}
              occhiello={`${SERVIZI.length} servizi`}
              sotto="Ogni lavorazione è acquistabile per conto suo. Dove esiste una tariffa standard la trovi scritta; dove il lavoro dipende troppo dal caso, si passa dal preventivo — e c'è scritto perché."
              className="max-w-3xl"
            >
              Catalogo dei servizi.
            </Titolo>

            <nav aria-label="Aree di servizio" className="flex flex-wrap gap-2">
              {SERVIZI_PER_AREA.map((a) => (
                <a
                  key={a.area}
                  href={`#${a.area}`}
                  className="garbo rounded-full border border-bordo bg-superficie px-4 py-1.5 text-sm text-testo-attenuato hover:border-bordo-forte hover:text-testo"
                >
                  {a.nome}
                </a>
              ))}
            </nav>
          </div>
      </Sezione>

      {SERVIZI_PER_AREA.map((area) => (
        <Sezione key={area.area} id={area.area} ampiezza="compatta" className="border-t border-bordo">
            <div className="mb-8 flex flex-col gap-3">
              <Occhiello>{area.nome}</Occhiello>
              <p className="lettura text-lg text-testo-attenuato">{area.sommario}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {area.servizi.map((s, i) => (
                <Apparizione key={s.slug} ritardo={(i % 3) * 0.05}>
                  <SchedaServizio servizio={s} />
                </Apparizione>
              ))}
            </div>
        </Sezione>
      ))}

      <FasciaCta
        titolo="Più servizi insieme?"
        testo="Il configuratore mette in conto tutto quello che ti serve e calcola il totale, gli sconti di volume e l'acconto. Due minuti, senza lasciare un contatto."
      />
    </>
  );
}

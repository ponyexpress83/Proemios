import type { Metadata } from "next";
import { IndiceServizi } from "@/components/sito/home/indice-servizi";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { FasciaCta } from "@/components/marketing/blocchi";
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
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mb-10 max-w-giustezza lg:mb-14">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">Servizi</h1>
            <p className="mt-4 text-t-md text-grafite">
              {SERVIZI.length} lavorazioni, ognuna acquistabile per conto suo. Dove esiste una
              tariffa standard la trovi scritta; dove il lavoro dipende troppo dal testo, si passa
              dal preventivo, e c&rsquo;è scritto perché.
            </p>
          </div>
          <nav aria-label="Parti del catalogo" className="mb-10 border-y border-filetto py-3 lg:mb-14">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {SERVIZI_PER_AREA.map((parte) => (
                <li key={parte.area}>
                  <a
                    href={`#indice-${parte.area}`}
                    className="sottolinea-matita inline-flex min-h-11 min-w-11 items-center text-t-sm text-inchiostro"
                  >
                    {parte.nome}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <IndiceServizi tutte />
        </Contenitore>
      </Sezione>
      <FasciaCta
        titolo="Più servizi insieme?"
        testo="Il configuratore mette in conto tutto quello che ti serve e calcola il totale, gli sconti di volume e l'acconto. Sei domande, senza lasciare un contatto."
      />
    </>
  );
}

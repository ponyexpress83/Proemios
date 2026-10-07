import type { Metadata } from "next";
import { IndiceServizi } from "@/components/sito/home/indice-servizi";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { FasciaCta } from "@/components/marketing/blocchi";
import { SERVIZI } from "@/config/catalogo";
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

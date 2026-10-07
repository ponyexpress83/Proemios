import type { Metadata } from "next";
import { Collegamento } from "@/components/sito/collegamento";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { SegnoMargine } from "@/components/sito/segni";
import { FasciaCta } from "@/components/marketing/blocchi";
import { BRAND } from "@/config/brand";
import { TITOLARE } from "@/config/legal";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Chi siamo",
  descrizione:
    "Proemios nasce da un lavoro editoriale reale: formazione filologica, mestiere sui testi e un modo diverso di far arrivare un preventivo.",
  path: "/chi-siamo",
});

const RUOLI: [string, string][] = [
  ["Editor", "Legge in profondità e lavora con la tua voce, non al posto suo."],
  ["Responsabile di progetto", "Tiene insieme tempi, persone e consegne, ed è chi ti risponde."],
  ["Grafico editoriale", "Dà al libro una forma coerente: interni, copertina, file."],
  ["Specialista di pubblicazione", "Ti accompagna nei passaggi pratici: ISBN, piattaforme, scheda."],
];

const PRINCIPI: [string, string][] = [
  ["Chiarezza", "Perimetro, revisioni e consegne definiti prima di iniziare, per iscritto."],
  ["Accompagnamento", "Feedback comprensibile, confronto, scelte condivise."],
  ["Responsabilità", "Nessuna promessa di vendite, premi o risultati che non possiamo verificare."],
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Chi siamo", path: "/chi-siamo" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="max-w-giustezza">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">Chi c&rsquo;è dietro</h1>
            <p className="mt-4 text-t-md text-grafite">
              {BRAND.name} nasce da un lavoro editoriale fatto per anni su testi veri: una
              formazione filologica, il mestiere della lettura e della correzione, e l&rsquo;idea
              che un autore debba sapere prima — non dopo — cosa succede al suo libro e quanto costa.
            </p>
            <p className="mt-4 font-serif text-t-md text-inchiostro">
              Le persone si occupano del testo. Gli strumenti servono a tenere in ordine file,
              revisioni e decisioni, non a sostituire chi legge.
            </p>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore>
          <Intestazione titolo="Chi lavora sul tuo libro" lead="Quattro ruoli, non quattro reparti: sullo stesso progetto parlano fra loro, e con te." />
          <ul className="grid gap-8 md:grid-cols-2">
            {RUOLI.map(([ruolo, testo]) => (
              <li key={ruolo} className="relative pl-6">
                <SegnoMargine className="absolute top-0 left-0 h-10 w-3.5" colore="blu" />
                <h3 className="font-serif text-t-md text-inchiostro">{ruolo}</h3>
                <p className="mt-1 text-t-base text-grafite">{testo}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-t-sm text-grafite">
            Le schede personali, con nomi, profili e foto, verranno pubblicate una volta verificate.
            Qui non ci sono volti di repertorio.
          </p>
        </Contenitore>
      </Sezione>

      <Sezione>
        <Contenitore>
          <Intestazione titolo="Quello in cui crediamo" />
          <ul className="grid gap-8 md:grid-cols-3">
            {PRINCIPI.map(([titolo, testo]) => (
              <li key={titolo}>
                <h3 className="font-serif text-t-md text-inchiostro">{titolo}</h3>
                <p className="mt-2 text-t-base text-grafite">{testo}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-giustezza text-t-sm text-grafite">
            {BRAND.name} è il marchio con cui {TITOLARE.ragioneSociale} eroga i servizi editoriali.
            I dati societari sono nel colophon e nelle{" "}
            <Collegamento href="/termini" className="text-t-sm">
              condizioni di servizio
            </Collegamento>
            .
          </p>
        </Contenitore>
      </Sezione>

      <FasciaCta ctaSecondaria={{ href: "/contatti", testo: "Parla con un editor" }} />
    </>
  );
}

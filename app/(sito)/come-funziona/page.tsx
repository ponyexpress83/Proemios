import type { Metadata } from "next";
import {
  Sezione,
  Apertura,
  Impaginato,
  Folio,
  Filetto,
  Titolo,
  Scheda,
} from "@/components/ui/primitivi";
import { Processo, Chiusa, ElencoIncluso } from "@/components/sezioni/blocchi";
import { Faq } from "@/components/sezioni/faq";
import { metadatiPagina, JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = metadatiPagina({
  titolo: "Come funziona",
  descrizione:
    "Il processo di Proemios dall'inizio alla pubblicazione: come si arriva al preventivo, come si lavora sul testo, chi approva cosa e come esce il libro.",
  path: "/come-funziona",
});

const FASI = [
  {
    titolo: "Capiamo a che punto sei",
    testo:
      "Puoi partire dal configuratore (sei domande, prezzo immediato) o dall'analisi del manoscritto (carichi il testo e lo leggiamo). Molti fanno entrambe: la prima dà il costo, la seconda dice se quel costo è quello giusto.",
  },
  {
    titolo: "Ti mandiamo tre percorsi",
    testo:
      "Non tre prezzi per la stessa cosa: tre modi diversi di affrontare il progetto, con dichiarato cosa comprendono e cosa no. Il preventivo ti arriva anche via email, così puoi rileggerlo con calma.",
  },
  {
    titolo: "Ne parliamo a voce",
    testo:
      "Prima di qualsiasi impegno guardiamo il testo insieme. È il momento in cui il preventivo si corregge: se il lavoro è meno di quanto stimato, il prezzo scende. Se è di più, lo dici tu se procedere.",
  },
  {
    titolo: "Si parte con un acconto",
    testo:
      "Il 40% blocca la data in calendario. Da lì la lavorazione entra nel nostro piano di produzione e ha delle scadenze reali, non «appena possibile».",
  },
  {
    titolo: "Lavoriamo e tu approvi",
    testo:
      "Editing con modifiche tracciate, impaginazione, copertina, EPUB. Ogni consegna passa da te: niente prosegue senza la tua approvazione, e le revisioni previste sono scritte nel preventivo.",
  },
  {
    titolo: "Il libro esce e i file sono tuoi",
    testo:
      "Pubblicazione su Amazon KDP, ISBN, scheda prodotto. Ti consegniamo i file sorgente: se un domani vuoi cambiare fornitore, puoi farlo senza ripartire da zero.",
  },
];

const GARANZIE = [
  "Il manoscritto resta di tua proprietà: noi non acquisiamo diritti sull'opera.",
  "Il testo non viene usato per scopi diversi dalla lavorazione concordata.",
  "Niente viene pubblicato senza la tua approvazione esplicita.",
  "I file sorgente ti vengono consegnati a fine lavorazione.",
  "Le revisioni incluse sono indicate nel preventivo, non lasciate al buonsenso.",
];

const FAQ = [
  {
    q: "Quanto tempo richiede in tutto?",
    a: "Dipende dal percorso: una correzione con impaginazione può chiudersi in 4-6 settimane, un ghostwriting da materiali grezzi richiede mesi. La data di consegna viene fissata quando si versa l'acconto, non lasciata indefinita.",
  },
  {
    q: "Posso comprare un solo servizio?",
    a: "Sì. Molti arrivano con il testo già editato e vogliono solo copertina e impaginazione. Il configuratore permette di selezionare i singoli servizi.",
  },
  {
    q: "Pubblicate sul mio account Amazon?",
    a: "Sì, ed è la scelta che consigliamo: l'account resta tuo, le royalty arrivano direttamente a te. Ti assistiamo nel caricamento e nella configurazione della scheda.",
  },
  {
    q: "Cosa succede se il risultato non mi convince?",
    a: "Le revisioni previste sono scritte nel preventivo e si usano proprio per questo. Se il disaccordo è di fondo, ne parliamo: preferiamo interrompere e rimborsare il non lavorato piuttosto che consegnare qualcosa che non ti rappresenta.",
  },
];

export default function ComeFunzionaPage() {
  return (
    <>
      <JsonLd
        data={[
          faqJsonLd(FAQ),
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Come funziona", path: "/come-funziona" },
          ]),
        ]}
      />

      <Sezione>
        <Apertura
          as="h1"
          folio="01"
          etichetta="Metodo"
          titolo="Come si arriva a un libro"
          glossa="Il processo è sempre lo stesso: cambia quanto lungo è il tratto che facciamo insieme."
          occhiello={
            <p>
              Nessun passaggio a scatola chiusa. Qui c&rsquo;è tutto quello che succede dal momento
              in cui ci scrivi a quello in cui il libro è online.
            </p>
          }
        />
        <div className="mt-14">
          <Processo passi={FASI} />
        </div>
      </Sezione>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={2} etichetta="Garanzie" />}>
          <Titolo as="h2">Quello su cui puoi contare</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <ElencoIncluso voci={GARANZIE} />
            <Scheda className="h-fit">
              <p className="etichetta text-lime">Tecnologia</p>
              <p className="prosa mt-3 text-[0.95rem]">{BRAND.aiDisclaimer}</p>
            </Scheda>
          </div>
        </Impaginato>
      </Sezione>

      <Sezione>
        <Impaginato margine={<Folio n={3} etichetta="Domande" />}>
          <Titolo as="h2">Domande ricorrenti</Titolo>
          <div className="mt-8">
            <Faq voci={FAQ} />
          </div>
        </Impaginato>
      </Sezione>

      <Chiusa />
    </>
  );
}

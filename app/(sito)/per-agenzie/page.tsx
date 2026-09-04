import type { Metadata } from "next";
import {
  Gabbia,
  Sezione,
  Impaginato,
  Folio,
  NotaMargine,
  Filetto,
  Titolo,
  Scheda,
} from "@/components/ui/primitivi";
import { Processo, ElencoIncluso } from "@/components/sezioni/blocchi";
import { Faq } from "@/components/sezioni/faq";
import { ModuloAgenzia } from "@/components/moduli/modulo-agenzia";
import { getServizio } from "@/config/catalogo";
import { getPercorso } from "@/config/percorsi";
import { AGENZIE } from "@/config/copy";
import { metadatiPagina, JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const SERVIZIO = getServizio("produzione-white-label")!;
const PERCORSO = getPercorso("agenzie-e-white-label")!;

export const metadata: Metadata = metadatiPagina({
  titolo: "Produzione editoriale per agenzie",
  descrizione:
    "Proemios come reparto produttivo esterno per agenzie di ghostwriting, comunicazione e personal branding: white label, NDA, referente dedicato, listino riservato.",
  path: "/per-agenzie",
});

const ARGOMENTI = [
  {
    titolo: "Capacità nei picchi",
    testo:
      "Tre clienti che chiedono un libro nello stesso mese non vi obbligano ad assumere. La capacità la mettiamo noi e si contrae quando serve.",
  },
  {
    titolo: "White label totale",
    testo:
      "Consegniamo a voi, voi consegnate al cliente. Non compariamo nei documenti, non contattiamo il vostro cliente, non chiediamo referenze sui lavori fatti per voi.",
  },
  {
    titolo: "NDA prima di tutto",
    testo:
      "L'accordo di riservatezza si firma all'inizio, non quando serve. Vale su nomi, contenuti e sull'esistenza stessa del rapporto.",
  },
  {
    titolo: "Un referente solo",
    testo:
      "Una persona che conosce i vostri progetti e risponde entro la giornata lavorativa. Niente ticket, niente code.",
  },
  {
    titolo: "Tempi concordati",
    testo:
      "Le date di consegna si fissano all'ordine e sono vincolanti. Se slittiamo noi, lo sapete prima voi del vostro cliente.",
  },
  {
    titolo: "Flussi separati",
    testo:
      "Ogni cliente finale ha cartelle, file e canali distinti. Nessuna contaminazione fra progetti, nemmeno interna.",
  },
];

const FASI = [
  {
    titolo: "NDA e condizioni",
    testo: "Firmiamo la riservatezza e definiamo listino, marchio e tempi di risposta.",
  },
  {
    titolo: "Allineamento",
    testo: "Impostiamo template, tono di voce e canali di lavoro sui vostri standard.",
  },
  {
    titolo: "Produzione",
    testo:
      "Lavoriamo sui progetti a marchio vostro: voi restate l'unico interlocutore del cliente.",
  },
  {
    titolo: "Consegna e volume",
    testo: "Consegniamo, iteriamo, e le condizioni si aggiornano al crescere dei volumi.",
  },
];

export default function PerAgenziePage() {
  return (
    <>
      <JsonLd
        data={[
          faqJsonLd(PERCORSO.faq),
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Per agenzie", path: "/per-agenzie" },
          ]),
        ]}
      />

      <section className="bg-fondo pt-14 pb-12 sm:pt-20">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <Folio n="00" etichetta="B2B" />
                <NotaMargine>
                  Nessun prezzo pubblico: il listino è riservato ai partner.
                </NotaMargine>
              </>
            }
          >
            <h1 className="text-[2.4rem] leading-[1.06] font-medium sm:text-[3.2rem]">
              {AGENZIE.titolo}
            </h1>
            <Filetto className="mt-6" />
            <p className="text-lg leading-relaxed text-testo-attenuato lettura mt-6">{AGENZIE.occhiello}</p>
          </Impaginato>
        </Gabbia>
      </section>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={1} etichetta="Condizioni" />}>
          <Titolo as="h2">Come lavoriamo con le agenzie</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {ARGOMENTI.map((a) => (
              <Scheda key={a.titolo}>
                <h3 className="text-lg font-medium">{a.titolo}</h3>
                <p className="prosa mt-2 text-[0.95rem]">{a.testo}</p>
              </Scheda>
            ))}
          </div>
        </Impaginato>
      </Sezione>

      <Sezione>
        <Impaginato margine={<Folio n={2} etichetta="Avvio" />}>
          <Titolo as="h2">Dall&rsquo;accordo alla produzione</Titolo>
          <div className="mt-8">
            <Processo passi={FASI} />
          </div>
        </Impaginato>
      </Sezione>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={3} etichetta="Servizi" />}>
          <Titolo as="h2">Cosa possiamo produrre</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8">
            <ElencoIncluso voci={SERVIZIO.include} />
          </div>
        </Impaginato>
      </Sezione>

      {/* Form, sul lato notte: è la conversione della pagina */}
      <section id="richiesta" className="bg-fondo-alto text-testo  py-16 sm:py-20">
        <Gabbia>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="etichetta text-lime">§ 04 · Richiesta</p>
              <Titolo as="h2" className="mt-5">
                Listino riservato
              </Titolo>
              <Filetto className="mt-5" />
              <p className="prosa text-testo-attenuato mt-6">
                Compilate il modulo: vi arriva l&rsquo;NDA da firmare e il listino con le condizioni
                per il vostro volume. Non c&rsquo;è un prezzo pubblico perché non ce n&rsquo;è uno
                solo: cambia con la ricorrenza.
              </p>
              <p className="editoriale text-testo-tenue mt-6">
                Non usiamo i vostri dati per contattare i vostri clienti. Mai.
              </p>
            </div>

            <div className="rounded-lg bg-fondo text-testo p-6 sm:p-8">
              <ModuloAgenzia />
            </div>
          </div>
        </Gabbia>
      </section>

      <Sezione>
        <Impaginato margine={<Folio n={5} etichetta="Domande" />}>
          <Titolo as="h2">Domande ricorrenti</Titolo>
          <div className="mt-8">
            <Faq voci={PERCORSO.faq} />
          </div>
        </Impaginato>
      </Sezione>
    </>
  );
}

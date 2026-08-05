import type { Route } from "next";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Gabbia,
  Sezione,
  Apertura,
  Impaginato,
  Folio,
  NotaMargine,
  Filetto,
  Titolo,
  Scheda,
  Etichetta,
} from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { SchedaServizio, Processo, Chiusa } from "@/components/sezioni/blocchi";
import { SERVICES } from "@/config/services";
import { CASE_STUDIES } from "@/config/case-studies";
import { BRAND } from "@/config/brand";
import { AZIONI } from "@/config/copy";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: `${BRAND.name} — ${BRAND.payoff}`,
  descrizione: BRAND.description,
  path: "/",
});

const DISPERSIONE = [
  "Un correttore di bozze",
  "Un editor",
  "Un grafico per la copertina",
  "Un impaginatore",
  "Qualcuno che sappia usare KDP",
  "Qualcuno per l'ISBN",
];

const PASSAGGI = [
  {
    titolo: "Ci dici a che punto sei",
    testo:
      "Sei domande nel configuratore, oppure carichi il testo e lo leggiamo. In entrambi i casi esci con dei numeri, non con un «ti facciamo sapere».",
  },
  {
    titolo: "Ricevi il preventivo e ne parliamo",
    testo:
      "Tre percorsi possibili, con dentro e fuori dichiarati. Poi una call in cui guardiamo il testo davvero: se serve meno di quanto previsto, il prezzo scende.",
  },
  {
    titolo: "Lavoriamo, tu approvi",
    testo:
      "Editing, impaginazione, copertina, EPUB. Ogni passaggio ti arriva per approvazione: niente va avanti senza il tuo sì.",
  },
  {
    titolo: "Il libro esce",
    testo:
      "Pubblicazione su Amazon KDP, ISBN, scheda prodotto. Ti consegniamo anche i file: sono tuoi, e restano tuoi.",
  },
];

export default function HomePage() {
  const servizi = SERVICES;
  const casi = CASE_STUDIES.slice(0, 3);

  return (
    <>
      {/* ── Proemio: l'apertura ───────────────────────────────────────── */}
      <section className="bg-carta pt-16 pb-14 sm:pt-24 sm:pb-20">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <Folio n="00" etichetta="Proemio" />
                <NotaMargine>
                  Proemio: nella tradizione classica, il canto che precede il poema e ne dichiara
                  l&rsquo;intenzione.
                </NotaMargine>
              </>
            }
          >
            <p className="apparato text-alloro">{BRAND.payoff}</p>
            <h1 className="font-display text-inchiostro mt-5 text-[2.6rem] leading-[1.04] font-medium sm:text-[3.6rem] lg:text-[4.2rem]">
              Il tuo libro esiste già.
              <br />
              Manca chi lo porta fuori.
            </h1>
            <Filetto className="mt-8" />
            <p className="prosa-grande specchio mt-8">
              Per autopubblicarsi servono sei professionisti diversi, e ognuno risponde quando può.
              Proemios è il punto unico: editing, impaginazione, copertina, EPUB, ISBN e
              pubblicazione su Amazon. Con il prezzo che sai subito, non fra una settimana.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <BottoneLink href="/preventivo" misura="grande">
                {AZIONI.preventivo}
              </BottoneLink>
              <BottoneLink href="/analisi-manoscritto" variante="secondario" misura="grande">
                {AZIONI.analisi}
              </BottoneLink>
            </div>
            <p className="apparato text-stampa mt-6">
              Analisi gratuita · Preventivo in due minuti · Nessun impegno
            </p>
          </Impaginato>
        </Gabbia>
      </section>

      {/* ── Il problema ───────────────────────────────────────────────── */}
      <Sezione fondo="bassa">
        <Apertura
          folio={1}
          etichetta="Il problema"
          titolo="Sei preventivi, sei attese, sei linguaggi diversi"
          glossa="Il costo vero dell'autopubblicazione non è il denaro: è il coordinamento."
          occhiello={
            <p>
              Chi vuole pubblicare da sé si ritrova a fare il project manager di un progetto che non
              conosce. Ogni fornitore parla la propria lingua, i tempi non combaciano, e il testo
              resta fermo mentre si aspetta la risposta di qualcuno.
            </p>
          }
        />

        <div className="mt-12 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {DISPERSIONE.map((voce) => (
            <div key={voce} className="border-filetto flex items-baseline gap-3 border-b py-3">
              <span className="cifre text-stampa text-xs" aria-hidden>
                →
              </span>
              <span className="prosa text-[1rem]">{voce}</span>
            </div>
          ))}
        </div>

        <div className="border-alloro mt-10 border-l-2 pl-6">
          <p className="prosa-grande max-w-2xl">
            Noi siamo <strong className="font-semibold">un interlocutore solo</strong>. Il
            coordinamento lo facciamo noi: è il lavoro che stai comprando.
          </p>
        </div>
      </Sezione>

      {/* ── Come funziona ─────────────────────────────────────────────── */}
      <Sezione>
        <Apertura
          folio={2}
          etichetta="Come funziona"
          titolo="Quattro passaggi, nessuna sorpresa"
          glossa="Ogni passaggio si chiude con una tua approvazione. Niente prosegue senza."
        />
        <div className="mt-12">
          <Processo passi={PASSAGGI} />
        </div>
        <div className="mt-8">
          <BottoneLink href="/come-funziona" variante="quieto">
            Il processo in dettaglio →
          </BottoneLink>
        </div>
      </Sezione>

      {/* ── I servizi ─────────────────────────────────────────────────── */}
      <Sezione fondo="bassa">
        <Apertura
          folio={3}
          etichetta="Servizi"
          titolo="Sei percorsi, uno per ogni punto di partenza"
          glossa="Puoi prendere il percorso intero o solo il pezzo che ti manca."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {servizi.map((s) => (
            <SchedaServizio key={s.slug} servizio={s} />
          ))}
        </div>
      </Sezione>

      {/* ── L'offerta signature ───────────────────────────────────────── */}
      <section className="bg-notte text-carta su-notte py-16 sm:py-24">
        <Gabbia>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="apparato text-ottone">§ 04 · Il nostro mestiere</p>
              <Titolo as="h2" tono="notte" className="mt-5">
                Dal diario al libro
              </Titolo>
              <Filetto className="mt-6" tono="notte" />
              <p className="prosa-grande text-carta/75 mt-6">
                Quaderni scritti a mano, registrazioni vocali, appunti senza ordine. È il punto di
                partenza più difficile e quello che ci riesce meglio: trascriviamo, ordiniamo,
                troviamo la linea narrativa e scriviamo il libro. Con la voce di chi l&rsquo;ha
                vissuto, non con la nostra.
              </p>
              <div className="mt-9">
                <BottoneLink href="/dal-diario-al-libro" variante="chiaro" misura="grande">
                  Come lavoriamo su un memoir
                </BottoneLink>
              </div>
            </div>

            <figure className="border-ottone border-l-2 pl-7">
              <blockquote className="font-display text-carta text-2xl leading-snug font-normal italic sm:text-[1.75rem]">
                &ldquo;Leggendolo ho sentito parlare lui. È esattamente quello che speravo e non
                sapevo chiedere.&rdquo;
              </blockquote>
              <figcaption className="apparato text-carta/50 mt-5">
                Committente · memoir familiare
              </figcaption>
            </figure>
          </div>
        </Gabbia>
      </section>

      {/* ── Gli strumenti ─────────────────────────────────────────────── */}
      <Sezione>
        <Apertura
          folio={5}
          etichetta="Strumenti"
          titolo="I numeri prima delle promesse"
          glossa="Gli stessi strumenti che usiamo internamente, aperti a chi arriva sul sito."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Scheda className="flex flex-col">
            <div>
              <Etichetta tono="alloro">Gratuito</Etichetta>
            </div>
            <h3 className="font-display mt-4 text-2xl font-medium">Analisi del manoscritto</h3>
            <p className="prosa mt-3 flex-1">
              Carichi il testo e ricevi una prima diagnosi: leggibilità misurata, ritmo, tic
              ricorrenti, tempi verbali, lettore-tipo, tre punti di forza e tre cose su cui
              lavorare. Con la fascia di costo calcolata sulle parole reali del file.
            </p>
            <Filetto className="my-5" />
            <div>
              <BottoneLink href="/analisi-manoscritto" variante="secondario">
                {AZIONI.analisi}
              </BottoneLink>
            </div>
          </Scheda>

          <Scheda className="flex flex-col">
            <div>
              <Etichetta tono="alloro">Due minuti</Etichetta>
            </div>
            <h3 className="font-display mt-4 text-2xl font-medium">Configuratore di preventivo</h3>
            <p className="prosa mt-3 flex-1">
              Sei domande sul tuo progetto e ottieni tre percorsi con il prezzo, cosa includono e —
              soprattutto — cosa non includono. Quello che di solito richiede una settimana di
              scambi di email.
            </p>
            <Filetto className="my-5" />
            <div>
              <BottoneLink href="/preventivo" variante="secondario">
                {AZIONI.preventivo}
              </BottoneLink>
            </div>
          </Scheda>
        </div>

        <p className="glossa mt-8 max-w-2xl">{BRAND.aiDisclaimer}</p>
      </Sezione>

      {/* ── Casi studio ───────────────────────────────────────────────── */}
      <Sezione fondo="bassa">
        <Apertura
          folio={6}
          etichetta="Casi studio"
          titolo="Libri che sono usciti davvero"
          glossa="Progetti reali, resi anonimi dove il cliente ha chiesto riservatezza."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {casi.map((c) => (
            <Link
              key={c.slug}
              href={`/casi-studio/${c.slug}` as Route}
              className="garbo group rounded-scheda border-filetto bg-carta-alta hover:border-alloro flex flex-col border p-6 hover:-translate-y-0.5"
            >
              <p className="apparato text-ottone">{c.cliente}</p>
              <h3 className="font-display mt-3 flex-1 text-lg leading-snug font-medium">
                {c.titolo}
              </h3>
              <Filetto className="mt-5" />
              <span className="garbo apparato text-alloro mt-4 group-hover:translate-x-0.5">
                Leggi il caso
              </span>
            </Link>
          ))}
        </div>
      </Sezione>

      {/* ── Per le agenzie ────────────────────────────────────────────── */}
      <Sezione>
        <Impaginato margine={<Folio n={7} etichetta="B2B" />}>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Titolo as="h2">Siete un&rsquo;agenzia?</Titolo>
              <p className="prosa mt-3 max-w-xl">
                Produciamo a marchio vostro, con NDA e senza mai comparire davanti al vostro
                cliente. Listino riservato, referente dedicato, tempi concordati.
              </p>
            </div>
            <BottoneLink
              href="/per-agenzie"
              variante="secondario"
              misura="grande"
              className="shrink-0"
            >
              Come funziona il white label
            </BottoneLink>
          </div>
        </Impaginato>
      </Sezione>

      <Chiusa />
    </>
  );
}

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
import { Chiusa, ElencoIncluso } from "@/components/sezioni/blocchi";
import { BRAND } from "@/config/brand";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Chi siamo",
  descrizione:
    "Proemios nasce da un lavoro editoriale reale: formazione filologica, mestiere sui testi e un modo diverso di far arrivare un preventivo.",
  path: "/chi-siamo",
});

const COMPETENZE = [
  "Formazione filologica: laurea magistrale in Filologia Moderna",
  "Editing e revisione su narrativa, saggistica e memoir",
  "Ghostwriting da materiali grezzi: diari, registrazioni, appunti",
  "Impaginazione e produzione di file per stampa ed ebook",
  "Pubblicazione su Amazon KDP e gestione ISBN",
];

const PRINCIPI = [
  {
    titolo: "Il prezzo si dice subito",
    testo:
      "Un preventivo che arriva dopo una settimana è un preventivo che non hai potuto confrontare. Da noi lo calcoli in due minuti e lo verifichiamo insieme dopo.",
  },
  {
    titolo: "Il testo resta tuo",
    testo:
      "Non acquisiamo diritti, non usiamo il tuo manoscritto per altro, e ti consegniamo i file sorgente a fine lavoro.",
  },
  {
    titolo: "Diciamo anche di no",
    testo:
      "Se un testo non ha bisogno di un editing profondo, non te lo vendiamo. Se un progetto non è per noi, lo diciamo e ti indirizziamo altrove.",
  },
  {
    titolo: "La tecnologia sta al suo posto",
    testo:
      "La usiamo per accorciare diagnosi e preventivi, non per sostituire il giudizio editoriale. Ogni consegna passa da una persona.",
  },
];

export default function ChiSiamoPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Chi siamo", path: "/chi-siamo" },
        ])}
      />

      <section className="bg-carta pt-14 pb-12 sm:pt-20">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <Folio n="00" etichetta="Studio" />
                <NotaMargine>
                  Dal greco <em>prooímion</em>: ciò che sta prima del canto.
                </NotaMargine>
              </>
            }
          >
            <h1 className="font-display text-[2.4rem] leading-[1.06] font-medium sm:text-[3.2rem]">
              Un editore di mestiere,
              <br />
              con strumenti nuovi.
            </h1>
            <Filetto className="mt-7" />
            <p className="prosa-grande specchio mt-7">
              Proemios non nasce da un&rsquo;idea di startup: nasce dal lavoro editoriale fatto per
              clienti veri. Un romanzo scritto a partire dal diario di una vita. Un manoscritto
              portato dalla revisione fino alla vendita su Amazon con un ISBN di proprietà
              dell&rsquo;autore.
            </p>
            <p className="prosa specchio mt-5">
              Da quei lavori è venuta fuori una constatazione semplice: la parte difficile per il
              cliente non era la qualità del lavoro. Era arrivare a capire quanto costava e da dove
              si cominciava.
            </p>
          </Impaginato>
        </Gabbia>
      </section>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={1} etichetta="Il nome" />}>
          <div className="specchio">
            <Titolo as="h2">Perché Proemios</Titolo>
            <Filetto className="mt-5" />
            <p className="prosa mt-6">
              Il <em>proemio</em> è l&rsquo;apertura dell&rsquo;opera: nella tradizione classica è
              il canto che precede il poema e ne dichiara l&rsquo;intenzione. Non è il libro, ma è
              quello che lo rende possibile.
            </p>
            <p className="prosa mt-4">
              È esattamente il nostro posto: non siamo gli autori, siamo quello che viene prima e
              che permette al libro di esistere. Da qui il payoff: <em>{BRAND.payoff}</em>.
            </p>
          </div>
        </Impaginato>
      </Sezione>

      <Sezione>
        <Impaginato margine={<Folio n={2} etichetta="Competenze" />}>
          <Titolo as="h2">Cosa sappiamo fare</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <ElencoIncluso voci={COMPETENZE} />
            <Scheda className="h-fit">
              <p className="apparato text-ottone">Rete di professionisti</p>
              <p className="prosa mt-3 text-[0.95rem]">
                Grafici, illustratori e correttori con cui lavoriamo stabilmente. Non un
                marketplace: persone scelte, di cui rispondiamo noi.
              </p>
            </Scheda>
          </div>
        </Impaginato>
      </Sezione>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={3} etichetta="Metodo" />}>
          <Titolo as="h2">Come lavoriamo</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {PRINCIPI.map((p) => (
              <Scheda key={p.titolo}>
                <h3 className="font-display text-lg font-medium">{p.titolo}</h3>
                <p className="prosa mt-2 text-[0.95rem]">{p.testo}</p>
              </Scheda>
            ))}
          </div>
          <p className="glossa mt-8 max-w-2xl">{BRAND.aiDisclaimer}</p>
        </Impaginato>
      </Sezione>

      <Chiusa />
    </>
  );
}

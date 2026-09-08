import type { Metadata } from "next";
import { ArrowRight, Eye, ShieldCheck, Users } from "lucide-react";
import { Gabbia, Sezione, Occhiello } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { Scheda } from "@/components/ui/scheda";
import { OggettoEditoriale } from "@/components/marketing/oggetto-editoriale";
import { Apparizione } from "@/components/marketing/apparizione";
import {
  Citazione,
  FasciaCta,
  IntestazioneSezione,
  SchedaPercorso,
  SchedaServizio,
} from "@/components/marketing/blocchi";
import { Faq } from "@/components/sezioni/faq";
import { PERCORSI } from "@/config/percorsi";
import { SERVIZI } from "@/config/catalogo";
import { BRAND } from "@/config/brand";
import { JsonLd, faqJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.payoff}`,
  description: BRAND.description,
  alternates: { canonical: BRAND.url },
};

/** Le fasi che il cliente attraversa, dalla prima idea al post-pubblicazione. */
const FILIERA = [
  { fase: "Analisi", testo: "Leggiamo quello che hai e diciamo a che punto è." },
  { fase: "Preventivo", testo: "Numeri e date, prima di qualunque impegno." },
  { fase: "Produzione", testo: "Lavoriamo il testo, con revisioni tracciate." },
  { fase: "Revisione", testo: "Un redattore verifica ogni intervento, uno per uno." },
  { fase: "Approvazione", testo: "Niente ti arriva senza essere passato da una persona." },
  { fase: "Pubblicazione", testo: "Produzione, store, metadati, scheda." },
  { fase: "Dopo", testo: "Il libro continua a essere seguito anche dopo l'uscita." },
];

const PROMESSE = [
  {
    icona: Users,
    titolo: "Un solo interlocutore",
    testo:
      "Editing, impaginazione, copertina, EPUB, KDP, ISBN, lancio. Un preventivo, un referente, una data di consegna — invece di sei fornitori che si rimpallano la responsabilità.",
  },
  {
    icona: Eye,
    titolo: "Vedi ogni intervento",
    testo:
      "Il testo torna in DOCX con revisioni tracciate: ogni modifica è visibile, accettabile o rifiutabile una per una. Non ti restituiamo un file diverso dicendo «fidati».",
  },
  {
    icona: ShieldCheck,
    titolo: "Niente promesse che nessuno può mantenere",
    testo:
      "Non garantiamo vendite, classifiche o recensioni. Garantiamo un lavoro fatto bene, tempi scritti e un prezzo che non cambia dopo la firma.",
  },
];

const FAQ_HOME = [
  {
    domanda: "Quanto costa?",
    risposta:
      "Dipende dal servizio e dalla lunghezza. Le tariffe a parola e i forfait sono pubblici sulle pagine servizio, e il configuratore calcola il totale esatto sul tuo caso in due minuti. Quello che non ha una tariffa standard è dichiarato «su preventivo», con scritto perché.",
  },
  {
    domanda: "Usate l'intelligenza artificiale?",
    risposta:
      "Usiamo tecnologia dentro il nostro processo, come qualunque studio editoriale usa strumenti. Quello che conta per te è che nessuna consegna esce senza che un professionista l'abbia verificata e approvata: è una regola della piattaforma, non una buona intenzione.",
  },
  {
    domanda: "Il libro resta mio?",
    risposta:
      "Sempre. Diritti, paternità e file sorgente sono tuoi. Nel ghostwriting la riservatezza è contrattuale: nessuna nostra firma compare sull'opera.",
  },
  {
    domanda: "Posso comprare un servizio solo?",
    risposta:
      "Sì. I percorsi esistono perché è così che si presenta il problema, ma ogni singolo servizio è acquistabile per conto suo.",
  },
  {
    domanda: "Cosa succede se non sono soddisfatto?",
    risposta:
      "Ogni fase si chiude con una tua approvazione: se una consegna non va, si rilavora prima di procedere. Le condizioni esatte sono nei termini di servizio, non nascoste in una nota.",
  },
];

export default function Home() {
  const percorsiInEvidenza = PERCORSI.slice(0, 6);
  const serviziInEvidenza = SERVIZI.filter((s) =>
    [
      "correzione-bozze",
      "editing-narrativo",
      "scheda-valutazione-editoriale",
      "ghostwriting",
      "impaginazione",
      "copertina",
      "amazon-kdp",
      "strategia-di-lancio",
    ].includes(s.slug),
  );

  return (
    <>
      <JsonLd data={faqJsonLd(FAQ_HOME.map((f) => ({ q: f.domanda, a: f.risposta })))} />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <span className="alone -top-32 left-1/4 size-[32rem] bg-viola/25" />
        <Gabbia className="relative">
          <div className="grid items-center gap-16 pt-16 pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24 lg:pb-32">
            <div className="flex flex-col items-start gap-7">
              <Occhiello>Studio editoriale integrato</Occhiello>
              <h1 className="text-5xl leading-[1.02] font-semibold sm:text-6xl lg:text-7xl">
                Dalle idee
                <br />
                <span className="testo-identita">alle opere.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-testo-attenuato">
                Portiamo un manoscritto, un archivio di appunti o una sola idea fino al libro
                pubblicato. Un interlocutore solo, dalla prima lettura al mese dopo l&rsquo;uscita.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <BottoneLink href="/preventivo" variante="identita" misura="grande">
                  Fai il preventivo
                  <ArrowRight className="size-4" aria-hidden />
                </BottoneLink>
                <BottoneLink href="/percorsi" variante="fantasma" misura="grande">
                  Trova il tuo percorso
                </BottoneLink>
              </div>
              <p className="text-sm text-testo-tenue">
                Preventivo in due minuti, senza impegno. Oppure{" "}
                <a href="/contatti" className="garbo text-viola-chiaro underline underline-offset-4 decoration-viola-chiaro/40 hover:decoration-viola-chiaro">
                  parla con una persona
                </a>
                .
              </p>
            </div>

            <OggettoEditoriale className="mx-auto hidden w-full max-w-sm lg:block" />
          </div>
        </Gabbia>
      </section>

      {/* ── La filiera ─────────────────────────────────────────────────── */}
      <section className="border-y border-bordo bg-fondo-alto">
        <Gabbia className="py-10">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-3">
            {FILIERA.map((f, i) => (
              <li key={f.fase} className="flex items-center gap-3">
                <span
                  className="etichetta text-testo-attenuato"
                  title={f.testo}
                >
                  {f.fase}
                </span>
                {i < FILIERA.length - 1 ? (
                  <span aria-hidden className="text-testo-tenue/50">
                    /
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Gabbia>
      </section>

      {/* ── Promesse ───────────────────────────────────────────────────── */}
      <Sezione>
          <IntestazioneSezione
            occhiello="Perché noi"
            titolo="Tre cose che ci distinguono davvero."
            sotto="Non l'entusiasmo: il modo in cui è fatto il lavoro."
          />
          <div className="grid gap-5 md:grid-cols-3">
            {PROMESSE.map((p, i) => (
              <Apparizione key={p.titolo} ritardo={i * 0.08}>
                <Scheda className="flex h-full flex-col gap-4 p-7">
                  <p.icona className="size-5 text-lime" aria-hidden />
                  <h3 className="text-lg font-semibold text-testo">{p.titolo}</h3>
                  <p className="text-sm leading-relaxed text-testo-attenuato">{p.testo}</p>
                </Scheda>
              </Apparizione>
            ))}
          </div>
      </Sezione>

      {/* ── Percorsi ───────────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo">
          <IntestazioneSezione
            occhiello="Percorsi"
            titolo="Da dove parti?"
            sotto="Scegli come si presenta il tuo problema, non come si chiama il servizio."
            azione={{ href: "/percorsi", testo: "Tutti i percorsi" }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {percorsiInEvidenza.map((p, i) => (
              <Apparizione key={p.slug} ritardo={(i % 3) * 0.06}>
                <SchedaPercorso percorso={p} />
              </Apparizione>
            ))}
          </div>
      </Sezione>

      {/* ── Servizi ────────────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <IntestazioneSezione
            occhiello="Servizi"
            titolo="Oppure prendi solo quello che ti serve."
            sotto={`${SERVIZI.length} lavorazioni acquistabili singolarmente, con tariffe pubbliche dove esistono.`}
            azione={{ href: "/servizi", testo: "Catalogo completo" }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {serviziInEvidenza.map((s, i) => (
              <Apparizione key={s.slug} ritardo={(i % 4) * 0.05}>
                <SchedaServizio servizio={s} />
              </Apparizione>
            ))}
          </div>
      </Sezione>

      {/* ── Come lavoriamo ─────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <Apparizione className="flex flex-col gap-8">
              <Citazione fonte="Il principio che regola la piattaforma">
                Nessuna consegna raggiunge un cliente senza che una persona l&rsquo;abbia letta e
                approvata.
              </Citazione>
              <BottoneLink href="/come-funziona" variante="secondario">
                Come funziona nel dettaglio
              </BottoneLink>
            </Apparizione>

            <Apparizione ritardo={0.1}>
              <ol className="flex flex-col">
                {FILIERA.map((f, i) => (
                  <li key={f.fase} className="flex gap-5 border-b border-bordo py-5 last:border-0">
                    <span className="cifre w-8 shrink-0 pt-0.5 text-sm text-viola-chiaro">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-medium text-testo">{f.fase}</h3>
                      <p className="text-sm leading-relaxed text-testo-tenue">{f.testo}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Apparizione>
          </div>
      </Sezione>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <IntestazioneSezione occhiello="Domande" titolo="Quello che ci chiedono sempre." />
            <Faq voci={FAQ_HOME} />
          </div>
      </Sezione>

      <FasciaCta />
    </>
  );
}

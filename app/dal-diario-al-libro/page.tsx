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
import { BottoneLink } from "@/components/ui/bottone";
import { Processo, Chiusa } from "@/components/sezioni/blocchi";
import { Faq } from "@/components/sezioni/faq";
import { getService } from "@/config/services";
import { BRAND } from "@/config/brand";
import { fascia } from "@/lib/format";
import { metadatiPagina, JsonLd, serviceJsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const SERVIZIO = getService("dal-diario-al-libro")!;

export const metadata: Metadata = metadatiPagina({
  titolo: "Dal diario al libro",
  descrizione:
    "Trasformiamo diari, quaderni, registrazioni vocali e appunti in un libro scritto e pubblicato, mantenendo la voce di chi ha vissuto la storia.",
  path: "/dal-diario-al-libro",
});

const MATERIALI = [
  { titolo: "Quaderni e diari", nota: "Anche scritti a mano, anche senza date" },
  { titolo: "Registrazioni vocali", nota: "Ore di racconti: trascriviamo noi" },
  { titolo: "Lettere e documenti", nota: "Corrispondenza, fotografie, ritagli" },
  { titolo: "Solo ricordi", nota: "Li raccogliamo con interviste dedicate" },
];

export default function DalDiarioAlLibroPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd({
            nome: SERVIZIO.name,
            descrizione: SERVIZIO.claim,
            slug: SERVIZIO.slug,
            prezzo: SERVIZIO.priceRange,
          }),
          faqJsonLd(SERVIZIO.faq),
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Dal diario al libro", path: "/dal-diario-al-libro" },
          ]),
        ]}
      />

      {/* Apertura, sul lato notte: è l'offerta signature */}
      <section className="bg-notte text-carta su-notte py-16 sm:py-24">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <p className="apparato text-ottone">§ 00 · Signature</p>
                <p className="glossa text-carta/50 mt-3 hidden lg:block">
                  È il lavoro da cui è nato tutto il resto.
                </p>
              </>
            }
          >
            <h1 className="font-display text-[2.5rem] leading-[1.05] font-medium sm:text-[3.4rem]">
              Una vita raccontata
              <br />
              non è ancora un libro.
            </h1>
            <Filetto className="mt-7" tono="notte" />
            <p className="prosa-grande specchio text-carta/75 mt-7">
              Ci sono quaderni in un cassetto, o ore di registrazioni fatte a un padre prima che
              fosse tardi. Il materiale c&rsquo;è. Quello che manca è chi lo legga tutto, ne
              ricostruisca l&rsquo;ordine e lo scriva come si scrive un libro.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <BottoneLink
                href="/preventivo?tipo=memoir&servizio=dal-diario-al-libro"
                variante="chiaro"
                misura="grande"
              >
                Calcola il preventivo
              </BottoneLink>
              <BottoneLink href="/contatti" variante="secondarioNotte" misura="grande">
                Parliamone senza impegno
              </BottoneLink>
            </div>
          </Impaginato>
        </Gabbia>
      </section>

      {/* Da cosa si parte */}
      <Sezione>
        <Impaginato
          margine={
            <>
              <Folio n={1} etichetta="Materiali" />
              <NotaMargine>
                Non serve aver già scritto. Serve avere qualcosa da raccontare.
              </NotaMargine>
            </>
          }
        >
          <Titolo as="h2">Da cosa possiamo partire</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {MATERIALI.map((m) => (
              <Scheda key={m.titolo}>
                <h3 className="font-display text-lg font-medium">{m.titolo}</h3>
                <p className="prosa mt-2 text-[0.95rem]">{m.nota}</p>
              </Scheda>
            ))}
          </div>
        </Impaginato>
      </Sezione>

      {/* Processo */}
      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={2} etichetta="Metodo" />}>
          <Titolo as="h2">Come nasce il libro</Titolo>
          <div className="mt-8">
            <Processo passi={SERVIZIO.process.map((p) => ({ titolo: p.title, testo: p.desc }))} />
          </div>
        </Impaginato>
      </Sezione>

      {/* La voce */}
      <Sezione>
        <Impaginato margine={<Folio n={3} etichetta="La voce" />}>
          <div className="specchio">
            <Titolo as="h2">Sul tenere la voce di un altro</Titolo>
            <Filetto className="mt-5" />
            <p className="prosa-grande mt-6">
              Il rischio del ghostwriting è che il libro suoni come chi lo scrive invece che come
              chi lo racconta. Per questo lavoriamo per approvazioni: leggi i capitoli mentre
              nascono, e se una frase non è la tua ce lo dici.
            </p>
            <p className="prosa mt-4">
              Il metro di riuscita non è che il testo sia bello. È che chi conosceva quella persona,
              leggendolo, la riconosca.
            </p>
          </div>
        </Impaginato>
      </Sezione>

      {/* Prezzo */}
      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={4} etichetta="Costi" />}>
          <Titolo as="h2">Quanto costa</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <Scheda rilievo className="h-fit">
              <p className="apparato text-ottone">Fascia indicativa</p>
              <p className="cifre mt-3 text-2xl font-medium">
                {SERVIZIO.priceRange
                  ? fascia(SERVIZIO.priceRange.min, SERVIZIO.priceRange.max)
                  : "Su preventivo"}
              </p>
            </Scheda>
            <div>
              <p className="prosa">{SERVIZIO.priceDrivers}</p>
              <p className="prosa mt-4">
                La differenza la fa il materiale: chi porta diari già ordinati e leggibili paga meno
                di chi parte da ricordi da raccogliere in intervista. Il configuratore tiene conto
                anche di questo.
              </p>
            </div>
          </div>
        </Impaginato>
      </Sezione>

      {/* FAQ */}
      <Sezione>
        <Impaginato margine={<Folio n={5} etichetta="Domande" />}>
          <Titolo as="h2">Domande ricorrenti</Titolo>
          <div className="mt-8">
            <Faq voci={SERVIZIO.faq} />
          </div>
          <p className="glossa mt-10 max-w-2xl">{BRAND.aiDisclaimer}</p>
        </Impaginato>
      </Sezione>

      <Chiusa
        titolo="Raccontacela"
        testo="La prima conversazione serve a capire cosa c'è nel materiale e se c'è un libro dentro. È gratuita, riservata e non impegna a niente."
        hrefPreventivo="/preventivo?tipo=memoir&servizio=dal-diario-al-libro"
        hrefSecondario="/contatti"
        labelSecondaria="Prenota una call"
      />
    </>
  );
}

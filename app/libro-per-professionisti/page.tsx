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
import { Processo, ElencoIncluso, Chiusa } from "@/components/sezioni/blocchi";
import { Faq } from "@/components/sezioni/faq";
import { getService } from "@/config/services";
import { BRAND } from "@/config/brand";
import { fascia } from "@/lib/format";
import { metadatiPagina, JsonLd, serviceJsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const SERVIZIO = getService("libro-per-professionisti")!;

export const metadata: Metadata = metadatiPagina({
  titolo: "Il libro per professionisti",
  descrizione:
    "Un libro come strumento di posizionamento per consulenti, formatori e imprenditori: dal know-how sparso al manuale pubblicato, con il piano di lancio.",
  path: "/libro-per-professionisti",
});

const A_COSA_SERVE = [
  "Da lasciare al cliente dopo un incontro, al posto di una brochure che finisce nel cestino",
  "Come credenziale quando ti propongono come relatore",
  "Per far arrivare preparato chi ti contatta: chi ha letto il libro non chiede lo sconto",
  "Come contenuto da cui ricavare articoli, talk e materiali per un anno",
];

const DA_DOVE = [
  "Slide e dispense di corsi che hai già tenuto",
  "Registrazioni di aule, webinar, podcast",
  "Articoli e post scritti negli anni",
  "Solo la tua testa, raccolta in interviste",
];

export default function LibroProfessionistiPage() {
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
            { nome: "Libro per professionisti", path: "/libro-per-professionisti" },
          ]),
        ]}
      />

      <section className="bg-carta pt-14 pb-12 sm:pt-20">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <Folio n="00" etichetta="B2C professionale" />
                <NotaMargine>
                  Il libro non porta clienti perché esiste: perché dice qualcosa che gli altri non
                  dicono.
                </NotaMargine>
              </>
            }
          >
            <h1 className="font-display text-[2.5rem] leading-[1.05] font-medium sm:text-[3.4rem]">
              Sai già abbastanza
              <br />
              per scrivere un libro.
            </h1>
            <Filetto className="mt-7" />
            <p className="prosa-grande specchio mt-7">
              Anni di consulenze, corsi e problemi risolti per i clienti. Il contenuto esiste già,
              sparso fra slide, appunti e cose che ripeti a voce da sempre. Il nostro lavoro è
              tirarlo fuori e dargli la forma di un libro.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <BottoneLink
                href="/preventivo?tipo=libro-professionale&servizio=libro-per-professionisti"
                misura="grande"
              >
                Calcola il preventivo
              </BottoneLink>
              <BottoneLink href="/contatti" variante="secondario" misura="grande">
                Prenota una call
              </BottoneLink>
            </div>
          </Impaginato>
        </Gabbia>
      </section>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={1} etichetta="Utilità" />}>
          <Titolo as="h2">A cosa serve davvero</Titolo>
          <Filetto className="mt-5" />
          <p className="prosa specchio mt-6">
            Non promettiamo vendite: un libro professionale non si ripaga con le royalty, si ripaga
            con quello che apre.
          </p>
          <div className="mt-8">
            <ElencoIncluso voci={A_COSA_SERVE} />
          </div>
        </Impaginato>
      </Sezione>

      <Sezione>
        <Impaginato margine={<Folio n={2} etichetta="Materiali" />}>
          <Titolo as="h2">Da dove si parte</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {DA_DOVE.map((d) => (
              <Scheda key={d}>
                <p className="prosa text-[1rem]">{d}</p>
              </Scheda>
            ))}
          </div>
        </Impaginato>
      </Sezione>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={3} etichetta="Metodo" />}>
          <Titolo as="h2">Come procediamo</Titolo>
          <div className="mt-8">
            <Processo passi={SERVIZIO.process.map((p) => ({ titolo: p.title, testo: p.desc }))} />
          </div>
        </Impaginato>
      </Sezione>

      <Sezione>
        <Impaginato margine={<Folio n={4} etichetta="Contenuto" />}>
          <Titolo as="h2">Cosa comprende</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <ElencoIncluso voci={SERVIZIO.includes} />
            <Scheda className="h-fit">
              <p className="apparato text-ottone">Fascia di prezzo</p>
              <p className="cifre mt-3 text-2xl font-medium">
                {SERVIZIO.priceRange
                  ? fascia(SERVIZIO.priceRange.min, SERVIZIO.priceRange.max)
                  : "Su preventivo"}
              </p>
              <Filetto className="my-4" />
              <p className="prosa text-[0.95rem]">{SERVIZIO.priceDrivers}</p>
            </Scheda>
          </div>
        </Impaginato>
      </Sezione>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={5} etichetta="Domande" />}>
          <Titolo as="h2">Domande ricorrenti</Titolo>
          <div className="mt-8">
            <Faq voci={SERVIZIO.faq} />
          </div>
          <p className="glossa mt-10 max-w-2xl">{BRAND.aiDisclaimer}</p>
        </Impaginato>
      </Sezione>

      <Chiusa
        hrefPreventivo="/preventivo?tipo=libro-professionale&servizio=libro-per-professionisti"
        hrefSecondario="/contatti"
        labelSecondaria="Prenota una call"
      />
    </>
  );
}

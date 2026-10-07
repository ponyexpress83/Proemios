import type { Metadata } from "next";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Filetto, Sezione } from "@/components/sito/sezione";
import { metadatiPagina } from "@/lib/seo";
import { demoAttiva } from "@/lib/demo";
import { stripe, stripeConfigurato } from "@/lib/stripe";

export const metadata: Metadata = metadatiPagina({
  titolo: "Acconto ricevuto",
  descrizione: "Conferma dell'acconto per il tuo progetto editoriale.",
  path: "/preventivo/grazie",
  noindex: true,
});

const PASSI = [
  "Entro un giorno lavorativo ti scriviamo per fissare la call di avvio.",
  "Ci mandi i materiali definitivi: testo, immagini, riferimenti.",
  "Partiamo. Ogni consegna passa da una tua approvazione prima di proseguire.",
];

export default async function GraziePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; session_id?: string }>;
}) {
  const sp = await searchParams;
  // «Simulato» vale solo in demo: fuori, la pagina si fida solo di Stripe.
  const simulato = demoAttiva() && sp.demo === "1";
  let pagato = false;
  if (
    !demoAttiva() &&
    stripeConfigurato() &&
    sp.session_id &&
    /^cs_[a-zA-Z0-9_]{10,240}$/.test(sp.session_id)
  ) {
    try {
      const sessione = await stripe().checkout.sessions.retrieve(sp.session_id);
      pagato =
        sessione.mode === "payment" &&
        sessione.payment_status === "paid" &&
        Boolean(sessione.metadata?.quoteId);
    } catch {
      pagato = false;
    }
  }
  const confermato = simulato || pagato;

  return (
    <Sezione>
      <Contenitore stretto>
        <p className="maiuscoletto text-t-sm text-esito-ok">
          {simulato ? "Acconto simulato" : pagato ? "Acconto ricevuto" : "Conferma non disponibile"}
        </p>
        <h1 className="mt-3 font-serif text-t-display text-balance text-inchiostro">
          {confermato ? "La data è tua." : "Stiamo verificando il pagamento."}
        </h1>
        <Filetto className="mt-7" />

        {simulato && (
          <div className="mt-7 rounded-foglio border border-dashed border-grafite bg-carta-ombra p-5">
            <p className="maiuscoletto text-t-sm text-rosso-matita">Questa è una demo</p>
            <p className="mt-2 text-t-sm text-grafite">
              Nessun pagamento è stato aperto e nessun importo è stato addebitato. Nella versione in
              esercizio, da qui si passa al circuito di pagamento e la conferma arriva via email.
            </p>
          </div>
        )}

        <p className="mt-7 text-t-md text-grafite">
          {simulato
            ? "Da questo punto in poi il percorso è quello reale: ecco come procede un progetto una volta confermato."
            : pagato
              ? "Abbiamo registrato il pagamento e ti è arrivata una email di conferma. Il tuo progetto è entrato nel piano di lavorazione."
              : "Non abbiamo ancora la conferma del pagamento da questa pagina. Se hai completato l’acconto, la conferma arriva via email entro pochi minuti; altrimenti scrivici e lo verifichiamo insieme."}
        </p>

        <ol className="mt-10 space-y-4">
          {PASSI.map((p, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-pillola border border-inchiostro font-serif text-t-sm text-inchiostro">
                {i + 1}
              </span>
              <span className="text-t-base text-grafite">{p}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <PulsanteLink href="/accedi" variante="primario" freccia>
            Entra nell&rsquo;area autore
          </PulsanteLink>
          <PulsanteLink href="/contatti" variante="secondario">
            Scrivici
          </PulsanteLink>
        </div>
      </Contenitore>
    </Sezione>
  );
}

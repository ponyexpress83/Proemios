import type { Metadata } from "next";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Filetto, Sezione } from "@/components/sito/sezione";
import { metadatiPagina } from "@/lib/seo";

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
  searchParams: Promise<{ demo?: string }>;
}) {
  const sp = await searchParams;
  const simulato = sp.demo === "1";

  return (
    <Sezione>
      <Contenitore stretto>
        <p className="maiuscoletto text-t-sm text-esito-ok">
          {simulato ? "Acconto simulato" : "Acconto ricevuto"}
        </p>
        <h1 className="mt-3 font-serif text-t-display text-balance text-inchiostro">La data è tua.</h1>
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
            : "Abbiamo registrato il pagamento e ti è arrivata una email di conferma. Il tuo progetto è entrato nel piano di lavorazione."}
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

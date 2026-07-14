import type { Metadata } from "next";
import { LegalDoc } from "@/components/sections/LegalDoc";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Termini e condizioni",
  description: "Termini e condizioni dei servizi editoriali di Kalamos Studio.",
  path: "/termini",
  noindex: true,
});

export default function Termini() {
  return (
    <LegalDoc
      titolo="Termini e condizioni"
      aggiornamento="TODO"
      intro="I presenti termini regolano l'utilizzo del sito e la fornitura dei servizi editoriali di Kalamos Studio. Testo di esempio da completare."
      sezioni={[
        {
          titolo: "Oggetto",
          paragrafi: [
            "TODO — Descrizione dei servizi editoriali offerti e ambito di applicazione.",
          ],
        },
        {
          titolo: "Preventivi e acconti",
          paragrafi: [
            "TODO — I preventivi generati dal configuratore sono indicativi e soggetti a conferma. Per bloccare la data è richiesto un acconto pari al 40% dell'importo, saldato tramite pagamento sicuro.",
          ],
        },
        {
          titolo: "Pagamenti",
          paragrafi: [
            "TODO — Modalità di pagamento, tempistiche del saldo e gestione tramite provider di pagamento (Stripe).",
          ],
        },
        {
          titolo: "Consegne e revisioni",
          paragrafi: [
            "TODO — Tempi di consegna, numero di cicli di revisione inclusi e modalità di approvazione.",
          ],
        },
        {
          titolo: "Diritti d'autore",
          paragrafi: [
            "TODO — L'autore mantiene la titolarità dell'opera. Le clausole di riservatezza e white label per le agenzie sono disciplinate da accordi dedicati.",
          ],
        },
        {
          titolo: "Recesso e rimborsi",
          paragrafi: ["TODO — Condizioni di recesso e politica sui rimborsi degli acconti."],
        },
        {
          titolo: "Limitazione di responsabilità",
          paragrafi: [
            "TODO — L'analisi automatica del manoscritto è una stima preliminare, successivamente verificata da un professionista, e non costituisce garanzia di risultato.",
          ],
        },
        {
          titolo: "Legge applicabile e foro competente",
          paragrafi: ["TODO — Legge italiana e foro competente."],
        },
      ]}
    />
  );
}

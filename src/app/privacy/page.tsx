import type { Metadata } from "next";
import { LegalDoc } from "@/components/sections/LegalDoc";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "Informativa sul trattamento dei dati personali di Kalamos Studio.",
  path: "/privacy",
  noindex: true,
});

export default function Privacy() {
  return (
    <LegalDoc
      titolo="Informativa sulla privacy"
      aggiornamento="TODO"
      intro="La presente informativa descrive come Kalamos Studio raccoglie e tratta i dati personali degli utenti, in conformità al Regolamento (UE) 2016/679 (GDPR). Testo di esempio da completare."
      sezioni={[
        {
          titolo: "Titolare del trattamento",
          paragrafi: ["TODO — Ragione sociale, indirizzo e contatti del titolare del trattamento."],
        },
        {
          titolo: "Dati raccolti",
          paragrafi: [
            "TODO — Dati forniti tramite i moduli (nome, email, telefono, messaggi), dati del configuratore di preventivo e file caricati per l'analisi del manoscritto.",
          ],
        },
        {
          titolo: "Finalità e basi giuridiche",
          paragrafi: [
            "TODO — Riscontro alle richieste, invio di preventivi e report, gestione degli ordini, adempimenti contrattuali e di legge.",
          ],
        },
        {
          titolo: "Analisi del manoscritto e strumenti automatici",
          paragrafi: [
            "TODO — Il file caricato per l'analisi è elaborato tramite strumenti automatici per generare un report. Il file non è utilizzato per altri scopi ed è cancellato entro il periodo di conservazione indicato.",
          ],
        },
        {
          titolo: "Conservazione dei dati",
          paragrafi: ["TODO — Periodi di conservazione per ciascuna categoria di dati."],
        },
        {
          titolo: "Diritti dell'interessato",
          paragrafi: [
            "TODO — Accesso, rettifica, cancellazione, opposizione e portabilità dei dati.",
          ],
        },
        {
          titolo: "Contatti",
          paragrafi: ["TODO — Indirizzo email per l'esercizio dei diritti in materia di privacy."],
        },
      ]}
    />
  );
}

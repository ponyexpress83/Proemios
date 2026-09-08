"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bottone } from "@/components/ui/bottone";
import { AreaTesto } from "@/components/ui/campi";
import { Avviso } from "@/components/ui/stati";
import { Nota } from "@/components/ui/primitivi";
import { approvaRevisione, rimandaRevisione } from "@/app/redazione/azioni";

/**
 * Chiusura della revisione.
 *
 * L'approvazione editoriale è il momento in cui gli interventi diventano un
 * documento Word con le revisioni tracciate. Il pulsante resta spento finché
 * c'è anche un solo intervento non deciso: generare il file a metà revisione
 * significherebbe mettere nel documento consegnabile una scelta che nessuno ha
 * fatto.
 *
 * Quello che questo pannello **non** offre è la consegna. Il capitolato è
 * esplicito e il codice lo rispecchia: chi approva editorialmente non consegna
 * al cliente. La consegna vive nel back-office, dietro un altro permesso e
 * un'altra persona.
 */
export function ChiusuraRevisione({
  jobId,
  inSospeso,
  puoApprovare,
}: {
  jobId: string;
  inSospeso: number;
  puoApprovare: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{
    applicati: number;
    richiedeVerifica: boolean;
    nota?: string;
  } | null>(null);
  const [inCorso, avvia] = useTransition();

  function approva() {
    setErrore(null);
    avvia(async () => {
      const r = await approvaRevisione({ jobId, noteInterne: note || undefined });
      if (!r.ok) {
        setErrore(r.messaggio);
        return;
      }
      setEsito(r.dati);
      router.refresh();
    });
  }

  function rimanda(tipo: "rimandato" | "escalation") {
    setErrore(null);
    if (!note.trim()) {
      setErrore("Serve una nota che spieghi perché la lavorazione torna indietro.");
      return;
    }
    avvia(async () => {
      const r = await rimandaRevisione({ jobId, esito: tipo, noteInterne: note });
      if (!r.ok) {
        setErrore(r.messaggio);
        return;
      }
      router.refresh();
    });
  }

  if (esito) {
    return (
      <Avviso
        tono={esito.richiedeVerifica ? "attenzione" : "successo"}
        titolo={
          esito.richiedeVerifica
            ? "Documento generato, ma da controllare"
            : "Revisione approvata e documento generato"
        }
      >
        {esito.applicati} interventi sono finiti nel documento con le revisioni tracciate.{" "}
        {esito.richiedeVerifica
          ? `${esito.nota ?? "Alcuni interventi non sono stati applicati."} Il file è segnato da verificare e non può essere consegnato finché qualcuno non lo apre.`
          : "La consegna al cliente resta a chi ha il permesso di approvarla."}
      </Avviso>
    );
  }

  return (
    <div className="border-bordo bg-superficie flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-testo text-base font-semibold">Chiudi la revisione</h2>
        <Nota>
          Approvando si genera il documento Word con le revisioni tracciate, a partire
          dall&apos;originale. Non viene consegnato niente al cliente.
        </Nota>
      </div>

      {errore ? (
        <Avviso tono="errore" titolo="Non è stato possibile procedere">
          {errore}
        </Avviso>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note-revisione" className="etichetta text-testo-tenue">
          Note interne (non escono dal back-office)
        </label>
        <AreaTesto
          id="note-revisione"
          className="min-h-20 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Cosa ha richiesto attenzione, cosa resta da guardare."
        />
      </div>

      {inSospeso > 0 ? (
        <Avviso tono="attenzione" titolo={`${inSospeso} interventi non decisi`}>
          Il documento si genera a revisione conclusa: ogni proposta va accettata, modificata o
          rifiutata.
        </Avviso>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Bottone disabled={!puoApprovare || inSospeso > 0 || inCorso} onClick={approva}>
          {inCorso ? "Genero il documento…" : "Approva e genera il documento"}
        </Bottone>
        <Bottone variante="secondario" disabled={inCorso} onClick={() => rimanda("rimandato")}>
          Rimanda in lavorazione
        </Bottone>
        <Bottone variante="quieto" disabled={inCorso} onClick={() => rimanda("escalation")}>
          Chiedi un chiarimento
        </Bottone>
      </div>

      {!puoApprovare ? (
        <Nota>
          Il tuo ruolo non comprende l&apos;approvazione editoriale: puoi decidere gli interventi e
          rimandare la lavorazione.
        </Nota>
      ) : null}
    </div>
  );
}

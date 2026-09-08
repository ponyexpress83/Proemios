"use client";

import { useEffect } from "react";
import { Gabbia, Occhiello } from "@/components/ui/primitivi";
import { Bottone, BottoneLink } from "@/components/ui/bottone";
import { Avviso } from "@/components/ui/stati";

/**
 * Schermata di errore.
 *
 * Non mostra il messaggio dell'eccezione: un errore applicativo può contenere
 * un id, una query o un frammento di dati che non riguardano chi sta guardando.
 * Compare solo il `digest`, che Next.js correla al log lato server — l'utente
 * può citarlo all'assistenza, e nessun dettaglio esce dalla macchina.
 */
export default function ErroreApplicazione({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Il tracciamento vero (Fase 8) sostituirà questo console.error.
    console.error("[errore]", { digest: error.digest });
  }, [error]);

  return (
    <Gabbia className="flex min-h-[60dvh] items-center justify-center py-16">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Occhiello>Errore</Occhiello>
        <h1 className="text-3xl font-semibold text-testo">Qualcosa non ha funzionato.</h1>
        <Avviso tono="errore">
          Ce ne stiamo occupando. Se il problema si ripete, riferisci questo codice
          all&rsquo;assistenza.
          {error.digest ? (
            <>
              {" "}
              <span className="cifre">{error.digest}</span>
            </>
          ) : null}
        </Avviso>
        <div className="mt-2 flex gap-3">
          <Bottone onClick={reset}>Riprova</Bottone>
          <BottoneLink href="/" variante="secondario">
            Torna alla home
          </BottoneLink>
        </div>
      </div>
    </Gabbia>
  );
}

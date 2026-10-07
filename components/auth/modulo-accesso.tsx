"use client";

import { useState, useTransition } from "react";
import { Campo, Input } from "@/components/sito/campo";
import { Pulsante } from "@/components/sito/pulsante";
import { richiediLinkAccesso } from "@/app/accedi/azioni";
import { cn } from "@/lib/cn";

/**
 * Richiesta del link di accesso.
 *
 * L'esito è **sempre lo stesso**, che l'indirizzo esista o no: un messaggio
 * diverso permetterebbe di scoprire quali indirizzi hanno un account.
 */
export function ModuloAccesso({
  destinazione,
  className,
}: {
  destinazione?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);
  const [inCorso, avvia] = useTransition();

  if (inviato) {
    return (
      <div className={cn("rounded-foglio border-t-4 border-esito-ok bg-bianco p-6 shadow-foglio", className)} role="status">
        <h2 className="font-serif text-t-lg text-inchiostro">Controlla la posta.</h2>
        <p className="mt-2 text-t-base text-grafite">
          Se esiste un account per <strong className="text-inchiostro">{email}</strong>, il link di
          accesso è appena partito. Vale una volta sola.
        </p>
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        setErrore(null);
        avvia(async () => {
          const esito = await richiediLinkAccesso({ email, destinazione });
          if (esito.ok) setInviato(true);
          else setErrore(esito.messaggio);
        });
      }}
    >
      <Campo label="Indirizzo email" id="email-accesso" obbligatorio errore={errore ?? undefined}>
        {(props) => (
          <Input
            {...props}
            type="email"
            inputMode="email"
            name="email"
            autoComplete="email"
            placeholder="nome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Campo>

      <Pulsante type="submit" variante="primario" disabled={inCorso}>
        {inCorso ? "Un momento…" : "Mandami il link di accesso"}
      </Pulsante>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Campo, Input } from "@/components/ui/campi";
import { Bottone } from "@/components/ui/bottone";
import { Avviso } from "@/components/ui/stati";
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
      <Avviso tono="successo" titolo="Controlla la posta" className={className}>
        Se esiste un account per <strong>{email}</strong>, il link di accesso è appena partito.
        Vale una volta sola.
      </Avviso>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
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
      <Campo label="Indirizzo email" id="email-accesso" obbligatorio>
        {(props) => (
          <Input
            {...props}
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="nome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Campo>

      {errore ? <Avviso tono="errore">{errore}</Avviso> : null}

      <Bottone type="submit" variante="identita" misura="grande" disabled={inCorso}>
        {inCorso ? "Un momento…" : "Mandami il link"}
      </Bottone>
    </form>
  );
}

import type { Metadata } from "next";
import { PulsanteLink } from "@/components/sito/pulsante";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Accesso non riuscito",
  descrizione: "Il link di accesso non ha funzionato: come richiederne un altro.",
  path: "/accedi/errore",
  noindex: true,
});

/**
 * I motivi restituiti da Auth.js sono tecnici. Qui vengono tradotti in
 * spiegazioni utili, senza rivelare se un indirizzo esiste o no: dire
 * «questo indirizzo non è registrato» permette di enumerare gli account.
 */
const SPIEGAZIONI: Record<string, string> = {
  Verification: "Il link è scaduto o è già stato usato. I link di accesso valgono una volta sola.",
  AccessDenied:
    "Questo indirizzo non può accedere. L'accesso è su invito: se dovresti averne uno, scrivi al tuo referente.",
  Configuration:
    "L'invio delle email di accesso non è configurato correttamente. Ce ne stiamo occupando.",
};

export default async function ErroreAccesso({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const spiegazione =
    (error && SPIEGAZIONI[error]) ??
    "Non siamo riusciti a completare l'accesso. Prova a richiedere un altro link.";

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-serif text-t-xl text-balance text-inchiostro">Non ha funzionato.</h1>
      <div className="mt-4 rounded-foglio border-2 border-rosso-matita bg-bianco p-4 text-t-base text-inchiostro" role="alert">
        {spiegazione}
      </div>
      <div className="mt-8">
        <PulsanteLink href="/accedi" variante="primario">
          Richiedi un altro link
        </PulsanteLink>
      </div>
    </div>
  );
}

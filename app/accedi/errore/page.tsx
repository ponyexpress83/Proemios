import type { Metadata } from "next";
import { Gabbia, Occhiello } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { Avviso } from "@/components/ui/stati";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Accesso non riuscito",
  descrizione: "",
  path: "/accedi/errore",
  noindex: true,
});

/**
 * I motivi restituiti da Auth.js sono tecnici. Qui vengono tradotti in
 * spiegazioni utili, senza rivelare se un indirizzo esiste o no: dire
 * «questo indirizzo non è registrato» permette di enumerare gli account.
 */
const SPIEGAZIONI: Record<string, string> = {
  Verification:
    "Il link è scaduto o è già stato usato. I link di accesso valgono una volta sola.",
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
    <Gabbia className="flex min-h-[70dvh] items-center justify-center py-16">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Occhiello>Accesso</Occhiello>
        <h1 className="text-3xl font-semibold text-testo">Non ha funzionato.</h1>
        <Avviso tono="errore">{spiegazione}</Avviso>
        <BottoneLink href="/accedi" variante="identita" className="mt-2 self-start">
          Riprova
        </BottoneLink>
      </div>
    </Gabbia>
  );
}

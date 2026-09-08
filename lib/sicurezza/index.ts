/**
 * Protezione degli endpoint pubblici.
 *
 * Un unico punto d'ingresso: `proteggi` conta la richiesta e, se ha superato il
 * limite, restituisce la risposta da rimandare al chiamante — con
 * `Retry-After`, che è ciò che un client corretto legge per aspettare invece di
 * insistere.
 */
import { NextResponse } from "next/server";
import { chiaveLimite, origineRichiesta, REGOLE } from "./limite";
import { conta } from "./store-limite";

export * from "./limite";
export { ripulisci } from "./store-limite";

/**
 * Applica il limite a un endpoint.
 *
 * Restituisce `null` se la richiesta può proseguire, o la risposta 429 già
 * pronta. L'identificatore predefinito è l'origine della richiesta; passarne
 * uno diverso (un'email, un id di preventivo) serve a contare per soggetto e
 * non per indirizzo, dove ha più senso.
 */
export async function proteggi(
  endpoint: keyof typeof REGOLE,
  richiesta: Request,
  identificatore?: string,
): Promise<NextResponse | null> {
  const regola = REGOLE[endpoint];
  if (!regola) return null;

  const chiave = await chiaveLimite(
    endpoint,
    identificatore ?? origineRichiesta(richiesta.headers),
  );
  const esito = await conta(chiave, regola);
  if (esito.ammessa) return null;

  return NextResponse.json(
    {
      errore:
        "Troppe richieste in poco tempo. Aspetta qualche minuto e riprova, oppure scrivici direttamente.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(esito.attendiSecondi),
        "Cache-Control": "no-store",
      },
    },
  );
}

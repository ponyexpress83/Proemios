import { serve } from "inngest/next";
import { inngest } from "@/lib/lavori/client";
import { funzioni } from "@/lib/lavori/funzioni";

/**
 * Endpoint delle funzioni durevoli.
 *
 * Inngest chiama questa rotta per eseguire i passi. La firma delle richieste è
 * verificata dalla libreria con `INNGEST_SIGNING_KEY`: senza quella chiave, in
 * produzione, l'endpoint rifiuta le chiamate — è ciò che impedisce a chiunque
 * di far partire l'elaborazione di un manoscritto.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: funzioni,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

// Le elaborazioni possono durare a lungo: il runtime Node, non l'edge.
export const runtime = "nodejs";
export const maxDuration = 300;

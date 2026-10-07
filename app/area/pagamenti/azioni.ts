"use server";

import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { apriPagamento, PagamentiNonConfigurati } from "@/lib/pagamenti/stripe";

export type EsitoPagamento = { ok: true; url: string } | { ok: false; messaggio: string };

const schema = z.object({ pagamentoId: z.string().uuid() });

/**
 * Apre il pagamento di una rata.
 *
 * Riceve **solo** l'id della rata: l'importo lo legge il livello dati
 * dall'ordine. Se questa funzione accettasse una cifra, quella cifra sarebbe
 * scelta dal browser.
 */
export async function paga(dati: z.input<typeof schema>): Promise<EsitoPagamento> {
  const analisi = schema.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Richiesta non valida." };

  try {
    const attore = await esigiAttore();
    const { url } = await apriPagamento(attore, analisi.data.pagamentoId, {
      successo: "/area/pagamenti?esito=ok",
      annullato: "/area/pagamenti?esito=annullato",
    });
    return { ok: true, url };
  } catch (errore) {
    if (errore instanceof PagamentiNonConfigurati) {
      return {
        ok: false,
        messaggio: "Il pagamento online non è attivo: scrivici e ti mandiamo gli estremi.",
      };
    }
    if (isErroreAutorizzazione(errore)) return { ok: false, messaggio: errore.message };
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Non è stato possibile procedere.",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { leggiPagamento, registraPagamentoManuale, registraRimborso } from "@/lib/dati/pagamenti";
import { emettiFattura, preparaFattura } from "@/lib/dati/fatture";
import { rimborsaSuStripe, PagamentiNonConfigurati } from "@/lib/pagamenti/stripe";

export type EsitoAzione = { ok: true; messaggio?: string } | { ok: false; messaggio: string };

async function esegui(azione: () => Promise<string | void>): Promise<EsitoAzione> {
  try {
    const messaggio = await azione();
    revalidatePath("/admin/pagamenti");
    return { ok: true, messaggio: messaggio ?? undefined };
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) return { ok: false, messaggio: errore.message };
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Operazione non riuscita.",
    };
  }
}

const schemaManuale = z.object({
  pagamentoId: z.string().uuid(),
  metodo: z.enum(["bonifico", "altro"]),
  riferimentoEsterno: z.string().min(1).max(200),
});

export async function registraIncasso(dati: z.input<typeof schemaManuale>): Promise<EsitoAzione> {
  const analisi = schemaManuale.safeParse(dati);
  if (!analisi.success) {
    return { ok: false, messaggio: "Serve il riferimento dell'incasso (CRO, estremi)." };
  }
  return esegui(async () => {
    const attore = await esigiAttore();
    await registraPagamentoManuale(attore, analisi.data.pagamentoId, {
      metodo: analisi.data.metodo,
      riferimentoEsterno: analisi.data.riferimentoEsterno,
    });
    return "Incasso registrato.";
  });
}

const schemaRimborso = z.object({
  pagamentoId: z.string().uuid(),
  importoCent: z.number().int().positive(),
  motivo: z.string().min(1).max(500),
});

/**
 * Rimborsa.
 *
 * L'ordine delle operazioni è deliberato: **prima si rimborsa davvero su
 * Stripe, poi lo si registra**. Scrivere prima significherebbe avere in
 * contabilità un rimborso che la banca non ha mai fatto — un errore che si
 * scopre solo quando il cliente richiama.
 *
 * Per un incasso arrivato per bonifico non c'è nulla da chiedere a Stripe: si
 * registra il rimborso, che qualcuno ha disposto altrove.
 */
export async function rimborsa(dati: z.input<typeof schemaRimborso>): Promise<EsitoAzione> {
  const analisi = schemaRimborso.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati del rimborso non validi." };

  return esegui(async () => {
    const attore = await esigiAttore();
    const rata = await leggiPagamento(attore, analisi.data.pagamentoId);
    // Il DTO dello staff porta i riferimenti Stripe; quello del cliente no, e
    // il controllo qui è ciò che tiene le due forme distinte senza un cast.
    const intent =
      "stripePaymentIntentId" in rata && typeof rata.stripePaymentIntentId === "string"
        ? rata.stripePaymentIntentId
        : null;

    if (intent) {
      try {
        await rimborsaSuStripe(intent, analisi.data.importoCent, analisi.data.motivo);
      } catch (errore) {
        if (!(errore instanceof PagamentiNonConfigurati)) throw errore;
        throw new Error(
          "Stripe non è configurato: non si può rimborsare un incasso arrivato da Stripe.",
        );
      }
    }

    const esito = await registraRimborso(
      attore,
      analisi.data.pagamentoId,
      analisi.data.importoCent,
      analisi.data.motivo,
    );
    return esito.completo ? "Rimborso completo registrato." : "Rimborso parziale registrato.";
  });
}

const schemaFattura = z.object({ pagamentoId: z.string().uuid() });

/** Prepara la fattura di un incasso e la emette presso il provider. */
export async function fattura(dati: z.input<typeof schemaFattura>): Promise<EsitoAzione> {
  const analisi = schemaFattura.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(async () => {
    const attore = await esigiAttore();
    const preparata = await preparaFattura(attore, analisi.data.pagamentoId);
    if (preparata.stato === "emessa") return "La fattura era già stata emessa.";
    const emessa = await emettiFattura(attore, preparata.id);
    return `Fattura ${emessa.numeroDocumento ?? ""} emessa.`;
  });
}

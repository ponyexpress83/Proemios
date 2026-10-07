/**
 * Emissione delle fatture.
 *
 * Proemios non emette il documento: lo chiede al provider e ne conserva il
 * riferimento. Il rischio da governare è **il doppione** — una fattura emessa
 * due volte è un problema fiscale, non un fastidio — e la difesa è in tre
 * strati:
 *
 *  1. la riga passa per `in_emissione` prima della chiamata, e la transizione
 *     avviene solo se era `da_emettere`: due richieste contemporanee non
 *     entrano entrambe;
 *  2. una riga già `emessa` non si riemette mai;
 *  3. un errore *non* ritentabile la porta in `errore` e la ferma lì, perché
 *     riprovare con gli stessi dati non risolve.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, orders, payments } from "@/db/schema/commercio";
import { clients } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { providerFatturazione, ErroreFatturazione } from "@/lib/fatturazione";
import type { DatiFatturazione } from "@/lib/fatturazione/provider";
import { fatturaPerStaff, type FatturaPerStaff } from "@/lib/dto/commercio";

type RigaCliente = typeof clients.$inferSelect;

/** Traduce l'anagrafica cliente nei dati che il provider si aspetta. */
export function datiFatturazioneDaCliente(c: RigaCliente): DatiFatturazione {
  return {
    denominazione:
      c.tipo === "azienda"
        ? (c.ragioneSociale ?? c.nome)
        : [c.nome, c.cognome].filter(Boolean).join(" "),
    indirizzo: c.indirizzo?.via ?? null,
    cap: c.indirizzo?.cap ?? null,
    citta: c.indirizzo?.citta ?? null,
    provincia: c.indirizzo?.provincia ?? null,
    paese: c.indirizzo?.paese ?? "Italia",
    partitaIva: c.partitaIva,
    codiceFiscale: c.codiceFiscale,
    codiceDestinatario: c.codiceDestinatario,
    pec: c.pec,
    email: c.email,
  };
}

/**
 * Verifica che l'anagrafica basti a emettere.
 *
 * Meglio fermarsi qui, con un messaggio che dice cosa manca, che mandare al
 * provider dati incompleti e ricevere un rifiuto da interpretare.
 */
export function datiSufficientiPerFattura(d: DatiFatturazione): {
  ok: boolean;
  mancanti: string[];
} {
  const mancanti: string[] = [];
  if (!d.denominazione?.trim()) mancanti.push("denominazione");
  if (!d.partitaIva && !d.codiceFiscale) mancanti.push("partita IVA o codice fiscale");
  if (!d.indirizzo || !d.cap || !d.citta) mancanti.push("indirizzo completo");
  // Per la fattura elettronica serve un recapito: codice destinatario o PEC.
  if (!d.codiceDestinatario && !d.pec) mancanti.push("codice destinatario o PEC");
  return { ok: mancanti.length === 0, mancanti };
}

/**
 * Prepara la riga di fattura per un incasso, senza emetterla.
 *
 * Separare la preparazione dall'emissione permette all'amministrazione di
 * vedere cosa c'è da fatturare prima che parta qualunque chiamata.
 */
export async function preparaFattura(
  attore: Attore,
  pagamentoId: string,
): Promise<FatturaPerStaff> {
  esigiPermesso(attore, "fattura.emetti");
  const db = getDb();

  const [riga] = await db
    .select({ pagamento: payments, ordine: orders, cliente: clients })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(eq(payments.id, pagamentoId), eq(payments.organizationId, attore.organizationId)))
    .limit(1);
  if (!riga) throw new NonTrovato(`pagamento ${pagamentoId} inesistente o di altro tenant`);
  if (riga.pagamento.stato !== "pagato") {
    throw new Error("Si fattura ciò che è stato incassato.");
  }

  const [gia] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.paymentId, pagamentoId))
    .limit(1);
  if (gia) return fatturaPerStaff(gia);

  // L'IVA si ricava dalle proporzioni dell'ordine: la rata è una quota del
  // totale, e la sua parte di imposta segue la stessa quota.
  const quota = riga.pagamento.importoCent / riga.ordine.totaleCent;
  const imponibileCent = Math.round(riga.ordine.imponibileCent * quota);
  const ivaCent = riga.pagamento.importoCent - imponibileCent;

  const [creata] = await db
    .insert(invoices)
    .values({
      organizationId: attore.organizationId,
      clientId: riga.ordine.clientId,
      orderId: riga.ordine.id,
      paymentId: pagamentoId,
      stato: "da_emettere",
      imponibileCent,
      ivaCent,
      totaleCent: riga.pagamento.importoCent,
      datiFatturazione: datiFatturazioneDaCliente(riga.cliente) as Record<string, unknown>,
    })
    .returning();

  return fatturaPerStaff(creata!);
}

/**
 * Emette la fattura presso il provider.
 *
 * Il passaggio a `in_emissione` è condizionato a `da_emettere` e avviene prima
 * della chiamata: è il lucchetto che impedisce a due richieste contemporanee di
 * emettere due documenti per lo stesso incasso.
 */
export async function emettiFattura(attore: Attore, fatturaId: string): Promise<FatturaPerStaff> {
  esigiPermesso(attore, "fattura.emetti");
  const db = getDb();

  const [attuale] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, fatturaId), eq(invoices.organizationId, attore.organizationId)))
    .limit(1);
  if (!attuale) throw new NonTrovato(`fattura ${fatturaId} inesistente o di altro tenant`);
  if (attuale.stato === "emessa") return fatturaPerStaff(attuale);
  if (attuale.stato === "annullata") throw new Error("La fattura è annullata.");

  const [presa] = await db
    .update(invoices)
    .set({ stato: "in_emissione", tentativi: attuale.tentativi + 1, updatedAt: new Date() })
    .where(and(eq(invoices.id, fatturaId), eq(invoices.stato, attuale.stato)))
    .returning();
  if (!presa) {
    throw new Error("L'emissione di questa fattura è già in corso.");
  }

  const dati = (attuale.datiFatturazione ?? {}) as DatiFatturazione;
  const controllo = datiSufficientiPerFattura(dati);
  if (!controllo.ok) {
    await segnaErrore(fatturaId, `Dati mancanti: ${controllo.mancanti.join(", ")}.`);
    throw new Error(
      `Non si può emettere: mancano ${controllo.mancanti.join(", ")} nell'anagrafica del cliente.`,
    );
  }

  const provider = providerFatturazione();

  try {
    const documento = await provider.emetti({
      riferimento: fatturaId,
      cliente: dati,
      righe: [
        {
          descrizione: "Servizi editoriali",
          quantita: 1,
          prezzoUnitarioCent: attuale.imponibileCent,
          ivaPuntiBase:
            attuale.imponibileCent > 0
              ? Math.round((attuale.ivaCent / attuale.imponibileCent) * 10_000)
              : 0,
        },
      ],
    });

    const [emessa] = await db
      .update(invoices)
      .set({
        stato: "emessa",
        providerNome: provider.nome,
        providerDocumentoId: documento.providerDocumentoId,
        numeroDocumento: documento.numeroDocumento,
        dataDocumento: documento.dataDocumento,
        urlDocumento: documento.urlDocumento ?? null,
        erroreMessaggio: null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, fatturaId))
      .returning();

    await registra(attore, {
      azione: "fattura.emessa",
      entita: "fattura",
      entitaId: fatturaId,
      metadati: {
        provider: provider.nome,
        numero: documento.numeroDocumento,
        totaleCent: documento.totaleCent,
      },
    });

    return fatturaPerStaff(emessa!);
  } catch (errore) {
    const ritentabile = errore instanceof ErroreFatturazione ? errore.ritentabile : false;
    // Un errore ritentabile torna a `da_emettere` e potrà ripartire; uno
    // definitivo si ferma in `errore` e chiede l'intervento di una persona.
    await segnaErrore(
      fatturaId,
      errore instanceof Error ? errore.message : "Errore del provider.",
      ritentabile,
    );
    await registra(attore, {
      azione: "fattura.errore",
      entita: "fattura",
      entitaId: fatturaId,
      esito: "errore",
      metadati: { ritentabile },
    });
    throw errore;
  }
}

async function segnaErrore(fatturaId: string, messaggio: string, ritentabile = false) {
  const db = getDb();
  await db
    .update(invoices)
    .set({
      stato: ritentabile ? "da_emettere" : "errore",
      erroreMessaggio: messaggio.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, fatturaId));
}

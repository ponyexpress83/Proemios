/**
 * Ordini, piano di pagamento e incassi.
 *
 * Regola che vale in tutto il modulo: **l'importo non arriva mai dal client**.
 * Si legge dall'ordine in database, che a sua volta nasce da un preventivo
 * approvato. Un prezzo che passa per il browser è un prezzo che il browser può
 * scegliere.
 *
 * Come altrove, ogni funzione riceve un `Attore` e filtra dentro la query: non
 * esiste una lettura senza tenant.
 */
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contracts, invoices, orders, payments } from "@/db/schema/commercio";
import { clients, quotes } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import {
  ACCONTO_PUNTI_BASE,
  conIva,
  ordineSaldato,
  pianoPagamenti,
  residuoDaIncassare,
  type RichiestaPiano,
} from "@/lib/commercio/piano";
import {
  fatturaPerCliente,
  fatturaPerStaff,
  ordinePerCliente,
  ordinePerStaff,
  pagamentoPerCliente,
  pagamentoPerStaff,
  type FatturaPerCliente,
  type OrdinePerCliente,
  type PagamentoPerCliente,
} from "@/lib/dto/commercio";

/**
 * Un ordine è visibile allo staff con `ordine.vedi` dentro il proprio tenant, e
 * al cliente **solo se è suo**. Il filtro è nella query.
 */
function condizioneVisibilita(attore: Attore) {
  const tenant = eq(orders.organizationId, attore.organizationId);
  if (attore.ruolo === "client") {
    return and(tenant, attore.clientId ? eq(orders.clientId, attore.clientId) : sql`false`);
  }
  if (haPermesso(attore, "ordine.vedi")) return tenant;
  return sql`false`;
}

/** Codice ordine progressivo per anno: O-2026-0001. */
async function prossimoCodice(organizationId: string): Promise<string> {
  const db = getDb();
  const anno = new Date().getFullYear();
  const [riga] = await db
    .select({ n: count() })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        sql`extract(year from ${orders.createdAt}) = ${anno}`,
      ),
    );
  return `O-${anno}-${String(Number(riga?.n ?? 0) + 1).padStart(4, "0")}`;
}

export type DatiOrdine = {
  clientId: string;
  quoteId?: string;
  /** Imponibile in centesimi. L'IVA si calcola qui, non la si accetta da fuori. */
  imponibileCent: number;
  /** Punti base di IVA. Zero per un'operazione non imponibile. */
  ivaPuntiBase?: number;
  piano?: Omit<RichiestaPiano, "totaleCent">;
  noteInterne?: string;
};

export type OrdineCreato = {
  ordine: OrdinePerCliente;
  rate: PagamentoPerCliente[];
};

/**
 * Crea l'ordine e il suo piano di pagamento in un'unica transazione.
 *
 * O nascono entrambi o non nasce niente: un ordine senza rate è un impegno che
 * nessuno sa come incassare, e delle rate senza ordine sono righe orfane in
 * contabilità.
 */
export async function creaOrdine(attore: Attore, dati: DatiOrdine): Promise<OrdineCreato> {
  esigiPermesso(attore, "ordine.crea");

  if (!Number.isInteger(dati.imponibileCent) || dati.imponibileCent <= 0) {
    throw new Error("L'imponibile dev'essere un importo positivo in centesimi.");
  }

  const db = getDb();

  // Il cliente dev'essere del tenant di chi crea l'ordine.
  const [cliente] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, dati.clientId), eq(clients.organizationId, attore.organizationId)))
    .limit(1);
  if (!cliente) throw new NonTrovato(`cliente ${dati.clientId} inesistente o di altro tenant`);

  if (dati.quoteId) {
    const [preventivo] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, dati.quoteId), eq(quotes.organizationId, attore.organizationId)))
      .limit(1);
    if (!preventivo) {
      throw new NonTrovato(`preventivo ${dati.quoteId} inesistente o di altro tenant`);
    }
  }

  const importi = conIva(dati.imponibileCent, dati.ivaPuntiBase);
  const richiesta: RichiestaPiano = {
    totaleCent: importi.totaleCent,
    modalita: dati.piano?.modalita ?? "acconto_saldo",
    accontoPuntiBase: dati.piano?.accontoPuntiBase,
    milestone: dati.piano?.milestone,
    rate: dati.piano?.rate,
  };
  // Il piano si calcola prima della transazione: se non quadra, non si è
  // ancora scritto niente da disfare.
  const rate = pianoPagamenti(richiesta);
  const accontoPuntiBase = richiesta.accontoPuntiBase ?? ACCONTO_PUNTI_BASE;
  const accontoCent = rate.find((r) => r.tipo === "acconto")?.importoCent ?? 0;

  const codice = await prossimoCodice(attore.organizationId);

  return db.transaction(async (tx) => {
    const [ordine] = await tx
      .insert(orders)
      .values({
        codice,
        organizationId: attore.organizationId,
        clientId: dati.clientId,
        quoteId: dati.quoteId ?? null,
        stato: "bozza",
        imponibileCent: importi.imponibileCent,
        ivaCent: importi.ivaCent,
        totaleCent: importi.totaleCent,
        accontoPuntiBase,
        accontoCent,
        creatoDaId: attore.userId,
        noteInterne: dati.noteInterne ?? null,
      })
      .returning();

    const righe = await tx
      .insert(payments)
      .values(
        rate.map((r) => ({
          organizationId: attore.organizationId,
          orderId: ordine!.id,
          clientId: dati.clientId,
          milestoneId: r.riferimentoMilestone ?? null,
          tipo: r.tipo,
          metodo: "stripe" as const,
          stato: "in_attesa" as const,
          importoCent: r.importoCent,
        })),
      )
      .returning();

    await registra(
      attore,
      {
        azione: "ordine.creato",
        entita: "ordine",
        entitaId: ordine!.id,
        metadati: { codice, totaleCent: importi.totaleCent, rate: righe.length },
      },
      tx,
    );

    return {
      ordine: ordinePerCliente(ordine!),
      rate: righe.map(pagamentoPerCliente),
    };
  });
}

export type DettaglioOrdine = {
  ordine: ReturnType<typeof ordinePerStaff> | OrdinePerCliente;
  rate: PagamentoPerCliente[];
  fatture: FatturaPerCliente[];
  residuoCent: number;
  saldato: boolean;
};

/**
 * Legge un ordine con le sue rate.
 *
 * Il DTO cambia forma con il ruolo: allo staff serve sapere da quale sessione
 * Stripe è arrivato un incasso, al cliente no.
 */
export async function leggiOrdine(attore: Attore, ordineId: string): Promise<DettaglioOrdine> {
  const db = getDb();
  const [ordine] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, ordineId), condizioneVisibilita(attore)))
    .limit(1);
  if (!ordine) throw new NonTrovato(`ordine ${ordineId} inesistente o non visibile`);

  const righe = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, ordineId))
    .orderBy(payments.createdAt);

  const documenti = await db
    .select()
    .from(invoices)
    .where(eq(invoices.orderId, ordineId))
    .orderBy(desc(invoices.createdAt));

  const staff = attore.ruolo !== "client";
  return {
    ordine: staff ? ordinePerStaff(ordine) : ordinePerCliente(ordine),
    rate: righe.map(staff ? pagamentoPerStaff : pagamentoPerCliente),
    fatture: documenti.map(staff ? fatturaPerStaff : fatturaPerCliente),
    residuoCent: residuoDaIncassare(ordine.totaleCent, righe),
    saldato: ordineSaldato(ordine.totaleCent, righe),
  };
}

export type FiltriOrdine = {
  stato?: string[];
  clientId?: string;
  pagina?: number;
  perPagina?: number;
};

export async function elencaOrdini(
  attore: Attore,
  filtri: FiltriOrdine = {},
): Promise<{ voci: OrdinePerCliente[]; totale: number }> {
  const db = getDb();
  const pagina = Math.max(1, filtri.pagina ?? 1);
  const perPagina = Math.min(100, Math.max(1, filtri.perPagina ?? 25));

  const condizioni = [condizioneVisibilita(attore)];
  if (filtri.stato?.length) condizioni.push(inArray(orders.stato, filtri.stato as never));
  if (filtri.clientId) condizioni.push(eq(orders.clientId, filtri.clientId));
  const dove = and(...condizioni);

  const [righe, [conteggio]] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(dove)
      .orderBy(desc(orders.createdAt))
      .limit(perPagina)
      .offset((pagina - 1) * perPagina),
    db.select({ n: count() }).from(orders).where(dove),
  ]);

  const mappa = attore.ruolo === "client" ? ordinePerCliente : ordinePerStaff;
  return { voci: righe.map(mappa), totale: Number(conteggio?.n ?? 0) };
}

/**
 * Conferma l'ordine: da bozza a impegno.
 *
 * Da qui in avanti gli importi non si toccano più. Cambiare il totale di un
 * ordine confermato significherebbe cambiare le condizioni di un accordo già
 * dato al cliente: si annulla e se ne fa un altro.
 */
export async function confermaOrdine(attore: Attore, ordineId: string): Promise<void> {
  esigiPermesso(attore, "ordine.crea");
  const db = getDb();

  await db.transaction(async (tx) => {
    const [ordine] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, ordineId), eq(orders.organizationId, attore.organizationId)))
      .limit(1);
    if (!ordine) throw new NonTrovato(`ordine ${ordineId} inesistente o di altro tenant`);
    if (ordine.stato !== "bozza") {
      throw new Error(`L'ordine è in stato ${ordine.stato}: solo una bozza si conferma.`);
    }

    await tx
      .update(orders)
      .set({ stato: "in_attesa_pagamento", confermatoAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, ordineId));

    await registra(
      attore,
      { azione: "ordine.confermato", entita: "ordine", entitaId: ordineId, metadati: {} },
      tx,
    );
  });
}

/**
 * Annulla un ordine.
 *
 * Un ordine su cui è già stato incassato qualcosa non si annulla e basta:
 * andrebbe prima rimborsato, altrimenti resterebbe un incasso senza una causa.
 */
export async function annullaOrdine(
  attore: Attore,
  ordineId: string,
  motivo: string,
): Promise<void> {
  esigiPermesso(attore, "ordine.annulla");
  if (!motivo.trim()) throw new Error("Serve un motivo per annullare un ordine.");
  const db = getDb();

  await db.transaction(async (tx) => {
    const [ordine] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, ordineId), eq(orders.organizationId, attore.organizationId)))
      .limit(1);
    if (!ordine) throw new NonTrovato(`ordine ${ordineId} inesistente o di altro tenant`);
    if (ordine.stato === "annullato") return;

    const righe = await tx.select().from(payments).where(eq(payments.orderId, ordineId));
    const incassato = righe
      .filter((p) => p.stato === "pagato")
      .reduce((t, p) => t + p.importoCent - p.importoRimborsatoCent, 0);
    if (incassato > 0) {
      throw new Error(
        "Su questo ordine ci sono incassi non rimborsati: vanno rimborsati prima di annullarlo.",
      );
    }

    await tx
      .update(orders)
      .set({ stato: "annullato", updatedAt: new Date() })
      .where(eq(orders.id, ordineId));
    // Le rate non ancora pagate si annullano con l'ordine: lasciarle in attesa
    // le farebbe comparire come dovute in eterno.
    await tx
      .update(payments)
      .set({ stato: "annullato", updatedAt: new Date() })
      .where(and(eq(payments.orderId, ordineId), eq(payments.stato, "in_attesa")));

    await tx
      .update(contracts)
      .set({ stato: "risolto", updatedAt: new Date() })
      .where(eq(contracts.orderId, ordineId));

    await registra(
      attore,
      {
        azione: "ordine.annullato",
        entita: "ordine",
        entitaId: ordineId,
        metadati: { motivo: motivo.slice(0, 300) },
      },
      tx,
    );
  });
}

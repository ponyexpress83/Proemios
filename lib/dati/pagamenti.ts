/**
 * Incassi: apertura del pagamento, registrazione, rimborsi.
 *
 * Due invarianti reggono il modulo:
 *
 *  1. **L'importo si legge dal database.** Nessuna funzione qui accetta una
 *     cifra da fuori per aprire un pagamento: si passa l'id della rata, e
 *     l'importo è quello che l'ordine dice. Un prezzo che attraversa il browser
 *     è un prezzo che il browser può cambiare.
 *  2. **Un incasso non si sovrascrive.** Le transizioni di stato sono
 *     esplicite; una rata già pagata non torna in attesa, e un rimborso non
 *     cancella l'incasso — lo riduce, lasciandone la storia.
 */
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type EsecutoreDb } from "@/db";
import { invoices, orders, payments } from "@/db/schema/commercio";
import { clients, leads } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { pagamentoPerCliente, pagamentoPerStaff } from "@/lib/dto/commercio";
import { notifica } from "./notifiche";
import { registraConversione } from "./conversioni";
import { euroDaCentesimi } from "@/lib/format";

/** Metodi di pagamento registrabili a mano. Stripe non passa da qui. */
export type MetodoManuale = "bonifico" | "altro";

/**
 * Una rata è raggiungibile dallo staff con `pagamento.vedi` nel proprio tenant,
 * e dal cliente solo se è sua.
 */
function condizioneVisibilita(attore: Attore) {
  const tenant = eq(payments.organizationId, attore.organizationId);
  if (attore.ruolo === "client") {
    return and(tenant, attore.clientId ? eq(payments.clientId, attore.clientId) : sql`false`);
  }
  if (haPermesso(attore, "pagamento.vedi")) return tenant;
  return sql`false`;
}

/** Legge una rata verificando che l'attore possa raggiungerla. */
export async function leggiPagamento(attore: Attore, pagamentoId: string) {
  const db = getDb();
  const [riga] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, pagamentoId), condizioneVisibilita(attore)))
    .limit(1);
  if (!riga) throw new NonTrovato(`pagamento ${pagamentoId} inesistente o non visibile`);
  return attore.ruolo === "client" ? pagamentoPerCliente(riga) : pagamentoPerStaff(riga);
}

/**
 * Prepara i dati per aprire una sessione di pagamento.
 *
 * Non parla con Stripe: restituisce ciò che serve a `lib/pagamenti/stripe.ts`
 * per farlo, dopo aver verificato che la rata esista, sia dell'attore, sia
 * ancora dovuta e appartenga a un ordine confermato. Tenere separate la
 * verifica e la chiamata di rete significa che la verifica si può testare senza
 * mettere in mezzo Stripe.
 */
export async function rataDaPagare(
  attore: Attore,
  pagamentoId: string,
): Promise<{
  pagamentoId: string;
  organizationId: string;
  clientId: string | null;
  importoCent: number;
  valuta: string;
  descrizione: string;
  emailCliente: string | null;
  ordineCodice: string;
}> {
  const db = getDb();
  const [riga] = await db
    .select({ pagamento: payments, ordine: orders })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.id, pagamentoId), condizioneVisibilita(attore)))
    .limit(1);
  if (!riga) throw new NonTrovato(`pagamento ${pagamentoId} inesistente o non visibile`);

  const { pagamento, ordine } = riga;
  if (pagamento.stato !== "in_attesa") {
    throw new Error(`Questa rata è già ${pagamento.stato}: non c'è nulla da pagare.`);
  }
  if (pagamento.metodo !== "stripe") {
    throw new Error("Questa rata è concordata fuori dal pagamento online.");
  }
  if (ordine.stato === "bozza") {
    throw new Error("L'ordine non è ancora confermato: non si può incassare.");
  }
  if (ordine.stato === "annullato") {
    throw new Error("L'ordine è annullato.");
  }

  const [cliente] = await db
    .select({ email: clients.email })
    .from(clients)
    .where(eq(clients.id, ordine.clientId))
    .limit(1);

  const etichetta: Record<string, string> = {
    acconto: "Acconto",
    saldo: "Saldo",
    milestone: "Rata a stato avanzamento",
    personalizzato: "Rata",
  };

  return {
    pagamentoId: pagamento.id,
    organizationId: pagamento.organizationId,
    clientId: pagamento.clientId,
    // L'importo viene da qui, non dal chiamante.
    importoCent: pagamento.importoCent,
    valuta: pagamento.valuta,
    descrizione: `${etichetta[pagamento.tipo] ?? "Rata"} · ordine ${ordine.codice}`,
    emailCliente: cliente?.email ?? null,
    ordineCodice: ordine.codice,
  };
}

/** Annota su quale sessione Stripe è stata aperta una rata. */
export async function collegaSessioneStripe(pagamentoId: string, sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(payments)
    .set({ stripeSessionId: sessionId, updatedAt: new Date() })
    .where(eq(payments.id, pagamentoId));
}

/**
 * Segna una rata come incassata.
 *
 * Chiamata **solo** dal webhook Stripe, dopo la verifica della firma, e da
 * `registraPagamentoManuale` per gli incassi fuori Stripe. È idempotente: lo
 * stesso evento consegnato due volte — cosa che Stripe fa di norma — non
 * produce un secondo incasso, perché l'aggiornamento tocca solo le rate ancora
 * in attesa e la funzione dice se ha davvero cambiato qualcosa.
 */
export async function segnaIncassata(
  pagamentoId: string,
  riferimenti: {
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    importoCent?: number;
  } = {},
): Promise<{ aggiornata: boolean; ordineId: string | null }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [riga] = await tx
      .update(payments)
      .set({
        stato: "pagato",
        pagatoAt: new Date(),
        stripePaymentIntentId: riferimenti.stripePaymentIntentId ?? null,
        stripeChargeId: riferimenti.stripeChargeId ?? null,
        updatedAt: new Date(),
      })
      // La condizione sullo stato è ciò che rende l'operazione idempotente: la
      // seconda consegna dello stesso evento non trova nulla da aggiornare.
      .where(and(eq(payments.id, pagamentoId), eq(payments.stato, "in_attesa")))
      .returning();

    if (!riga) return { aggiornata: false, ordineId: null };

    if (riga.orderId) await aggiornaStatoOrdine(tx, riga.orderId);
    await registraAcquisto(riga, tx);
    await avvisaIncasso(riga.clientId, riga.importoCent);
    return { aggiornata: true, ordineId: riga.orderId };
  });
}

/** Segna una rata come fallita, senza cancellarla: resta dovuta. */
export async function segnaFallita(pagamentoId: string): Promise<void> {
  const db = getDb();
  await db
    .update(payments)
    .set({ stato: "fallito", updatedAt: new Date() })
    .where(and(eq(payments.id, pagamentoId), eq(payments.stato, "in_attesa")));
}

/**
 * Porta l'ordine allo stato che i suoi incassi giustificano.
 *
 * Non fa salti: un ordine saldato diventa `confermato`, e da lì in avanti è la
 * produzione a muoverlo. Non tocca gli stati che appartengono ad altre fasi
 * (`in_produzione`, `consegnato`, `chiuso`).
 */
async function aggiornaStatoOrdine(tx: EsecutoreDb, ordineId: string): Promise<void> {
  const [ordine] = await tx.select().from(orders).where(eq(orders.id, ordineId)).limit(1);
  if (!ordine) return;
  if (ordine.stato !== "in_attesa_pagamento" && ordine.stato !== "bozza") return;

  const righe = await tx.select().from(payments).where(eq(payments.orderId, ordineId));
  const primoIncasso = righe.some((p) => p.stato === "pagato");
  if (!primoIncasso) return;

  // Basta l'acconto per far partire il lavoro: aspettare il saldo per
  // cominciare significherebbe non cominciare mai.
  await tx
    .update(orders)
    .set({
      stato: "confermato",
      confermatoAt: ordine.confermatoAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, ordineId));
}

/**
 * Registra un incasso avvenuto fuori dalla piattaforma (di norma un bonifico).
 *
 * Richiede `pagamento.registra` e lascia traccia di chi lo ha registrato: un
 * incasso dichiarato da una persona senza che si sappia quale è un buco in
 * contabilità.
 */
export async function registraPagamentoManuale(
  attore: Attore,
  pagamentoId: string,
  dati: { metodo: MetodoManuale; riferimentoEsterno: string },
): Promise<void> {
  esigiPermesso(attore, "pagamento.registra");
  if (!dati.riferimentoEsterno.trim()) {
    throw new Error("Serve un riferimento (CRO, estremi del bonifico) per registrare un incasso.");
  }
  const db = getDb();

  await db.transaction(async (tx) => {
    const [riga] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, pagamentoId), eq(payments.organizationId, attore.organizationId)))
      .limit(1);
    if (!riga) throw new NonTrovato(`pagamento ${pagamentoId} inesistente o di altro tenant`);
    if (riga.stato === "pagato") {
      throw new Error("Questa rata risulta già incassata.");
    }
    if (riga.stato === "rimborsato" || riga.stato === "annullato") {
      throw new Error(`Questa rata è ${riga.stato}: non si può registrare un incasso.`);
    }

    await tx
      .update(payments)
      .set({
        stato: "pagato",
        metodo: dati.metodo,
        riferimentoEsterno: dati.riferimentoEsterno.slice(0, 200),
        registratoDaId: attore.userId,
        pagatoAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, pagamentoId));

    if (riga.orderId) await aggiornaStatoOrdine(tx, riga.orderId);

    await registraAcquisto(riga, tx);
    await avvisaIncasso(riga.clientId, riga.importoCent);

    await registra(
      attore,
      {
        azione: "pagamento.registrato",
        entita: "pagamento",
        entitaId: pagamentoId,
        metadati: { metodo: dati.metodo, importoCent: riga.importoCent },
      },
      tx,
    );
  });
}

/**
 * Registra un rimborso.
 *
 * Il rimborso **non** cancella l'incasso: lo riduce. `importoRimborsatoCent`
 * cresce, e la rata diventa `rimborsato` solo quando è stata restituita per
 * intero. Un rimborso parziale su una rata che resta pagata è la
 * rappresentazione corretta di ciò che è successo davvero.
 *
 * La chiamata a Stripe la fa il chiamante: questa funzione registra il fatto.
 */
export async function registraRimborso(
  attore: Attore,
  pagamentoId: string,
  importoCent: number,
  motivo: string,
): Promise<{ totaleRimborsatoCent: number; completo: boolean }> {
  esigiPermesso(attore, "pagamento.rimborsa");
  if (!Number.isInteger(importoCent) || importoCent <= 0) {
    throw new Error("L'importo del rimborso dev'essere positivo, in centesimi.");
  }
  if (!motivo.trim()) throw new Error("Serve un motivo per registrare un rimborso.");

  const db = getDb();

  return db.transaction(async (tx) => {
    const [riga] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, pagamentoId), eq(payments.organizationId, attore.organizationId)))
      .limit(1);
    if (!riga) throw new NonTrovato(`pagamento ${pagamentoId} inesistente o di altro tenant`);
    if (riga.stato !== "pagato" && riga.stato !== "rimborsato") {
      throw new Error("Si rimborsa solo ciò che è stato incassato.");
    }

    const totale = riga.importoRimborsatoCent + importoCent;
    if (totale > riga.importoCent) {
      throw new Error(
        `Il rimborso supera l'incassato: ${totale} centesimi su ${riga.importoCent}.`,
      );
    }

    const completo = totale === riga.importoCent;
    await tx
      .update(payments)
      .set({
        importoRimborsatoCent: totale,
        stato: completo ? "rimborsato" : riga.stato,
        rimborsatoAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, pagamentoId));

    await registra(
      attore,
      {
        azione: "pagamento.rimborsato",
        entita: "pagamento",
        entitaId: pagamentoId,
        metadati: { importoCent, totaleRimborsatoCent: totale, motivo: motivo.slice(0, 300) },
      },
      tx,
    );

    return { totaleRimborsatoCent: totale, completo };
  });
}

/**
 * Trova la rata collegata a una sessione o a un payment intent Stripe.
 * Serve al webhook, che riceve identificativi Stripe e non i nostri.
 */
export async function pagamentoDaRiferimentoStripe(riferimenti: {
  sessionId?: string | null;
  paymentIntentId?: string | null;
}): Promise<{ id: string; organizationId: string; stato: string; importoCent: number } | null> {
  const db = getDb();
  const condizioni = [];
  if (riferimenti.sessionId) condizioni.push(eq(payments.stripeSessionId, riferimenti.sessionId));
  if (riferimenti.paymentIntentId) {
    condizioni.push(eq(payments.stripePaymentIntentId, riferimenti.paymentIntentId));
  }
  if (condizioni.length === 0) return null;

  const [riga] = await db
    .select({
      id: payments.id,
      organizationId: payments.organizationId,
      stato: payments.stato,
      importoCent: payments.importoCent,
    })
    .from(payments)
    .where(condizioni.length === 1 ? condizioni[0] : sql`${condizioni[0]} or ${condizioni[1]}`)
    .limit(1);
  return riga ?? null;
}

/**
 * Allinea il rimborsato di una rata a quanto dice Stripe.
 *
 * Stripe manda l'importo **totale** rimborsato su quell'addebito, non il
 * delta: si assegna, non si somma. È anche ciò che rende l'operazione
 * naturalmente idempotente — lo stesso evento consegnato tre volte scrive tre
 * volte lo stesso numero.
 */
export async function sincronizzaRimborsoStripe(
  riferimenti: { paymentIntentId?: string | null; chargeId?: string | null },
  totaleRimborsatoCent: number,
): Promise<{ aggiornata: boolean }> {
  const db = getDb();
  const condizioni = [];
  if (riferimenti.paymentIntentId) {
    condizioni.push(eq(payments.stripePaymentIntentId, riferimenti.paymentIntentId));
  }
  if (riferimenti.chargeId) condizioni.push(eq(payments.stripeChargeId, riferimenti.chargeId));
  if (condizioni.length === 0) return { aggiornata: false };

  const [riga] = await db
    .select()
    .from(payments)
    .where(condizioni.length === 1 ? condizioni[0] : sql`${condizioni[0]} or ${condizioni[1]}`)
    .limit(1);
  if (!riga) return { aggiornata: false };

  const completo = totaleRimborsatoCent >= riga.importoCent;
  await db
    .update(payments)
    .set({
      importoRimborsatoCent: Math.min(totaleRimborsatoCent, riga.importoCent),
      stato: completo ? "rimborsato" : riga.stato,
      rimborsatoAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, riga.id));

  return { aggiornata: true };
}

export type FiltriIncasso = {
  stato?: string[];
  pagina?: number;
  perPagina?: number;
};

export type RigaIncassoDTO = {
  rata: ReturnType<typeof pagamentoPerStaff>;
  ordineCodice: string | null;
  clienteNome: string | null;
  fatturata: boolean;
};

/**
 * L'elenco degli incassi per l'amministrazione.
 *
 * Porta con sé il codice ordine e il nome del cliente perché è così che si
 * riconosce una riga in contabilità: un elenco di uuid e importi non è
 * utilizzabile da nessuno.
 */
export async function elencaIncassi(
  attore: Attore,
  filtri: FiltriIncasso = {},
): Promise<{ voci: RigaIncassoDTO[]; totale: number }> {
  esigiPermesso(attore, "pagamento.vedi");
  const db = getDb();

  const pagina = Math.max(1, filtri.pagina ?? 1);
  const perPagina = Math.min(100, Math.max(1, filtri.perPagina ?? 50));

  const condizioni = [eq(payments.organizationId, attore.organizationId)];
  if (filtri.stato?.length) condizioni.push(inArray(payments.stato, filtri.stato as never));
  const dove = and(...condizioni);

  const [righe, [conteggio]] = await Promise.all([
    db
      .select({
        pagamento: payments,
        ordineCodice: orders.codice,
        clienteNome: clients.nome,
        fatturaId: invoices.id,
      })
      .from(payments)
      .leftJoin(orders, eq(orders.id, payments.orderId))
      .leftJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .where(dove)
      .orderBy(desc(payments.createdAt))
      .limit(perPagina)
      .offset((pagina - 1) * perPagina),
    db.select({ n: count() }).from(payments).where(dove),
  ]);

  return {
    voci: righe.map((r) => ({
      rata: pagamentoPerStaff(r.pagamento),
      ordineCodice: r.ordineCodice,
      clienteNome: r.clienteNome,
      fatturata: r.fatturaId !== null,
    })),
    totale: Number(conteggio?.n ?? 0),
  };
}

/** Totali di cassa per il cruscotto: incassato, atteso, rimborsato. */
export async function riepilogoIncassi(attore: Attore): Promise<{
  incassatoCent: number;
  attesoCent: number;
  rimborsatoCent: number;
}> {
  esigiPermesso(attore, "pagamento.vedi");
  const db = getDb();
  const righe = await db
    .select({
      stato: payments.stato,
      importoCent: payments.importoCent,
      rimborsatoCent: payments.importoRimborsatoCent,
    })
    .from(payments)
    .where(eq(payments.organizationId, attore.organizationId));

  let incassatoCent = 0;
  let attesoCent = 0;
  let rimborsatoCent = 0;
  for (const r of righe) {
    if (r.stato === "pagato" || r.stato === "rimborsato") {
      incassatoCent += r.importoCent - r.rimborsatoCent;
      rimborsatoCent += r.rimborsatoCent;
    } else if (r.stato === "in_attesa" || r.stato === "autorizzato") {
      attesoCent += r.importoCent;
    }
  }
  return { incassatoCent, attesoCent, rimborsatoCent };
}

/**
 * Avvisa il cliente che l'incasso è arrivato.
 *
 * Non fa fallire nulla se non ci riesce: un pagamento registrato senza
 * notifica è un fastidio, un pagamento non registrato è un problema.
 */
async function avvisaIncasso(clientId: string | null, importoCent: number): Promise<void> {
  if (!clientId) return;
  try {
    const db = getDb();
    const [riga] = await db
      .select({ userId: clients.userId })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    if (!riga?.userId) return;
    await notifica(riga.userId, "pagamento.ricevuto", {
      importo: euroDaCentesimi(importoCent),
    });
  } catch {
    // Silenzio voluto: vedi sopra.
  }
}


/**
 * Registra l'incasso come conversione `purchase`.
 *
 * Vale per ogni incasso, non solo per quelli di Stripe: un bonifico è una
 * vendita esattamente quanto una carta, e misurarne solo una metà darebbe alle
 * campagne un'immagine sistematicamente sbagliata del ritorno.
 *
 * La chiave di deduplicazione è la rata: la stessa rata non genera due
 * `purchase`, nemmeno se l'evento Stripe viene riconsegnato.
 */
async function registraAcquisto(
  riga: { id: string; organizationId: string; clientId: string | null; importoCent: number },
  tx: EsecutoreDb,
): Promise<void> {
  const leadId = riga.clientId ? await leadDiCliente(riga.clientId, tx) : null;
  await registraConversione(
    {
      evento: "purchase",
      chiaveDedup: `pagamento-${riga.id}-purchase`,
      organizationId: riga.organizationId,
      leadId,
      valoreCent: riga.importoCent,
    },
    tx,
  );
}

/** Il lead da cui è nato un cliente: serve a ritrovarne l'attribuzione. */
async function leadDiCliente(clientId: string, tx: EsecutoreDb): Promise<string | null> {
  const [riga] = await tx
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.clientId, clientId))
    .orderBy(leads.createdAt)
    .limit(1);
  return riga?.id ?? null;
}

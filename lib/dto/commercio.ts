/**
 * DTO di ordini, pagamenti e fatture.
 *
 * Il confine che questo file tiene: **il cliente vede quanto deve e quando, non
 * come lo incassiamo**. Identificativi Stripe, note interne, chi ha registrato
 * un incasso, margini e riferimenti al provider di fatturazione sono materiale
 * di back-office e non esistono nel DTO cliente — non ci sono da filtrare,
 * perché non ci sono da mettere.
 *
 * Il redattore non ha un DTO qui, e non è una dimenticanza: il denaro non
 * riguarda il suo lavoro, e non avere l'oggetto è la forma più solida di
 * «non lo vede».
 */
import type { Fattura, Ordine, Pagamento } from "@/db/schema/commercio";
import { iso, sigilla } from "./comuni";

/* ── Ordini ───────────────────────────────────────────────────────────── */

/** L'ordine come lo vede il cliente: cosa ha comprato e a che condizioni. */
export type OrdinePerCliente = {
  id: string;
  codice: string;
  stato: string;
  imponibileCent: number;
  ivaCent: number;
  totaleCent: number;
  accontoCent: number;
  confermatoAt: string | null;
  createdAt: string;
};

/** L'ordine nel back-office: in più le note interne e chi lo ha creato. */
export type OrdinePerStaff = OrdinePerCliente & {
  organizationId: string;
  clientId: string;
  quoteId: string | null;
  accontoPuntiBase: number;
  noteInterne: string | null;
  creatoDaId: string | null;
  updatedAt: string;
};

export function ordinePerCliente(o: Ordine): OrdinePerCliente {
  return sigilla({
    id: o.id,
    codice: o.codice,
    stato: o.stato,
    imponibileCent: o.imponibileCent,
    ivaCent: o.ivaCent,
    totaleCent: o.totaleCent,
    accontoCent: o.accontoCent,
    confermatoAt: iso(o.confermatoAt),
    createdAt: iso(o.createdAt)!,
  });
}

export function ordinePerStaff(o: Ordine): OrdinePerStaff {
  return sigilla({
    ...ordinePerCliente(o),
    organizationId: o.organizationId,
    clientId: o.clientId,
    quoteId: o.quoteId,
    accontoPuntiBase: o.accontoPuntiBase,
    noteInterne: o.noteInterne,
    creatoDaId: o.creatoDaId,
    updatedAt: iso(o.updatedAt)!,
  });
}

/* ── Pagamenti ────────────────────────────────────────────────────────── */

/**
 * La rata come la vede il cliente. Nessun identificativo Stripe: gli servono
 * l'importo, la scadenza e lo stato, e un `pi_…` in pagina è solo un dettaglio
 * della nostra infrastruttura esposto a chi non può farci nulla.
 */
export type PagamentoPerCliente = {
  id: string;
  tipo: string;
  stato: string;
  importoCent: number;
  valuta: string;
  scadenzaAt: string | null;
  pagatoAt: string | null;
  /** Vero se il cliente può pagarla adesso da solo. */
  pagabileOra: boolean;
};

/** La rata nel back-office: metodo, riferimenti e chi l'ha registrata. */
export type PagamentoPerStaff = PagamentoPerCliente & {
  organizationId: string;
  orderId: string | null;
  clientId: string | null;
  metodo: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  riferimentoEsterno: string | null;
  registratoDaId: string | null;
  importoRimborsatoCent: number;
  rimborsatoAt: string | null;
  createdAt: string;
};

/**
 * Una rata è pagabile online solo se è in attesa e passa da Stripe. Un
 * bonifico atteso non deve mostrare un pulsante «paga adesso» che aprirebbe un
 * secondo canale per lo stesso importo.
 */
function pagabileOra(p: Pagamento): boolean {
  return p.stato === "in_attesa" && p.metodo === "stripe";
}

export function pagamentoPerCliente(p: Pagamento): PagamentoPerCliente {
  return sigilla({
    id: p.id,
    tipo: p.tipo,
    stato: p.stato,
    importoCent: p.importoCent,
    valuta: p.valuta,
    scadenzaAt: iso(p.scadenzaAt),
    pagatoAt: iso(p.pagatoAt),
    pagabileOra: pagabileOra(p),
  });
}

export function pagamentoPerStaff(p: Pagamento): PagamentoPerStaff {
  return sigilla({
    ...pagamentoPerCliente(p),
    organizationId: p.organizationId,
    orderId: p.orderId,
    clientId: p.clientId,
    metodo: p.metodo,
    stripeSessionId: p.stripeSessionId,
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeChargeId: p.stripeChargeId,
    riferimentoEsterno: p.riferimentoEsterno,
    registratoDaId: p.registratoDaId,
    importoRimborsatoCent: p.importoRimborsatoCent,
    rimborsatoAt: iso(p.rimborsatoAt),
    createdAt: iso(p.createdAt)!,
  });
}

/* ── Fatture ──────────────────────────────────────────────────────────── */

/**
 * La fattura per il cliente: numero, data, importo e link al documento. Lo
 * stato dell'emissione e gli errori del provider restano dentro.
 */
export type FatturaPerCliente = {
  id: string;
  numeroDocumento: string | null;
  dataDocumento: string | null;
  totaleCent: number;
  /** Presente solo a fattura emessa. */
  urlDocumento: string | null;
};

export type FatturaPerStaff = FatturaPerCliente & {
  organizationId: string;
  clientId: string;
  orderId: string | null;
  paymentId: string | null;
  stato: string;
  imponibileCent: number;
  ivaCent: number;
  providerNome: string | null;
  providerDocumentoId: string | null;
  erroreMessaggio: string | null;
  tentativi: number;
  createdAt: string;
};

export function fatturaPerCliente(f: Fattura): FatturaPerCliente {
  // Una fattura non ancora emessa non ha un documento da mostrare: esporre un
  // URL a metà emissione porterebbe il cliente su una pagina che non esiste.
  const emessa = f.stato === "emessa";
  return sigilla({
    id: f.id,
    numeroDocumento: emessa ? f.numeroDocumento : null,
    dataDocumento: emessa ? iso(f.dataDocumento) : null,
    totaleCent: f.totaleCent,
    urlDocumento: emessa ? f.urlDocumento : null,
  });
}

export function fatturaPerStaff(f: Fattura): FatturaPerStaff {
  return sigilla({
    ...fatturaPerCliente(f),
    organizationId: f.organizationId,
    clientId: f.clientId,
    orderId: f.orderId,
    paymentId: f.paymentId,
    stato: f.stato,
    imponibileCent: f.imponibileCent,
    ivaCent: f.ivaCent,
    providerNome: f.providerNome,
    providerDocumentoId: f.providerDocumentoId,
    erroreMessaggio: f.erroreMessaggio,
    tentativi: f.tentativi,
    createdAt: iso(f.createdAt)!,
  });
}

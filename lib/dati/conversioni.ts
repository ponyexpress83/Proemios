/**
 * Registrazione e consegna delle conversioni.
 *
 * Il fatto si registra sempre; la consegna alla piattaforma può fallire, e
 * quando fallisce resta visibile. Le due cose non si confondono: una
 * conversione avvenuta è un fatto nostro, la sua consegna a Google è un
 * dettaglio operativo.
 */
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb, type EsecutoreDb } from "@/db";
import { conversions } from "@/db/schema/analytics";
import { leads } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { iso, sigilla } from "@/lib/dto/comuni";
import { HA_VALORE, type EventoEsito } from "@/lib/analytics/eventi";
import {
  GoogleAdsOffline,
  ConversioniSpente,
  type ProviderConversioni,
} from "@/lib/analytics/piattaforme";
import { env } from "@/lib/env";

let providerSostituto: ProviderConversioni | null = null;

/** Inietta un provider nei test. `null` ripristina la scelta normale. */
export function impostaProviderConversioniPerTest(p: ProviderConversioni | null) {
  providerSostituto = p;
}

export function providerConversioni(): ProviderConversioni {
  if (providerSostituto) return providerSostituto;
  const google = new GoogleAdsOffline({
    token: env.GOOGLE_ADS_TOKEN,
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: env.GOOGLE_ADS_CUSTOMER_ID,
    azioniPerEvento: azioniPerEvento(),
  });
  return google.configurato() ? google : new ConversioniSpente();
}

/**
 * Mappa evento → azione di conversione di Google Ads, dalla configurazione.
 *
 * Formato: `qualified_lead=customers/1/conversionActions/2,purchase=...`. Sta in
 * configurazione e non in codice perché gli identificativi cambiano quando
 * qualcuno tocca l'account pubblicitario, e non deve servire un rilascio.
 */
function azioniPerEvento(): Record<string, string> {
  const grezzo = env.GOOGLE_ADS_AZIONI ?? "";
  const mappa: Record<string, string> = {};
  for (const coppia of grezzo.split(",")) {
    const [evento, azione] = coppia.split("=").map((s) => s?.trim());
    if (evento && azione) mappa[evento] = azione;
  }
  return mappa;
}

/** Attribuzione ridotta a ciò che serve: mai un campo personale. */
function attribuzioneUtile(a: unknown): Record<string, string> {
  if (!a || typeof a !== "object") return {};
  const grezza = a as Record<string, unknown>;
  const utile: Record<string, string> = {};
  for (const chiave of [
    "gclid",
    "fbclid",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "utmTerm",
    "landingPath",
  ]) {
    const valore = grezza[chiave];
    if (typeof valore === "string" && valore) utile[chiave] = valore.slice(0, 500);
  }
  return utile;
}

/**
 * Registra una conversione avvenuta sul server.
 *
 * `chiaveDedup` è ciò che impedisce il doppio conteggio: la stessa conversione
 * registrata due volte — un webhook riconsegnato, un operatore che rifà un
 * passaggio — non produce due righe. Costruirla dal fatto (`lead-<id>-<evento>`,
 * `ordine-<id>-purchase`) e non dal momento è ciò che la rende utile.
 */
export async function registraConversione(
  dati: {
    evento: EventoEsito;
    chiaveDedup: string;
    organizationId?: string | null;
    leadId?: string | null;
    valoreCent?: number | null;
    valuta?: string;
    avvenutaAt?: Date;
  },
  esecutore?: EsecutoreDb,
): Promise<{ registrata: boolean }> {
  const db = esecutore ?? getDb();

  const [gia] = await db
    .select({ id: conversions.id })
    .from(conversions)
    .where(eq(conversions.chiaveDedup, dati.chiaveDedup))
    .limit(1);
  if (gia) return { registrata: false };

  // L'attribuzione si congela adesso: il gclid di un lead può essere
  // sovrascritto da una visita successiva, e un'attribuzione che cambia dopo il
  // fatto rende le campagne illeggibili.
  let attribuzione: Record<string, string> = {};
  if (dati.leadId) {
    const [lead] = await db
      .select({ attribution: leads.attribution })
      .from(leads)
      .where(eq(leads.id, dati.leadId))
      .limit(1);
    attribuzione = attribuzioneUtile(lead?.attribution);
  }

  await db.insert(conversions).values({
    organizationId: dati.organizationId ?? null,
    leadId: dati.leadId ?? null,
    evento: dati.evento,
    // Un evento senza valore reale non ne porta uno inventato: Google ottimizza
    // su questi numeri, e un valore finto insegna alla campagna a comprare il
    // pubblico sbagliato.
    valoreCent: HA_VALORE[dati.evento] ? (dati.valoreCent ?? null) : null,
    valuta: dati.valuta ?? "EUR",
    chiaveDedup: dati.chiaveDedup,
    attribuzione,
    avvenutaAt: dati.avvenutaAt ?? new Date(),
  });

  return { registrata: true };
}

/**
 * Consegna alla piattaforma le conversioni non ancora inviate.
 *
 * Pensata per essere chiamata da un lavoro periodico. Segna `inviataAt` solo
 * per ciò che la piattaforma ha davvero accettato; il resto resta in coda con
 * il proprio errore.
 */
export async function consegnaConversioni(limite = 200): Promise<{
  tentate: number;
  inviate: number;
}> {
  const db = getDb();
  const provider = providerConversioni();
  if (!provider.configurato()) return { tentate: 0, inviate: 0 };

  const righe = await db
    .select()
    .from(conversions)
    .where(isNull(conversions.inviataAt))
    .orderBy(conversions.avvenutaAt)
    .limit(Math.min(1000, Math.max(1, limite)));
  if (righe.length === 0) return { tentate: 0, inviate: 0 };
  const ids = righe.map((r) => r.id);

  try {
    const esito = await provider.invia(
      righe.map((r) => ({
        evento: r.evento,
        valoreCent: r.valoreCent,
        valuta: r.valuta,
        avvenutaAt: r.avvenutaAt,
        chiaveDedup: r.chiaveDedup,
        gclid: r.attribuzione?.gclid ?? null,
        fbclid: r.attribuzione?.fbclid ?? null,
      })),
    );

    await db
      .update(conversions)
      .set({ inviataAt: new Date(), erroreInvio: null, updatedAt: new Date() })
      .where(and(isNull(conversions.inviataAt), inArray(conversions.id, ids)));

    return { tentate: righe.length, inviate: esito.inviate };
  } catch (errore) {
    await db
      .update(conversions)
      .set({
        erroreInvio: String(errore).slice(0, 300),
        tentativi: sql`${conversions.tentativi} + 1`,
        updatedAt: new Date(),
      })
      .where(and(isNull(conversions.inviataAt), inArray(conversions.id, ids)));
    return { tentate: righe.length, inviate: 0 };
  }
}

export type RigaFunnel = {
  evento: string;
  conteggio: number;
  valoreCent: number;
  nonInviate: number;
};

/**
 * Il funnel misurato, per il cruscotto.
 *
 * Legge le conversioni registrate, non quelle consegnate: il funnel interno non
 * dipende dal fatto che Google abbia accettato o no.
 */
export async function funnelConversioni(attore: Attore, giorni = 30): Promise<RigaFunnel[]> {
  esigiPermesso(attore, "analytics.vedi");
  const db = getDb();
  const da = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);

  const righe = await db
    .select({
      evento: conversions.evento,
      conteggio: count(),
      valoreCent: sql<number>`coalesce(sum(${conversions.valoreCent}), 0)`,
      nonInviate: sql<number>`count(*) filter (where ${conversions.inviataAt} is null)`,
    })
    .from(conversions)
    .where(
      and(eq(conversions.organizationId, attore.organizationId), gte(conversions.avvenutaAt, da)),
    )
    .groupBy(conversions.evento);

  return righe.map((r) =>
    sigilla({
      evento: r.evento,
      conteggio: Number(r.conteggio),
      valoreCent: Number(r.valoreCent),
      nonInviate: Number(r.nonInviate),
    }),
  );
}

export type ConversioneDTO = {
  id: string;
  evento: string;
  valoreCent: number | null;
  avvenutaAt: string;
  inviataAt: string | null;
  erroreInvio: string | null;
  /** Solo la sorgente, non l'intera attribuzione. */
  sorgente: string | null;
};

/** Le ultime conversioni, per capire cosa sta arrivando. */
export async function ultimeConversioni(attore: Attore, limite = 50): Promise<ConversioneDTO[]> {
  esigiPermesso(attore, "analytics.vedi");
  const db = getDb();
  const righe = await db
    .select()
    .from(conversions)
    .where(eq(conversions.organizationId, attore.organizationId))
    .orderBy(desc(conversions.avvenutaAt))
    .limit(Math.min(200, Math.max(1, limite)));

  return righe.map((r) =>
    sigilla({
      id: r.id,
      evento: r.evento,
      valoreCent: r.valoreCent,
      avvenutaAt: iso(r.avvenutaAt)!,
      inviataAt: iso(r.inviataAt),
      erroreInvio: r.erroreInvio,
      sorgente: r.attribuzione?.utmSource ?? (r.attribuzione?.gclid ? "google ads" : null),
    }),
  );
}

/**
 * Policy privacy dei provider AI.
 *
 * Questa tabella è il cancello che decide se un manoscritto può essere mandato
 * a un fornitore. Non descrive un'intenzione: descrive **le condizioni
 * contrattuali che qualcuno ha letto e approvato**, e per questo l'approvazione
 * è un atto di una persona, registrato con il suo nome e la data.
 *
 * `config/modelli.ts` contiene dei valori di riferimento, ma sono un promemoria
 * di cosa ci si aspetta dal contratto — non un'approvazione. Fuori dallo
 * sviluppo non vengono nemmeno letti.
 */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { providerPolicies } from "@/db/schema/sistema";
import { users } from "@/db/schema/utenti";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { iso, sigilla } from "@/lib/dto/comuni";
import { PROVIDER } from "@/config/modelli";
import { incoerenzePolicy, type DatiPolicy } from "@/lib/ai/policy-coerenza";

export { incoerenzePolicy };
export type { DatiPolicy };

export type PolicyDTO = {
  id: string;
  provider: string;
  addestramentoConsentito: boolean;
  zeroDataRetention: boolean;
  giorniConservazione: number | null;
  dpaDisponibile: boolean;
  regioneDati: string | null;
  subresponsabili: string[];
  approvatoManoscrittiInediti: boolean;
  approvatoProgettiSensibili: boolean;
  note: string | null;
  rivistoAt: string | null;
  rivistoDaNome: string | null;
};

/** Le policy registrate, con il nome di chi le ha approvate. */
export async function elencaPolicy(attore: Attore): Promise<PolicyDTO[]> {
  esigiPermesso(attore, "provider.vedi_policy");
  const db = getDb();

  const righe = await db
    .select({ policy: providerPolicies, rivistoDaNome: users.name })
    .from(providerPolicies)
    .leftJoin(users, eq(users.id, providerPolicies.rivistoDaId))
    .orderBy(asc(providerPolicies.provider));

  return righe.map((r) =>
    sigilla({
      id: r.policy.id,
      provider: r.policy.provider,
      addestramentoConsentito: r.policy.addestramentoConsentito,
      zeroDataRetention: r.policy.zeroDataRetention,
      giorniConservazione: r.policy.giorniConservazione
        ? Number(r.policy.giorniConservazione)
        : null,
      dpaDisponibile: r.policy.dpaDisponibile,
      regioneDati: r.policy.regioneDati,
      subresponsabili: r.policy.subresponsabili ?? [],
      approvatoManoscrittiInediti: r.policy.approvatoManoscrittiInediti,
      approvatoProgettiSensibili: r.policy.approvatoProgettiSensibili,
      note: r.policy.note,
      rivistoAt: iso(r.policy.rivistoAt),
      rivistoDaNome: r.rivistoDaNome,
    }),
  );
}

/**
 * Salva la policy di un provider, sovrascrivendo quella esistente.
 *
 * Una policy per provider: due righe per lo stesso fornitore vorrebbero dire
 * due verità sulle stesse condizioni contrattuali, e il router ne pescherebbe
 * una a caso (`find` prende la prima).
 */
export async function salvaPolicy(attore: Attore, dati: DatiPolicy): Promise<PolicyDTO> {
  esigiPermesso(attore, "provider.approva_policy");

  if (!PROVIDER.includes(dati.provider)) {
    throw new Error(`Provider sconosciuto: ${dati.provider}.`);
  }

  const problemi = incoerenzePolicy(dati);
  if (problemi.length > 0) {
    throw new Error(`Policy incoerente: ${problemi.join("; ")}.`);
  }

  const db = getDb();
  const adesso = new Date();
  const valori = {
    provider: dati.provider,
    addestramentoConsentito: dati.addestramentoConsentito,
    zeroDataRetention: dati.zeroDataRetention,
    giorniConservazione:
      dati.giorniConservazione === null ? null : String(dati.giorniConservazione),
    dpaDisponibile: dati.dpaDisponibile,
    regioneDati: dati.regioneDati.slice(0, 60),
    subresponsabili: dati.subresponsabili.map((s) => s.slice(0, 200)).slice(0, 30),
    approvatoManoscrittiInediti: dati.approvatoManoscrittiInediti,
    approvatoProgettiSensibili: dati.approvatoProgettiSensibili,
    note: dati.note.slice(0, 4000),
    // Chi salva è chi si assume l'approvazione: il nome resta accanto alla riga.
    rivistoDaId: attore.userId,
    rivistoAt: adesso,
    updatedAt: adesso,
  };

  const [esistente] = await db
    .select({ id: providerPolicies.id })
    .from(providerPolicies)
    .where(eq(providerPolicies.provider, dati.provider))
    .limit(1);

  if (esistente) {
    await db.update(providerPolicies).set(valori).where(eq(providerPolicies.id, esistente.id));
  } else {
    await db.insert(providerPolicies).values(valori);
  }

  await registra(attore, {
    azione: "provider.policy_modificata",
    entita: "provider_policy",
    entitaId: esistente?.id,
    metadati: {
      provider: dati.provider,
      approvatoManoscrittiInediti: dati.approvatoManoscrittiInediti,
      approvatoProgettiSensibili: dati.approvatoProgettiSensibili,
      dpaDisponibile: dati.dpaDisponibile,
    },
  });

  const [salvata] = await elencaPolicyPerProvider(attore, dati.provider);
  if (!salvata) throw new NonTrovato(`policy ${dati.provider} non ritrovata dopo il salvataggio`);
  return salvata;
}

async function elencaPolicyPerProvider(attore: Attore, provider: string): Promise<PolicyDTO[]> {
  const tutte = await elencaPolicy(attore);
  return tutte.filter((p) => p.provider === provider);
}

/**
 * Revoca l'approvazione senza cancellare la riga.
 *
 * Cancellarla perderebbe la storia di cosa era stato approvato e da chi;
 * azzerare i due flag lascia la traccia e ferma subito il routing.
 */
export async function revocaApprovazione(
  attore: Attore,
  provider: string,
  motivo: string,
): Promise<void> {
  esigiPermesso(attore, "provider.approva_policy");
  if (!motivo.trim()) throw new Error("Serve un motivo per revocare un'approvazione.");

  const db = getDb();
  const adesso = new Date();
  const [riga] = await db
    .update(providerPolicies)
    .set({
      approvatoManoscrittiInediti: false,
      approvatoProgettiSensibili: false,
      note: motivo.slice(0, 4000),
      rivistoDaId: attore.userId,
      rivistoAt: adesso,
      updatedAt: adesso,
    })
    .where(and(eq(providerPolicies.provider, provider)))
    .returning({ id: providerPolicies.id });
  if (!riga) throw new NonTrovato(`policy ${provider} inesistente`);

  await registra(attore, {
    azione: "provider.policy_modificata",
    entita: "provider_policy",
    entitaId: riga.id,
    metadati: { provider, revocata: true, motivo: motivo.slice(0, 300) },
  });
}

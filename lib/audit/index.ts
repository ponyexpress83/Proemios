/**
 * Registro di audit.
 *
 * Tre regole, applicate qui e non lasciate alla buona volontà dei chiamanti:
 *
 *  1. **I metadati sono sanitizzati.** Nessun testo di manoscritto, nessun
 *     segreto, nessun prompt, nessuna PII oltre gli identificativi. La
 *     sanitizzazione è attiva (`sanitizza`), non un avvertimento nel commento.
 *  2. **Append-only.** Non esiste una funzione per aggiornare o cancellare una
 *     riga di audit.
 *  3. **Un fallimento dell'audit non fa fallire l'operazione.** Se il registro
 *     non è scrivibile, l'errore va nei log applicativi ma l'utente non perde
 *     il lavoro. Il contrario — bloccare una consegna perché l'audit è giù —
 *     è peggio del rischio che copre.
 */
import { getDb, type EsecutoreDb } from "@/db";
import { auditEvents } from "@/db/schema/sistema";
import type { Attore, AttoreSistema } from "@/lib/auth/attore";

/** Azioni registrate. L'elenco è chiuso: un'azione nuova va aggiunta qui. */
export const AZIONI_AUDIT = [
  "accesso.riuscito",
  "accesso.fallito",
  "accesso.uscita",
  "sessione.revocata",
  "utente.invitato",
  "utente.creato",
  "utente.ruolo_cambiato",
  "utente.disattivato",
  "utente.riattivato",

  "lead.creato",
  "lead.stato_cambiato",
  "lead.assegnato",
  "lead.convertito",
  "cliente.creato",
  "cliente.modificato",

  "progetto.creato",
  "progetto.modificato",
  "progetto.membro_aggiunto",
  "progetto.membro_rimosso",

  "file.caricato",
  "file.accesso",
  "file.scaricato",
  "file.cancellato",

  "job.creato",
  "job.assegnato",
  "job.stato_cambiato",
  "job.modello_cambiato",
  "job.rigenerato",
  "intervento.modificato",
  "documento.revisionato_generato",
  "approvazione.editoriale",
  "approvazione.operativa",
  "approvazione.respinta",
  "consegna.effettuata",

  "pagamento.registrato",
  "pagamento.rimborsato",
  "fattura.emessa",
  "contratto.modificato",

  "provider.policy_modificata",
  "configurazione.modificata",
] as const;

export type AzioneAudit = (typeof AZIONI_AUDIT)[number];

/**
 * Chiavi che non possono comparire nei metadati. L'elenco è per sottostringa:
 * `promptSistema`, `apiKeyStripe` e `manoscrittoTesto` vengono tutti intercettati.
 */
const CHIAVI_PROIBITE = [
  "prompt",
  "manoscritto",
  "testo",
  "contenuto",
  "corpo",
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "chiave",
  "authorization",
  "cookie",
];

const LUNGHEZZA_MASSIMA_VALORE = 200;
const PROFONDITA_MASSIMA = 3;

/**
 * Rende un oggetto sicuro da registrare. Elimina le chiavi proibite, tronca le
 * stringhe lunghe (una stringa di 4.000 caratteri in un audit è quasi sempre
 * del testo che non doveva essere lì) e limita la profondità.
 */
export function sanitizza(valore: unknown, profondita = 0): unknown {
  if (valore === null || valore === undefined) return valore;
  if (profondita > PROFONDITA_MASSIMA) return "[troncato: troppo profondo]";

  if (typeof valore === "string") {
    return valore.length > LUNGHEZZA_MASSIMA_VALORE
      ? `${valore.slice(0, LUNGHEZZA_MASSIMA_VALORE)}… [troncato ${valore.length}]`
      : valore;
  }
  if (typeof valore === "number" || typeof valore === "boolean") return valore;
  if (valore instanceof Date) return valore.toISOString();

  if (Array.isArray(valore)) {
    return valore.slice(0, 20).map((v) => sanitizza(v, profondita + 1));
  }

  if (typeof valore === "object") {
    const risultato: Record<string, unknown> = {};
    for (const [chiave, v] of Object.entries(valore as Record<string, unknown>)) {
      const minuscola = chiave.toLowerCase();
      if (CHIAVI_PROIBITE.some((p) => minuscola.includes(p))) {
        risultato[chiave] = "[rimosso]";
        continue;
      }
      risultato[chiave] = sanitizza(v, profondita + 1);
    }
    return risultato;
  }

  return "[non serializzabile]";
}

export type VoceAudit = {
  azione: AzioneAudit;
  entita?: string;
  entitaId?: string | null;
  esito?: "ok" | "negato" | "errore";
  metadati?: Record<string, unknown>;
  indirizzoIp?: string | null;
  userAgent?: string | null;
  richiestaId?: string | null;
};

function isAttoreSistema(a: Attore | AttoreSistema): a is AttoreSistema {
  return "tipo" in a && a.tipo === "sistema";
}

/**
 * Registra un evento. Non lancia mai: un audit non scrivibile non deve far
 * fallire l'operazione che stava descrivendo.
 */
export async function registra(
  attore: Attore | AttoreSistema | null,
  voce: VoceAudit,
  esecutore?: EsecutoreDb,
): Promise<void> {
  try {
    const db = esecutore ?? getDb();
    const sistema = attore ? isAttoreSistema(attore) : false;
    await db.insert(auditEvents).values({
      organizationId: attore?.organizationId ?? null,
      attoreId: attore && !sistema ? (attore as Attore).userId : null,
      attoreRuolo: attore
        ? sistema
          ? `sistema:${(attore as AttoreSistema).origine}`
          : (attore as Attore).ruolo
        : null,
      azione: voce.azione,
      entita: voce.entita ?? null,
      entitaId: voce.entitaId ?? null,
      esito: voce.esito ?? "ok",
      metadati: voce.metadati ? (sanitizza(voce.metadati) as Record<string, unknown>) : null,
      indirizzoIp: voce.indirizzoIp ?? null,
      userAgent: voce.userAgent?.slice(0, 400) ?? null,
      richiestaId: voce.richiestaId ?? null,
    });
  } catch (errore) {
    // Log applicativo, non rilancio: vedi il commento in testa al modulo.
    console.error("[audit] scrittura fallita", {
      azione: voce.azione,
      messaggio: errore instanceof Error ? errore.message : "errore sconosciuto",
    });
  }
}

/** Registra un accesso negato. Serve a distinguere un bug da un tentativo. */
export async function registraNegato(
  attore: Attore | null,
  azione: AzioneAudit,
  motivoInterno: string,
  entita?: { tipo: string; id?: string },
): Promise<void> {
  await registra(attore, {
    azione,
    esito: "negato",
    entita: entita?.tipo,
    entitaId: entita?.id ?? null,
    metadati: { motivo: motivoInterno },
  });
}

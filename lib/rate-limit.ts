/**
 * Rate limit per IP, in memoria.
 *
 * Serve a contenere il costo delle chiamate AI. In ambiente serverless la
 * memoria non è condivisa fra istanze, quindi il limite è approssimato per
 * eccesso: accettabile per la Fase 1. Per un limite esatto in produzione
 * (Fase 2, con gli account) si passa a uno store condiviso.
 */

interface Voce {
  conteggio: number;
  scadeIl: number;
}

const FINESTRA_MS = 24 * 60 * 60 * 1000;
const registro = new Map<string, Voce>();

export interface EsitoLimite {
  consentito: boolean;
  rimanenti: number;
  scadeIl: number;
}

export function verificaLimite(
  chiave: string,
  massimo: number,
  finestraMs: number = FINESTRA_MS,
): EsitoLimite {
  const ora = Date.now();
  const voce = registro.get(chiave);

  if (!voce || voce.scadeIl <= ora) {
    const scadeIl = ora + finestraMs;
    registro.set(chiave, { conteggio: 1, scadeIl });
    return { consentito: true, rimanenti: massimo - 1, scadeIl };
  }

  if (voce.conteggio >= massimo) {
    return { consentito: false, rimanenti: 0, scadeIl: voce.scadeIl };
  }

  voce.conteggio += 1;
  return { consentito: true, rimanenti: massimo - voce.conteggio, scadeIl: voce.scadeIl };
}

/** IP del client dagli header di Vercel/proxy. */
export function ipClient(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "sconosciuto";
}

/**
 * Variante con finestra esplicita, per i limiti che non sono giornalieri
 * (invio dei link di accesso, invii di modulo). Restituisce `{ ok }` perché
 * i chiamanti che la usano non hanno bisogno del conteggio residuo.
 */
export function limitaRichieste(
  chiave: string,
  massimo: number,
  finestraMs: number,
): { ok: boolean; scadeIl: number } {
  const esito = verificaLimite(chiave, massimo, finestraMs);
  return { ok: esito.consentito, scadeIl: esito.scadeIl };
}

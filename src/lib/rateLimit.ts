/**
 * Rate limiter per IP, in memoria (best-effort).
 * Limita le analisi manoscritto per contenere i costi API.
 *
 * Nota: in un deploy serverless la memoria non è condivisa tra le istanze,
 * quindi il limite è approssimativo. Per un limite rigoroso in produzione
 * usare uno store condiviso (es. Upstash Redis). Sufficiente per la Fase 1.
 */

interface Entry {
  count: number;
  resetAt: number; // epoch ms
}

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 ore
const store = new Map<string, Entry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** Verifica e incrementa il contatore per una chiave (es. IP). */
export function checkRateLimit(key: string, max: number, now = fixedNow()): RateLimitResult {
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }
  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/** Estrae l'IP client dagli header della richiesta. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// Isolato per testabilità (Date.now non è disponibile in alcuni contesti sandbox).
function fixedNow(): number {
  return Date.now();
}

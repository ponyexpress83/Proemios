/**
 * Client Drizzle su PostgreSQL (driver node-postgres).
 *
 * Perché `pg` e non il driver HTTP serverless di Neon: il driver HTTP non
 * supporta le transazioni, e qui servono davvero — creare un progetto significa
 * scrivere progetto, tappe, membri, evento di audit e notifiche insieme o per
 * niente. Neon parla il protocollo Postgres standard dal runtime Node di
 * Vercel, quindi la scelta non ci lega a nessun fornitore e permette di far
 * girare i test di integrazione su un Postgres locale.
 *
 * L'inizializzazione è differita al primo uso: `next build` e i test unitari
 * devono poter girare senza `DATABASE_URL`.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | null = null;
let istanza: Db | null = null;

function creaPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    // Neon e i pooler gestiti richiedono TLS; un Postgres locale su socket no.
    ssl: /\bsslmode=disable\b/.test(connectionString) || connectionString.includes("localhost")
      ? undefined
      : { rejectUnauthorized: true },
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getDb(): Db {
  if (istanza) return istanza;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL non impostata. Copia .env.example in .env.local e configura la connessione.",
    );
  }
  pool = creaPool(connectionString);
  istanza = drizzle(pool, { schema });
  return istanza;
}

export function dbConfigurato(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Chiude il pool. Serve ai test: senza, il processo resta appeso. */
export async function chiudiDb(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
  istanza = null;
}

/**
 * Proxy sul client reale: permette di scrivere `db.insert(...)` ovunque
 * mantenendo l'inizializzazione differita.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
export type ClientDb = Db;
/** Tipo accettato dalle funzioni che devono poter girare dentro una transazione. */
export type EsecutoreDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

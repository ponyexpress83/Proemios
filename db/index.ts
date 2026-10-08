/**
 * Client Drizzle su Neon Postgres (driver serverless).
 * Usare `db` nelle server action / route handler. Mai lato client.
 *
 * L'inizializzazione è differita al primo uso: `next build` e i test devono
 * poter girare senza `DATABASE_URL`. Se manca quando serve davvero, l'errore
 * arriva lì, con un messaggio che dice cosa fare.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let istanza: Db | null = null;

export function getDb(): Db {
  if (istanza) return istanza;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL non impostata. Copia .env.example in .env.local e configura la connessione Neon.",
    );
  }
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });
  istanza = drizzle(pool, { schema });
  return istanza;
}

export function dbConfigurato(): boolean {
  return Boolean(process.env.DATABASE_URL);
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

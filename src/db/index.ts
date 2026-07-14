import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Client Drizzle su Neon (driver serverless HTTP, edge-friendly).
 * Istanziato lazy per non richiedere DATABASE_URL a build-time.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL non configurata: impossibile connettersi al database.");
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };

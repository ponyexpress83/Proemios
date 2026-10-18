/**
 * Build su Vercel (script `vercel-build`). Applica le migrazioni solo se
 * richiesto in modo esplicito e solo su un'anteprima:
 *   VERCEL_ENV=preview  e  RUN_MIGRATIONS_ON_PREVIEW=1  e  DATABASE_URL presente.
 * In produzione non migra mai: lì le migrazioni restano un passo manuale
 * (`npm run db:migrate`). Va attivato solo se il database dell'anteprima è
 * separato da quello di produzione. Le migrazioni Drizzle sono registrate e
 * idempotenti: una seconda build non ripete quelle già applicate.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const env = process.env.VERCEL_ENV ?? "";
const wanted = process.env.RUN_MIGRATIONS_ON_PREVIEW === "1";
if (wanted && env === "production") {
  console.error("RUN_MIGRATIONS_ON_PREVIEW è attivo in produzione: rimuovilo. In produzione si migra solo a mano.");
  process.exit(1);
}
if (wanted && env === "preview") {
  if (!process.env.DATABASE_URL) {
    console.error("RUN_MIGRATIONS_ON_PREVIEW=1 ma DATABASE_URL manca: nessuna migrazione applicata.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15_000 });
  await client.connect();
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    const { rows } = await client.query("select count(*)::int as n from drizzle.__drizzle_migrations");
    console.log(`Migrazioni dell'anteprima aggiornate: ${rows[0].n} registrate.`);
  } finally {
    await client.end();
  }
} else if (wanted) {
  console.log(`RUN_MIGRATIONS_ON_PREVIEW ignorato: ambiente «${env || "locale"}», non anteprima.`);
}
const build = spawnSync("npx", ["next", "build"], { stdio: "inherit" });
process.exit(build.status ?? 1);

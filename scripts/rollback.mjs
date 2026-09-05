/**
 * Annulla l'ultima migrazione applicata, eseguendo il file di rollback
 * corrispondente in drizzle/down/.
 *
 *   npm run db:rollback              # annulla l'ultima migrazione applicata
 *   npm run db:rollback -- 0002_x    # annulla una migrazione specifica
 *
 * drizzle-kit non genera migrazioni inverse: i file in drizzle/down/ sono
 * scritti insieme a quelli in avanti e vanno tenuti allineati. Questo script
 * esegue il rollback in transazione e rimuove la riga dalla tabella
 * `drizzle.__drizzle_migrations`, così una successiva `db:migrate` riapplica
 * la migrazione dall'inizio.
 */
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL non impostata.");
  process.exit(1);
}

const client = new Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("sslmode=disable")
    ? undefined
    : { rejectUnauthorized: true },
});
await client.connect();

const richiesta = process.argv[2];

const { rows } = await client.query(
  "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 20",
);
if (rows.length === 0) {
  console.error("Nessuna migrazione applicata.");
  await client.end();
  process.exit(1);
}

const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
const applicate = journal.entries.slice(0, rows.length).reverse(); // più recenti prima
const tag = richiesta ?? applicate[0].tag;
const voce = journal.entries.find((e) => e.tag === tag);
if (!voce) {
  console.error(`Migrazione "${tag}" non presente nel journal.`);
  await client.end();
  process.exit(1);
}

let sql;
try {
  sql = await readFile(`drizzle/down/${tag}.down.sql`, "utf8");
} catch {
  console.error(
    `Manca drizzle/down/${tag}.down.sql. Ogni migrazione deve avere il suo rollback: scrivilo prima di procedere.`,
  );
  await client.end();
  process.exit(1);
}

const riga = rows.find((r, i) => applicate[i]?.tag === tag) ?? rows[0];

console.log(`Rollback di ${tag}…`);
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("DELETE FROM drizzle.__drizzle_migrations WHERE id = $1", [riga.id]);
  await client.query("COMMIT");
  console.log(`Fatto. ${tag} annullata e rimossa dal registro delle migrazioni.`);
} catch (errore) {
  await client.query("ROLLBACK");
  console.error("Rollback fallito, nessuna modifica applicata:", errore.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

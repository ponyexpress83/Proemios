/**
 * Genera il file di rollback per una migrazione drizzle-kit.
 *
 *   node scripts/genera-rollback.mjs 0002_parallel_nitro
 *
 * drizzle-kit non produce migrazioni inverse. Questo script ricava il rollback
 * dal SQL in avanti: elimina le tabelle create, le colonne aggiunte a tabelle
 * preesistenti e i tipi enum introdotti. **Va riletto prima di fidarsene**: non
 * sa ricostruire dati, e su una migrazione che trasforma colonne esistenti
 * produce un rollback incompleto, che va completato a mano.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const tag = process.argv[2];
if (!tag) {
  console.error("Uso: node scripts/genera-rollback.mjs <tag-migrazione>");
  process.exit(1);
}

const sql = await readFile(`drizzle/${tag}.sql`, "utf8");

const tabelle = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);
const tipi = [...sql.matchAll(/CREATE TYPE "public"\."([a-z_]+)"/g)].map((m) => m[1]);
/*
 * `ADD COLUMN IF NOT EXISTS` significa "questa colonna può già esistere perché
 * l'ha creata una migrazione precedente": non appartiene a questa, e il suo
 * rollback non deve toglierla. Senza questo filtro, annullare la 0002
 * cancellerebbe anche le colonne introdotte dalla 0001.
 */
const colonne = [...sql.matchAll(/ALTER TABLE "([a-z_]+)" ADD COLUMN "([a-z_]+)"/g)]
  .map((m) => [m[1], m[2]])
  .filter(([tab]) => !tabelle.includes(tab));

const trasformazioni = [...sql.matchAll(/ALTER TABLE "[a-z_]+" (?:ALTER|RENAME|DROP) /g)];

const righe = [
  `-- Rollback della migrazione ${tag}.`,
  "--",
  "-- Generato da scripts/genera-rollback.mjs e riletto a mano.",
  "--",
  "-- ATTENZIONE: eliminare una tabella elimina i suoi dati. Serve ad annullare",
  "-- un rilascio andato male in staging, non all'uso ordinario in produzione.",
  "-- Fare un backup prima di eseguirlo.",
  "--",
  "--   npm run db:rollback",
  "",
];

if (trasformazioni.length > 0) {
  righe.push(
    `-- ATTENZIONE: la migrazione contiene ${trasformazioni.length} istruzioni di`,
    "-- trasformazione (ALTER/RENAME/DROP) che questo rollback NON annulla.",
    "-- Vanno scritte a mano qui sotto prima di considerare reversibile la migrazione.",
    "",
  );
}

if (colonne.length) {
  righe.push("-- Colonne aggiunte a tabelle preesistenti");
  for (const [tab, col] of colonne) righe.push(`ALTER TABLE "${tab}" DROP COLUMN IF EXISTS "${col}";`);
  righe.push("");
}

if (tabelle.length) {
  righe.push("-- Tabelle introdotte dalla migrazione");
  for (const tab of [...tabelle].reverse()) righe.push(`DROP TABLE IF EXISTS "${tab}" CASCADE;`);
  righe.push("");
}

if (tipi.length) {
  righe.push("-- Tipi enum introdotti dalla migrazione");
  for (const tipo of tipi) righe.push(`DROP TYPE IF EXISTS "public"."${tipo}";`);
}

await mkdir("drizzle/down", { recursive: true });
await writeFile(`drizzle/down/${tag}.down.sql`, righe.join("\n") + "\n");
console.log(
  `drizzle/down/${tag}.down.sql — ${tabelle.length} tabelle, ${colonne.length} colonne, ${tipi.length} tipi` +
    (trasformazioni.length ? `, ${trasformazioni.length} trasformazioni da completare a mano` : ""),
);

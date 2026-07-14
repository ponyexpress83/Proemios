/**
 * Seed di esempio per il database Kalamos Studio.
 * Uso: `npm run db:seed` (richiede DATABASE_URL e le migration già applicate).
 *
 * Popola:
 *  - i 12 articoli del blog come outline (contenuto TODO)
 *  - qualche lead / preventivo / analisi di esempio per la dashboard admin
 */
import "dotenv/config";
import { getDb } from "../src/db";
import { leads, quotes, manuscriptAnalyses, posts } from "../src/db/schema";
import { BLOG_POSTS } from "../src/config/blog";
import { calcolaPreventivo } from "../src/lib/pricing";

async function main() {
  const db = getDb();

  console.log("→ Seed dei post del blog…");
  for (const p of BLOG_POSTS) {
    await db
      .insert(posts)
      .values({
        slug: p.slug,
        titolo: p.titolo,
        estratto: p.estratto,
        categoria: p.categoria,
        contenuto: null,
        outline: p.outline,
        pubblicato: null,
      })
      .onConflictDoNothing({ target: posts.slug });
  }
  console.log(`  ${BLOG_POSTS.length} post inseriti (o già presenti).`);

  console.log("→ Seed di lead ed entità di esempio…");

  const [leadPreventivo] = await db
    .insert(leads)
    .values({
      nome: "Giulia Bianchi",
      email: "giulia.bianchi@example.com",
      telefono: "+39 333 1234567",
      fonte: "preventivo",
      note: "Romanzo da revisionare, ~80k parole.",
    })
    .returning();

  if (leadPreventivo) {
    const preventivo = calcolaPreventivo({
      projectType: "romanzo",
      statoTesto: "scritto-da-revisionare",
      parole: 80000,
      servizi: ["editing", "impaginazioneCartacea", "epub", "copertina", "pubblicazioneKdp"],
      tempistica: "standard",
    });
    await db.insert(quotes).values({
      leadId: leadPreventivo.id,
      input: {
        projectType: "romanzo",
        statoTesto: "scritto-da-revisionare",
        parole: 80000,
        tempistica: "standard",
      },
      pacchetti: preventivo.pacchetti,
      pacchettoScelto: "consigliato",
      stato: "sent",
    });
  }

  const [leadAnalisi] = await db
    .insert(leads)
    .values({
      nome: "Marco Rossi",
      email: "marco.rossi@example.com",
      fonte: "analisi",
    })
    .returning();

  if (leadAnalisi) {
    await db.insert(manuscriptAnalyses).values({
      leadId: leadAnalisi.id,
      filename: "primo-romanzo.docx",
      wordCount: 54210,
      report: {
        leggibilita: { punteggio: 72, commento: "Buona scorrevolezza, periodi a tratti lunghi." },
        livelloIntervento: "editing-leggero",
        puntiForza: ["Voce riconoscibile", "Dialoghi vivaci", "Incipit efficace"],
        areeIntervento: ["Ritmo del secondo atto", "Ripetizioni lessicali", "Coerenza dei tempi verbali"],
      },
    });
  }

  const [leadPagato] = await db
    .insert(leads)
    .values({
      nome: "Studio Aurora (agenzia)",
      email: "produzione@studioaurora.example.com",
      fonte: "agenzie",
      note: "Partner white label — 3 titoli/mese.",
    })
    .returning();

  if (leadPagato) {
    const preventivo = calcolaPreventivo({
      projectType: "professionale",
      statoTesto: "bozza-incompleta",
      parole: 45000,
      servizi: ["editing", "impaginazioneCartacea", "epub", "copertina", "pubblicazioneKdp", "schedaAmazon"],
      tempistica: "prioritaria",
    });
    await db.insert(quotes).values({
      leadId: leadPagato.id,
      input: { projectType: "professionale", statoTesto: "bozza-incompleta", parole: 45000 },
      pacchetti: preventivo.pacchetti,
      pacchettoScelto: "signature",
      stato: "deposit_paid",
      stripeSessionId: "cs_test_seed_example",
    });
  }

  console.log("✓ Seed completato.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed fallito:", err);
  process.exit(1);
});

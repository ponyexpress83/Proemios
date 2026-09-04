/**
 * Seed di sviluppo — dati realistici per lavorare sull'admin.
 * Esegui con: npm run db:seed  (richiede DATABASE_URL).
 */
import "dotenv/config";
import { db } from "./index";
import { eq } from "drizzle-orm";
import {
  leads,
  quotes,
  manuscriptAnalyses,
  agencyLeads,
  organizations,
  users,
  staffAccounts,
} from "./schema";
import { computeQuote } from "../lib/pricing";

/**
 * Organizzazione dello studio e primo amministratore.
 *
 * Serve anche in produzione, una volta sola: senza un'organizzazione `studio` e
 * un `super_admin` non esiste nessuno che possa invitare gli altri. È l'unico
 * account creato senza invito, ed è idempotente — rieseguire il seed non
 * duplica nulla e non tocca un account esistente.
 *
 * L'indirizzo si passa con SEED_ADMIN_EMAIL. Nessuna password: si entra con il
 * link di accesso.
 */
async function fondazione() {
  const emailAdmin = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();

  let [studio] = await db.select().from(organizations).where(eq(organizations.slug, "proemios"));
  if (!studio) {
    [studio] = await db
      .insert(organizations)
      .values({ slug: "proemios", nome: "Proemios", tipo: "studio" })
      .returning();
    console.log("Seed: creata l'organizzazione studio.");
  }

  if (!emailAdmin) {
    console.log(
      "Seed: SEED_ADMIN_EMAIL non impostata, nessun amministratore creato.\n" +
        "      Per crearne uno: SEED_ADMIN_EMAIL=tu@dominio.it npm run db:seed",
    );
    return studio!;
  }

  const [esistente] = await db.select().from(users).where(eq(users.email, emailAdmin));
  if (esistente) {
    console.log(`Seed: l'amministratore ${emailAdmin} esiste già, lasciato invariato.`);
    return studio!;
  }

  const [admin] = await db
    .insert(users)
    .values({
      email: emailAdmin,
      name: "Amministratore",
      ruolo: "super_admin",
      organizationId: studio!.id,
      emailVerified: new Date(),
    })
    .returning();
  await db.insert(staffAccounts).values({ userId: admin!.id, titolo: "Amministratore" });
  console.log(`Seed: creato l'amministratore ${emailAdmin}.`);

  return studio!;
}

async function seed() {
  const studio = await fondazione();

  console.log("Seed: pulizia dei dati dimostrativi…");
  await db.delete(quotes);
  await db.delete(manuscriptAnalyses);
  await db.delete(agencyLeads);
  await db.delete(leads);

  console.log("Seed: inserimento lead…");

  const [lauraLead] = await db
    .insert(leads)
    .values({
      organizationId: studio.id,
      nome: "Laura Bianchi",
      email: "laura.bianchi@example.com",
      telefono: "+39 340 1112233",
      fonte: "preventivo",
      consensoPrivacy: true,
      consensoMarketing: true,
      note: "Romanzo storico, cerca editing e pubblicazione.",
    })
    .returning();

  const [marcoLead] = await db
    .insert(leads)
    .values({
      organizationId: studio.id,
      nome: "Marco Verdi",
      email: "marco.verdi@example.com",
      fonte: "analisi",
      consensoPrivacy: true,
      consensoMarketing: false,
      note: "Ha caricato un manoscritto per l'analisi gratuita.",
    })
    .returning();

  const [giuliaLead] = await db
    .insert(leads)
    .values({
      organizationId: studio.id,
      nome: "Giulia Neri",
      email: "giulia.neri@example.com",
      telefono: "+39 333 4455667",
      fonte: "preventivo",
      consensoPrivacy: true,
      consensoMarketing: true,
      note: "Memoir da diari personali. Molto materiale disponibile.",
    })
    .returning();

  const [agenziaLead] = await db
    .insert(leads)
    .values({
      organizationId: studio.id,
      nome: "Studio Ponti (referente: Anna Ponti)",
      email: "anna@studioponti.example",
      fonte: "agenzie",
      consensoPrivacy: true,
      consensoMarketing: false,
      note: "Agenzia di personal branding, cerca produzione white label.",
    })
    .returning();

  if (!lauraLead || !marcoLead || !giuliaLead || !agenziaLead) {
    throw new Error("Seed: inserimento lead fallito.");
  }

  console.log("Seed: preventivi…");

  const lauraInput = {
    projectType: "romanzo" as const,
    textState: "finito-da-revisionare" as const,
    wordCount: 75_000,
    urgency: "standard" as const,
  };
  const lauraQuote = computeQuote(lauraInput);
  await db.insert(quotes).values({
    leadId: lauraLead.id,
    input: lauraInput,
    pacchettiGenerati: lauraQuote.packages,
    pacchettoScelto: "consigliato",
    prezzoTotale: lauraQuote.packages[1].total,
    acconto: lauraQuote.packages[1].deposit,
    stato: "deposit_paid",
    stripeSessionId: "cs_test_seed_laura",
  });

  const giuliaInput = {
    projectType: "memoir" as const,
    textState: "solo-materiali" as const,
    wordCount: 45_000,
    materialAmount: "abbondante" as const,
    urgency: "standard" as const,
  };
  const giuliaQuote = computeQuote(giuliaInput);
  await db.insert(quotes).values({
    leadId: giuliaLead.id,
    input: giuliaInput,
    pacchettiGenerati: giuliaQuote.packages,
    pacchettoScelto: "signature",
    prezzoTotale: giuliaQuote.packages[2].total,
    acconto: giuliaQuote.packages[2].deposit,
    stato: "sent",
  });

  console.log("Seed: analisi manoscritto…");
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await db.insert(manuscriptAnalyses).values({
    leadId: marcoLead.id,
    filename: "il-mare-di-dentro.docx",
    wordCount: 62_340,
    expiresAt: expires,
    report: {
      readability: 68,
      avgSentenceWords: 18,
      genre: "Narrativa contemporanea",
      strengths: ["Voce riconoscibile", "Dialoghi credibili", "Buon incipit"],
      priorities: ["Ridurre le ripetizioni", "Uniformare i tempi verbali", "Sfoltire gli incisi"],
      recommendedLevel: "editing-leggero",
    },
  });

  console.log("Seed: lead agenzia…");
  await db.insert(agencyLeads).values({
    leadId: agenziaLead.id,
    nomeAgenzia: "Studio Ponti",
    sito: "https://studioponti.example",
    serviziEsternalizzati: "Ghostwriting, impaginazione",
    volumeStimato: "2-4 libri/mese",
  });

  console.log("Seed completato.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed fallito:", err);
    process.exit(1);
  });

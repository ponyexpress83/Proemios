/**
 * Supporto ai test di integrazione.
 *
 * Girano su un Postgres vero (`TEST_DATABASE_URL`), non su un mock: un mock che
 * accetta qualunque query non può dimostrare che un tenant non veda i dati di
 * un altro, ed è esattamente quello che questi test devono provare.
 *
 *   npm run db:up && npm run test:integrazione
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Attore } from "@/lib/auth/attore";
import type { Ruolo } from "@/lib/auth/ruoli";

export const URL_TEST = process.env.TEST_DATABASE_URL;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function preparaDatabase() {
  if (!URL_TEST) throw new Error("TEST_DATABASE_URL non impostata.");
  // Il livello dati legge `DATABASE_URL`: puntandola al database di test, le
  // funzioni sotto esame girano esattamente come in produzione.
  process.env.DATABASE_URL = URL_TEST;

  if (!pool) {
    pool = new Pool({ connectionString: URL_TEST });
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
  }
  return db!;
}

export async function chiudiDatabase() {
  const { chiudiDb } = await import("@/db");
  await chiudiDb();
  if (pool) await pool.end();
  pool = null;
  db = null;
}

/**
 * Svuota le tabelle fra un test e l'altro. `TRUNCATE ... CASCADE` in un colpo
 * solo: cancellare tabella per tabella richiederebbe di conoscere l'ordine
 * delle dipendenze e di aggiornarlo a ogni entità nuova.
 */
export async function svuota() {
  const d = await preparaDatabase();
  await d.execute(sql`
    TRUNCATE TABLE
      audit_events, notifications, provider_policies,
      editorial_interventions, ai_job_runs, reviews, editorial_jobs,
      deliverables, file_versions, files,
      approvals, clarification_requests, messages, tasks, milestones,
      project_stages, project_members, projects,
      invoices, payments, contracts, orders,
      quote_items, quotes, manuscript_analyses, agency_leads, lead_events, leads,
      clients, inviti, staff_accounts, sessions, accounts, verification_tokens, users,
      organizations
    RESTART IDENTITY CASCADE
  `);
}

export type Scenario = {
  studio: string;
  agenziaA: string;
  agenziaB: string;
  attori: Record<string, Attore>;
};

/**
 * Costruisce lo scenario condiviso: lo studio Proemios e due agenzie, ognuna
 * con il proprio staff e i propri clienti. Serve a provare che l'agenzia A non
 * raggiunga nulla dell'agenzia B.
 */
export async function creaScenario(): Promise<Scenario> {
  const d = await preparaDatabase();

  const [studio, agenziaA, agenziaB] = await d
    .insert(schema.organizations)
    .values([
      { slug: "proemios", nome: "Proemios", tipo: "studio" },
      { slug: "agenzia-a", nome: "Agenzia A", tipo: "agenzia" },
      { slug: "agenzia-b", nome: "Agenzia B", tipo: "agenzia" },
    ])
    .returning();

  async function utente(
    email: string,
    ruolo: Ruolo,
    organizationId: string,
    nome: string,
  ): Promise<Attore> {
    const [u] = await d
      .insert(schema.users)
      .values({ email, name: nome, ruolo, organizationId })
      .returning();
    return {
      userId: u!.id,
      email,
      nome,
      ruolo,
      organizationId,
      clientId: null,
      attivo: true,
    };
  }

  const attori: Record<string, Attore> = {
    admin: await utente("admin@proemios.it", "super_admin", studio!.id, "Admin"),
    operations: await utente("ops@proemios.it", "operations_admin", studio!.id, "Operations"),
    responsabile: await utente("edit@proemios.it", "editorial_manager", studio!.id, "Responsabile"),
    redattore: await utente("philippe@proemios.it", "editor_reviewer", studio!.id, "Philippe"),
    finance: await utente("finance@proemios.it", "finance", studio!.id, "Amministrazione"),
    opsAgenziaA: await utente("ops@agenzia-a.it", "operations_admin", agenziaA!.id, "Ops A"),
    // Un'agenzia ha il proprio amministratore: serve a provare che nemmeno un
    // super_admin di agenzia esca dal proprio tenant.
    adminAgenziaA: await utente("admin@agenzia-a.it", "super_admin", agenziaA!.id, "Admin A"),
    opsAgenziaB: await utente("ops@agenzia-b.it", "operations_admin", agenziaB!.id, "Ops B"),
  };

  return { studio: studio!.id, agenziaA: agenziaA!.id, agenziaB: agenziaB!.id, attori };
}

/** Crea un lead direttamente in database, saltando il livello dati. */
export async function creaLead(dati: {
  nome: string;
  email: string;
  organizationId: string | null;
  stato?: (typeof schema.statoLeadEnum.enumValues)[number];
  leadScore?: number;
  valoreStimato?: number;
}) {
  const d = await preparaDatabase();
  const [lead] = await d
    .insert(schema.leads)
    .values({
      nome: dati.nome,
      email: dati.email,
      fonte: "preventivo",
      organizationId: dati.organizationId,
      stato: dati.stato ?? "nuovo",
      leadScore: dati.leadScore ?? null,
      valoreStimato: dati.valoreStimato ?? null,
      consensoPrivacy: true,
      attribution: { utmSource: "google", gclid: "click-123", landingPath: "/preventivo" },
    })
    .returning();
  return lead!;
}

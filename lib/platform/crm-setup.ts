/**
 * Configurazione guidata e simulatore delle regole di assegnazione.
 *
 * La configurazione guidata legge lo stato vero (impostazioni salvate,
 * persone, servizi, attività automatiche) e non dichiara pronto il CRM se
 * manca qualcosa che serve ai flussi scelti. I valori predefiniti restano
 * proposte da verificare, non decisioni approvate.
 *
 * Il simulatore usa lo stesso motore dell'assegnazione reale e non scrive
 * nulla: niente richieste, notifiche o attività.
 */
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmContacts, crmDeals, teamProfiles } from "@/db/crm-schema";
import { memberships, platformSettings, staffInvitations } from "@/db/platform-schema";
import { chooseAssignee, type AssignmentCandidate } from "@/lib/crm-core/assignment";
import { addBusinessMinutes } from "@/lib/crm-core/hours";
import { assignmentRulesSchema, defaultAssignmentRules, PRIORITIES, LEAD_SOURCES, type AssignmentRules } from "@/lib/crm-core/rules";
import { normalizeEmail } from "@/lib/crm-core/dedup";
import { campiMancanti, TITOLARE } from "@/config/legal";
import { BRAND } from "@/config/brand";
import { can } from "./permissions";
import { demand, type Actor } from "./access";
import { json, notFound, forbidden, PlatformError, readBody } from "./http";
import { assignmentRules, salesCandidates, slaMinutes } from "./crm-routing";
import { readSetting, writeVersionedSetting } from "./crm-relations";
import { mailConfigured } from "./config";
import { automationSnapshot } from "./automation";
import { migrationStatus } from "./diagnostics";

export const EXCLUSION_LABELS: Record<string, string> = {
  inactive: "account disattivato",
  unverified: "email non verificata",
  not_participating: "non partecipa alle assegnazioni",
  skill: "non ha la competenza richiesta",
  language: "non parla la lingua della richiesta",
  absent: "assente in quel momento",
  capacity: "capacità piena",
};
/** Flussi che l'azienda intende usare: decidono quali sezioni servono davvero. */
const flowsSchema = z
  .object({
    version: z.string().min(1).max(60),
    siteRequests: z.boolean(),
    assistedSales: z.boolean(),
    packageLinks: z.boolean(),
    production: z.boolean(),
    externalApi: z.boolean(),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  })
  .strict();
type Flows = z.infer<typeof flowsSchema>;
const defaultFlows: Flows = { version: "flussi-proposta", siteRequests: true, assistedSales: true, packageLinks: true, production: true, externalApi: false };

type Status = "configured" | "todo" | "not_needed" | "error";
type Section = { key: string; title: string; status: Status; summary: string; items: Array<{ label: string; status: Status; detail?: string }>; href: string };
type Decision = { key: string; question: string; proposal: string; href: string };

/** Cosa manca nel profilo di una persona per poter ricevere lavoro (nessun valore viene inventato). */
export function profileGaps(profile: typeof teamProfiles.$inferSelect | undefined, role: string): string[] {
  const gaps: string[] = [];
  if (!profile) return ["profilo non compilato"];
  if (role === "seller" || role === "editor" || role === "coordinator") {
    if (profile.capacity === null) gaps.push("capacità");
    if (!profile.languages?.length) gaps.push("lingue");
    if (role !== "seller" && !profile.skills?.length) gaps.push("competenze");
  }
  return gaps;
}

export async function setupStatus(actor: Actor) {
  const db = getDb();
  const saved = await db.select().from(platformSettings);
  const has = (key: string) => saved.some((s) => s.key === key);
  const flows = await readSetting<Flows>("crm-flows", flowsSchema, defaultFlows);
  const flowsDecided = has("crm-flows");
  const decisions: Decision[] = [];
  const sections: Section[] = [];

  // 1. Marchio e azienda
  const brandSaved = has("brand");
  const missingLegal = campiMancanti();
  const generalEmailTodo = BRAND.email.general === "ciao@proemios.it";
  sections.push({
    key: "brand", title: "Marchio e azienda", href: "/spazio?tab=crm-settings&section=brand",
    status: missingLegal ? "error" : brandSaved ? "configured" : "todo",
    summary: brandSaved ? "Marchio confermato." : "Il nome del marchio è quello predefinito: confermalo con l'email di assistenza.",
    items: [
      { label: "Nome del marchio ed email di assistenza", status: brandSaved ? "configured" : "todo" },
      { label: `Dati societari (${TITOLARE.ragioneSociale})`, status: missingLegal ? "error" : "configured", detail: missingLegal ? `${missingLegal} campi da compilare in config/legal.ts` : "Presenti nella configurazione legale; si modificano con revisione legale, non da qui." },
    ],
  });
  if (!brandSaved) decisions.push({ key: "brand", question: "Nome del marchio ed email di assistenza da usare nei modelli", proposal: `«${BRAND.name}»${generalEmailTodo ? ", email generale ancora da confermare nel codice (TODO)" : ""}`, href: "/spazio?tab=crm-settings&section=brand" });

  // 2. Catalogo
  const catalogSaved = has("catalog");
  sections.push({
    key: "catalog", title: "Catalogo dei pacchetti standard", href: "/spazio?tab=crm-settings&section=catalog",
    status: !flows.packageLinks ? "not_needed" : catalogSaved ? "configured" : "todo",
    summary: !flows.packageLinks ? "Non usi i link a pacchetto standard." : catalogSaved ? "Catalogo approvato." : "Catalogo proposto (copertina, ePub, KDP, ISBN, scheda Amazon a prezzo di listino): da verificare e approvare.",
    items: [{ label: "Pacchetti venduti con un link dalla trattativa", status: !flows.packageLinks ? "not_needed" : catalogSaved ? "configured" : "todo" }],
  });
  if (flows.packageLinks && !catalogSaved) decisions.push({ key: "catalog", question: "Quali pacchetti standard si vendono con un link", proposal: "Copertina, ePub, KDP, ISBN, scheda Amazon (prezzi dal listino in vigore)", href: "/spazio?tab=crm-settings&section=catalog" });

  // 3. Team e permessi
  const rows = await db.select({ m: memberships, verified: user.emailVerified, mfa: user.twoFactorEnabled }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.active, true));
  const profiles = rows.length ? await db.select().from(teamProfiles).where(inArray(teamProfiles.userId, [...new Set(rows.map((r) => r.m.userId))])) : [];
  const byRole = (role: string) => rows.filter((r) => r.m.role === role);
  const incomplete = rows.filter((r) => ["seller", "editor", "coordinator"].includes(r.m.role)).map((r) => ({ role: r.m.role, gaps: profileGaps(profiles.find((p) => p.userId === r.m.userId), r.m.role) })).filter((x) => x.gaps.length);
  const pending = await db.select({ n: sql<number>`count(*)::int` }).from(staffInvitations).where(and(eq(staffInvitations.status, "pending"), gt(staffInvitations.expiresAt, new Date())));
  const sellers = byRole("seller").length, operators = byRole("editor").length, coordinators = byRole("coordinator").length;
  const teamItems: Section["items"] = [
    { label: `Venditori attivi: ${sellers}`, status: !(flows.siteRequests || flows.assistedSales) ? "not_needed" : sellers ? "configured" : "error", detail: sellers ? undefined : "Senza venditori le richieste restano in coda." },
    { label: `Operatori di produzione: ${operators}, responsabili: ${coordinators}`, status: !flows.production ? "not_needed" : operators && coordinators ? "configured" : "todo" },
    { label: `Profili incompleti: ${incomplete.length}`, status: incomplete.length ? "todo" : "configured", detail: incomplete.length ? incomplete.map((i) => `${i.role}: ${i.gaps.join(", ")}`).join(" · ") : undefined },
    { label: `Inviti in attesa: ${pending[0]?.n ?? 0}`, status: "configured" },
  ];
  sections.push({ key: "team", title: "Team e permessi", href: "/spazio?tab=people", status: teamItems.some((i) => i.status === "error") ? "error" : teamItems.some((i) => i.status === "todo") ? "todo" : "configured", summary: `${rows.length} accessi attivi.`, items: teamItems });
  if (incomplete.length) decisions.push({ key: "profiles", question: "Competenze, lingue, capacità e limiti di sconto di ogni persona", proposal: "Da indicare persona per persona: non vengono dedotti.", href: "/spazio?tab=people" });

  // 4. Orari e assegnazioni
  const rules = await assignmentRules();
  const assignmentSaved = has("assignment-rules");
  const candidates = await salesCandidates(db);
  const probe = chooseAssignee(candidates, { requiredSkill: null, language: rules.defaultLanguage, openDealOwner: null, now: new Date(), orgHours: rules.hours, defaultCapacity: rules.defaultCapacity });
  sections.push({
    key: "assignment", title: "Orari e assegnazioni", href: "/spazio?tab=crm-settings&section=assignment",
    status: !(flows.siteRequests || flows.assistedSales) ? "not_needed" : !assignmentSaved ? "todo" : candidates.some((c) => c.active && c.participates) ? "configured" : "error",
    summary: assignmentSaved ? `Regola ${rules.version} in vigore.` : "Orari lun–ven 9–18 (Europe/Rome) e tempi di risposta sono proposte da confermare.",
    items: [
      { label: "Orari, festività e tempi di prima risposta", status: assignmentSaved ? "configured" : "todo" },
      { label: "Chi riceve le richieste adesso", status: probe.assignee ? "configured" : "todo", detail: probe.assignee ? "Almeno una persona è idonea in questo momento." : `Nessuno idoneo ora: ${probe.considered.map((c) => EXCLUSION_LABELS[c.excluded ?? ""] ?? "idoneo").join(", ") || "nessun venditore"}.` },
    ],
  });
  if (!assignmentSaved) decisions.push({ key: "hours", question: "Giorni e orari di servizio, festività, tempi di prima risposta per priorità, modalità per origine", proposal: "Lun–ven 9–18 Europe/Rome; urgente 60 min, alta 120, normale 480, bassa 1440; escalation dopo 120 min; assegnazione automatica", href: "/spazio?tab=crm-settings&section=assignment" });

  // 5. Attribuzione e regole commerciali
  const commercial = [
    { key: "attribution-rules", label: "Regole di attribuzione e cumulo venditore/affiliato", decision: "Finestra di relazione (proposta 90 giorni), acquisti successivi, cumulo venditore/affiliato (proposta: entrambi)" },
    { key: "commission-rule", label: "Percentuali provvigionali (venditore, affiliato) e vendite assistite", decision: "Percentuali per venditore e affiliato: nessuna proposta, da decidere" },
    { key: "payment-policy", label: "Regime IVA e condizioni di pagamento", decision: "Regime IVA e aliquota: da confermare con il commercialista" },
    { key: "purchase-rule", label: "Regola d'acquisto (servizi acquistabili da soli, sconti massimi, rate)", decision: "Sconto massimo del venditore e in assoluto, rate concesse" },
  ];
  sections.push({ key: "commercial", title: "Attribuzione e regole commerciali", href: "/spazio?tab=crm-settings&section=attribution", status: commercial.every((c) => has(c.key)) ? "configured" : "todo", summary: commercial.every((c) => has(c.key)) ? "Regole approvate." : "Alcune regole usano ancora valori proposti.", items: commercial.map((c) => ({ label: c.label, status: has(c.key) ? "configured" : "todo" })) });
  for (const c of commercial) if (!has(c.key)) decisions.push({ key: c.key, question: c.label, proposal: c.decision, href: c.key === "attribution-rules" ? "/spazio?tab=crm-settings&section=attribution" : "/spazio?tab=settings" });

  // 6. Email
  const realMail = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  sections.push({ key: "email", title: "Email", href: "/spazio?tab=crm-settings&section=diagnostics", status: !mailConfigured() ? "error" : realMail ? "configured" : "todo", summary: !mailConfigured() ? "Nessun servizio email: inviti e notifiche non partono." : realMail ? "Servizio email configurato (la prova è una consegna riuscita in Diagnostica)." : "Trasporto di prova: i messaggi non raggiungono nessuno.", items: [{ label: "Mittente e dominio verificati", status: realMail ? "configured" : "todo" }] });

  // 7. Attività automatiche
  const auto = await automationSnapshot();
  const autoItems: Section["items"] = auto.jobs.map((j) => ({ label: j.label, status: j.state === "ok" ? "configured" : j.state === "never" ? "todo" : "error", detail: j.state === "never" ? (j.job === "frequent" ? "Nessuna esecuzione: serve un pianificatore ogni 10–15 minuti." : "Nessuna esecuzione registrata.") : j.state === "late" ? `In ritardo di ${j.lateMinutes} minuti.` : j.lastError?.error ?? undefined }));
  sections.push({ key: "automation", title: "Pianificazione delle attività automatiche", href: "/spazio?tab=crm-settings&section=automation", status: autoItems.some((i) => i.status === "error") ? "error" : autoItems.some((i) => i.status === "todo") ? "todo" : "configured", summary: "Scadenze, code, prenotazioni e webhook ogni 10–15 minuti; riepiloghi e manutenzione una volta al giorno.", items: autoItems });
  if (auto.jobs.find((j) => j.job === "frequent")?.state === "never") decisions.push({ key: "scheduler", question: "Quale pianificatore chiama la manutenzione frequente", proposal: "GitHub Actions (repository pubblico: gratuito) oppure cron-job.org (gratuito); Vercel Pro solo se si sceglie di pagare", href: "/spazio?tab=crm-settings&section=automation" });

  // 8. Verifica finale
  const migrations = await migrationStatus();
  const required = sections.filter((s) => s.status !== "not_needed");
  const blockers = [...required.filter((s) => s.status !== "configured").map((s) => s.title), ...(migrations.missing.length ? [`Migrazioni mancanti: ${migrations.missing.join(", ")}`] : [])];
  sections.push({ key: "final", title: "Verifica finale", href: "/spazio?tab=crm-settings&section=diagnostics", status: blockers.length ? (migrations.missing.length || required.some((s) => s.status === "error") ? "error" : "todo") : "configured", summary: blockers.length ? `Il CRM non è ancora pronto: ${blockers.join(" · ")}.` : "Tutto ciò che serve ai flussi scelti risulta configurato. Esegui il collaudo con destinatari di prova.", items: [{ label: "Flussi scelti", status: flowsDecided ? "configured" : "todo", detail: `richieste dal sito ${flows.siteRequests ? "sì" : "no"} · vendite assistite ${flows.assistedSales ? "sì" : "no"} · link a pacchetto ${flows.packageLinks ? "sì" : "no"} · produzione ${flows.production ? "sì" : "no"} · API esterne ${flows.externalApi ? "sì" : "no"}` }, { label: "Database e migrazioni", status: migrations.missing.length ? "error" : "configured" }] });
  if (!flowsDecided) decisions.unshift({ key: "flows", question: "Quali flussi userete davvero (richieste dal sito, vendite assistite, link a pacchetto, produzione, API esterne)", proposal: "Tutti tranne le API esterne", href: "/spazio?tab=crm-setup" });
  return { ready: blockers.length === 0 && flowsDecided, flows, flowsDecided, sections, decisions, canEdit: can(actor.grants, "settings.manage") };
}
export async function setupCollection(request: Request, actor: Actor) {
  if (!can(actor.grants, "settings.manage") && !can(actor.grants, "role.manage") && !can(actor.grants, "crm.assign")) throw forbidden();
  if (request.method === "GET") return json(await setupStatus(actor));
  if (request.method !== "PUT") throw notFound();
  demand(actor, "settings.manage");
  const body = await readBody(request, flowsSchema.omit({ approvedAt: true, approvedBy: true, version: true }));
  const value = { ...body, version: `flussi-${new Date().toISOString().slice(0, 16)}`, approvedAt: new Date().toISOString(), approvedBy: actor.id };
  await getDb().transaction((tx) => writeVersionedSetting(tx, "crm-flows", value, actor.id));
  return json({ ok: true });
}

// ── Prova assegnazione ──────────────────────────────────────────────────────
const simulateSchema = z
  .object({
    source: z.enum(LEAD_SOURCES),
    service: z.string().regex(/^[a-zA-Z]{2,40}$/).nullable().optional(),
    language: z.string().min(2).max(8).default("it"),
    priority: z.enum(PRIORITIES).default("normal"),
    at: z.string().datetime().optional(),
    contactEmail: z.string().email().max(320).optional(),
    /** Regola in bozza da confrontare con quella in vigore (non viene salvata). */
    draft: z.record(z.unknown()).optional(),
  })
  .strict();
async function simulateWith(rules: AssignmentRules, candidates: AssignmentCandidate[], input: z.infer<typeof simulateSchema>, openOwner: { userId: string; active: boolean } | null) {
  const now = input.at ? new Date(input.at) : new Date();
  const mode = rules.sourceModes[input.source] ?? rules.mode;
  const respond = slaMinutes(rules, input.priority);
  if (openOwner?.active) return { mode, assignee: openOwner.userId, reason: "open_deal_owner", availableAt: now, slaDueAt: addBusinessMinutes(now, respond, rules.hours), considered: [] as ReturnType<typeof chooseAssignee>["considered"] };
  if (mode !== "automatic") return { mode, assignee: null, reason: mode === "pool" ? "free_pick_queue" : "manual_mode", availableAt: now, slaDueAt: addBusinessMinutes(now, respond, rules.hours), considered: [] as ReturnType<typeof chooseAssignee>["considered"] };
  const decision = chooseAssignee(candidates, { requiredSkill: input.service ?? null, language: input.language, openDealOwner: null, now, orgHours: rules.hours, defaultCapacity: rules.defaultCapacity });
  return { mode, assignee: decision.assignee, reason: decision.reason, availableAt: decision.availableAt, slaDueAt: addBusinessMinutes(decision.availableAt, respond, rules.hours), considered: decision.considered };
}
export async function simulateAssignment(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  if (!can(actor.grants, "crm.assign") && !can(actor.grants, "settings.manage")) throw forbidden();
  const input = await readBody(request, simulateSchema);
  const db = getDb();
  const current = await assignmentRules();
  let draft: AssignmentRules | null = null;
  if (input.draft) {
    const parsed = assignmentRulesSchema.safeParse(input.draft);
    if (!parsed.success) throw new PlatformError(422, "INVALID_POLICY", "La regola in bozza non è valida.", Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    draft = parsed.data;
  }
  const candidates = await salesCandidates(db);
  let openOwner: { userId: string; active: boolean } | null = null;
  if (input.contactEmail) {
    const [contact] = await db.select().from(crmContacts).where(and(eq(crmContacts.emailNormalized, normalizeEmail(input.contactEmail)), isNull(crmContacts.mergedIntoId)));
    const [deal] = contact ? await db.select().from(crmDeals).where(and(eq(crmDeals.contactId, contact.id), isNull(crmDeals.closedAt))).limit(1) : [];
    if (deal?.ownerId) openOwner = { userId: deal.ownerId, active: candidates.some((c) => c.userId === deal.ownerId && c.active) };
  }
  const people = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...candidates.map((c) => c.userId), "-"]));
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? "persona non più attiva" : null);
  const present = (rules: AssignmentRules, r: Awaited<ReturnType<typeof simulateWith>>) => ({
    ruleVersion: rules.version,
    mode: r.mode,
    proposed: r.assignee ? { id: r.assignee, name: nameOf(r.assignee) } : null,
    reason: r.reason,
    explanation:
      r.reason === "open_deal_owner" ? "Il cliente ha una trattativa aperta: resta al suo responsabile." :
      r.reason === "free_pick_queue" ? "Questa origine va nella coda a scelta libera: la prende chi arriva prima." :
      r.reason === "manual_mode" ? "Questa origine è ad assegnazione manuale: chi gestisce le assegnazioni riceve l'avviso." :
      r.reason === "next_shift" ? "Nessuno è in orario: va a chi rientra per primo, la scadenza parte da quel momento." :
      r.reason === "no_eligible" ? "Nessuno idoneo: la richiesta resta nella coda monitorata, chi gestisce le assegnazioni riceve l'avviso e il sistema riprova nel primo periodo utile." :
      "Assegnata alla persona idonea con meno carico in proporzione alla capacità.",
    availableAt: r.availableAt,
    firstResponseDue: r.slaDueAt,
    considered: r.considered.map((c) => ({ name: nameOf(c.userId), excluded: c.excluded, why: c.excluded ? EXCLUSION_LABELS[c.excluded] : "idoneo", load: c.load, capacity: c.capacity, inHours: c.inHours })),
  });
  const result = present(current, await simulateWith(current, candidates, input, openOwner));
  if (!draft) return json({ simulation: result, writes: "nessuna: non sono state create richieste, notifiche o attività" });
  const withDraft = present(draft, await simulateWith(draft, candidates, input, openOwner));
  const queued = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.assignmentStatus, "queued"));
  const waiting = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(isNull(leads.firstResponseAt), sql`${leads.slaDueAt} is not null`, sql`${leads.stage} not in ('won','lost','unreachable')`));
  const openDeals = await db.select({ n: sql<number>`count(*)::int` }).from(crmDeals).where(isNull(crmDeals.closedAt));
  return json({
    simulation: result,
    draft: withDraft,
    impact: {
      newLeads: "Le nuove richieste seguiranno la regola in bozza dal momento dell'approvazione.",
      queuedLeads: { count: Number(queued[0]?.n ?? 0), note: "Le richieste in coda verranno riprovate con la nuova regola al prossimo giro automatico." },
      pendingDeadlines: { count: Number(waiting[0]?.n ?? 0), note: "Le scadenze già calcolate non cambiano." },
      openDeals: { count: Number(openDeals[0]?.n ?? 0), note: "Le trattative in corso non vengono riassegnate." },
    },
    writes: "nessuna",
  });
}
export { defaultAssignmentRules };

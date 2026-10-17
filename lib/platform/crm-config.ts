/**
 * Configurazione del CRM: regole versionate (assegnazione, attribuzione,
 * produzione, motivi di perdita, pipeline, marchio), campi personalizzati,
 * modelli di email e liste di controllo, preferenze di notifica. Nessun nome,
 * dominio o servizio è scritto nel codice del nucleo: tutto passa da qui.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { crmDeals, crmFieldDefinitions, crmShareLinks, crmTemplates, notificationPreferences, settingVersions } from "@/db/crm-schema";
import { user } from "@/db/auth-schema";
import { computeQuote } from "@/lib/pricing";
import { purchasePath } from "./commercial";
import { resolvePaymentPolicy, resolvePurchaseRule } from "./crm";
import { moneyBreakdown, pricingVersion } from "./config";
import { can } from "./permissions";
import { auditEvents, platformSettings } from "@/db/platform-schema";
import { assignmentRulesSchema, attributionRulesSchema, opsRulesSchema, lossReasonsSchema, brandSchema, defaultAssignmentRules, defaultAttributionRules, defaultOpsRules, defaultLossReasons } from "@/lib/crm-core/rules";
import { pipelineSchema } from "@/lib/crm-core/pipelines";
import { fieldDefinitionSchema } from "@/lib/crm-core/fields";
import { demand, demandRecent, demandAvailable, audit, leadAccess, type Actor } from "./access";
import { json, notFound, PlatformError, readBody } from "./http";
import { DEFAULT_PIPELINE, pipelines, readSetting, writeVersionedSetting } from "./crm-relations";
import { NOTIFICATION_EVENTS, CHANNELS } from "./crm-notify";
import { pricingInputSchema } from "@/lib/validation";
import { defaultCatalog } from "./crm-quotes";

const SCHEMAS = {
  "assignment-rules": assignmentRulesSchema,
  "attribution-rules": attributionRulesSchema,
  "ops-rules": opsRulesSchema,
  "loss-reasons": lossReasonsSchema,
  pipelines: z.object({ version: z.string().min(1).max(60), pipelines: z.array(pipelineSchema).max(20), approvedAt: z.string().optional(), approvedBy: z.string().optional() }).strict(),
  brand: brandSchema.extend({ approvedAt: z.string().optional(), approvedBy: z.string().optional() }),
  catalog: z.object({ version: z.string().min(1).max(60), items: z.array(z.object({ key: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/), name: z.string().min(2).max(120), input: pricingInputSchema, active: z.boolean().default(true) }).strict()).max(100), approvedAt: z.string().optional(), approvedBy: z.string().optional() }).strict(),
} as const;
type Key = keyof typeof SCHEMAS;
const DEFAULTS: Record<Key, unknown> = {
  "assignment-rules": defaultAssignmentRules,
  "attribution-rules": defaultAttributionRules,
  "ops-rules": defaultOpsRules,
  "loss-reasons": defaultLossReasons,
  pipelines: { version: "pipeline-v1", pipelines: [DEFAULT_PIPELINE] },
  brand: { name: process.env.BRAND_NAME ?? "Proemios", supportEmail: null, version: "marchio-v1" },
  catalog: defaultCatalog,
};

/** Differenze leggibili tra due valori (percorso → prima/dopo), senza i campi di approvazione. */
export function diffValues(before: unknown, after: unknown, path = ""): Array<{ path: string; from: unknown; to: unknown }> {
  const skip = new Set(["approvedAt", "approvedBy"]);
  if (Array.isArray(before) || Array.isArray(after)) {
    const a = Array.isArray(before) ? before : [], b = Array.isArray(after) ? after : [];
    const keyed = [...a, ...b].every((x) => x && typeof x === "object" && "key" in (x as object));
    if (keyed) {
      const keyOf = (x: unknown) => String((x as { key: string }).key);
      const keys = [...new Set([...a.map(keyOf), ...b.map(keyOf)])];
      return keys.flatMap((k) => diffValues(a.find((x) => keyOf(x) === k), b.find((x) => keyOf(x) === k), `${path}${path ? "." : ""}${k}`));
    }
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ path, from: a, to: b }];
  }
  if ((before && typeof before === "object") || (after && typeof after === "object")) {
    const a = (before ?? {}) as Record<string, unknown>, b = (after ?? {}) as Record<string, unknown>;
    if (before === undefined) return [{ path, from: null, to: after }];
    if (after === undefined) return [{ path, from: before, to: null }];
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !skip.has(k)).flatMap((k) => diffValues(a[k], b[k], `${path}${path ? "." : ""}${k}`));
  }
  return before === after ? [] : [{ path, from: before ?? null, to: after ?? null }];
}
/** Cosa cambia davvero applicando la regola: sempre solo da adesso in avanti. */
const EFFECTS: Record<Key, string> = {
  "assignment-rules": "Vale per le nuove richieste e per quelle ancora in coda al prossimo giro automatico. Le trattative in corso non vengono riassegnate e le scadenze già calcolate restano quelle.",
  "attribution-rules": "Vale per le vendite accettate da ora in poi. Le attribuzioni già registrate e le provvigioni maturate non cambiano.",
  "ops-rules": "Vale per i nuovi passaggi alla produzione e per le prossime fasi pianificate.",
  "loss-reasons": "I motivi archiviati restano sulle trattative già chiuse; non si possono più scegliere per le nuove.",
  pipelines: "Le trattative esistenti restano nella loro fase; una pipeline archiviata non accetta nuove trattative.",
  brand: "Il nuovo nome compare nei modelli e nelle comunicazioni preparate da ora in poi.",
  catalog: "I link già inviati mostrano il pacchetto aggiornato; le proposte già create, accettate o pagate restano invariate.",
};
/** Controlli che impediscono di togliere ciò che i record esistenti usano: si archivia, non si elimina. */
async function guardRemovals(key: Key, value: Record<string, unknown>) {
  const db = getDb();
  if (key === "pipelines") {
    const list = [DEFAULT_PIPELINE, ...((value.pipelines as Array<{ key: string; stages: Array<{ key: string }> }>) ?? [])];
    if ((value.pipelines as Array<{ key: string }>).some((p) => p.key === DEFAULT_PIPELINE.key)) throw new PlatformError(422, "RESERVED_PIPELINE", "La pipeline «Vendite» è quella predefinita e non si ridefinisce.");
    const used = await db.select({ pipeline: crmDeals.pipelineKey, stage: crmDeals.stage, n: sql<number>`count(*)::int` }).from(crmDeals).groupBy(crmDeals.pipelineKey, crmDeals.stage);
    for (const u of used) {
      const p = list.find((x) => x.key === u.pipeline);
      if (!p) throw new PlatformError(409, "IN_USE", `La pipeline «${u.pipeline}» ha ${u.n} trattative: archiviala invece di eliminarla.`);
      if (u.pipeline !== DEFAULT_PIPELINE.key && !p.stages.some((st) => st.key === u.stage)) throw new PlatformError(409, "IN_USE", `La fase «${u.stage}» della pipeline «${u.pipeline}» è usata da ${u.n} trattative: tienila (puoi rinominarla).`);
    }
  }
  if (key === "loss-reasons") {
    const used = await db.select({ key: crmDeals.lostReasonKey }).from(crmDeals).where(sql`${crmDeals.lostReasonKey} is not null`).groupBy(crmDeals.lostReasonKey);
    const keys = new Set((value.reasons as Array<{ key: string }>).map((r) => r.key));
    const missing = used.filter((u) => u.key && !keys.has(u.key)).map((u) => u.key);
    if (missing.length) throw new PlatformError(409, "IN_USE", `Motivi usati da trattative chiuse: ${missing.join(", ")}. Archiviali (non attivi) invece di eliminarli.`);
  }
  if (key === "catalog") {
    const items = value.items as Array<{ key: string; name: string; input: Parameters<typeof computeQuote>[0]; active: boolean }>;
    const linked = await db.select({ key: crmShareLinks.catalogKey }).from(crmShareLinks).where(sql`${crmShareLinks.catalogKey} is not null`).groupBy(crmShareLinks.catalogKey);
    const missing = linked.filter((l) => l.key && !items.some((i) => i.key === l.key)).map((l) => l.key);
    if (missing.length) throw new PlatformError(409, "IN_USE", `Pacchetti già usati in link inviati: ${missing.join(", ")}. Archiviali (non attivi) invece di eliminarli.`);
    const rule = await resolvePurchaseRule();
    const fields: Record<string, string> = {};
    for (const item of items) {
      if (!item.input.singleService || purchasePath(item.input) !== "standard") fields[`items.${item.key}`] = "Un pacchetto standard è un servizio singolo a prezzo di listino: i lavori da valutare passano dalla proposta personalizzata.";
      else if (!rule.autoOfferSingleServices.includes(item.input.singleService)) fields[`items.${item.key}`] = `«${item.input.singleService}» non è acquistabile senza valutazione secondo la regola di acquisto in vigore: aggiorna prima quella regola o usa una proposta personalizzata.`;
    }
    if (Object.keys(fields).length) throw new PlatformError(422, "NOT_STANDARD", "Alcuni pacchetti non sono acquistabili come standard.", fields);
  }
}

export async function crmSettings(request: Request, actor: Actor, sub?: string) {
  if (request.method === "GET" && sub === "history") {
    demandAvailable(actor, "crm.read");
    const key = new URL(request.url).searchParams.get("key") ?? "";
    const rows = await getDb().select({ s: settingVersions, name: user.name }).from(settingVersions).leftJoin(user, eq(user.id, settingVersions.approvedBy)).where(key ? eq(settingVersions.key, key) : sql`true`).orderBy(desc(settingVersions.createdAt)).limit(100);
    return json({ history: rows.map(({ s, name }, i) => ({ key: s.key, version: s.version, approvedBy: name, createdAt: s.createdAt, value: s.value, changes: key ? diffValues(rows[i + 1]?.s.value, s.value) : undefined })) });
  }
  if (request.method === "GET") {
    demandAvailable(actor, "crm.read");
    const rows = await getDb().select().from(platformSettings);
    const history = await getDb().select({ key: settingVersions.key, version: settingVersions.version, approvedBy: settingVersions.approvedBy, createdAt: settingVersions.createdAt }).from(settingVersions).orderBy(desc(settingVersions.createdAt)).limit(200);
    return json({
      settings: Object.fromEntries((Object.keys(SCHEMAS) as Key[]).map((k) => [k, rows.find((r) => r.key === k)?.value ?? DEFAULTS[k]])),
      // Valori ancora predefiniti: proposte da verificare, non decisioni approvate.
      defaults: (Object.keys(SCHEMAS) as Key[]).filter((k) => !rows.some((r) => r.key === k)),
      history,
      pipelines: await pipelines(),
      notificationEvents: NOTIFICATION_EVENTS,
      effects: EFFECTS,
      canEdit: can(actor.grants, "settings.manage"),
    });
  }
  if (request.method !== "PUT") throw notFound();
  demand(actor, "settings.manage");
  demandRecent(actor);
  const body = await readBody(request, z.object({ key: z.enum(Object.keys(SCHEMAS) as [Key, ...Key[]]), value: z.record(z.unknown()), preview: z.boolean().default(false) }).strict());
  const parsed = SCHEMAS[body.key].safeParse({ ...body.value, approvedAt: new Date().toISOString(), approvedBy: actor.id });
  if (!parsed.success) throw new PlatformError(422, "INVALID_POLICY", "Controlla i valori della regola.", Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
  const value = parsed.data as Record<string, unknown> & { version: string };
  await guardRemovals(body.key, value);
  const [currentRow] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, body.key));
  const changes = diffValues(currentRow?.value ?? DEFAULTS[body.key], value);
  const [previous] = await getDb().select().from(settingVersions).where(and(eq(settingVersions.key, body.key), eq(settingVersions.version, value.version)));
  // Una versione già usata non si riscrive con contenuti diversi: si pubblica una versione nuova.
  if (previous && JSON.stringify({ ...(previous.value as object), approvedAt: undefined, approvedBy: undefined }) !== JSON.stringify({ ...value, approvedAt: undefined, approvedBy: undefined }))
    throw new PlatformError(409, "VERSION_EXISTS", "Questa versione esiste già con contenuti diversi: indica una versione nuova.");
  if (body.preview) return json({ preview: true, version: value.version, changes, effect: EFFECTS[body.key] });
  if (!changes.filter((c) => c.path !== "version").length && currentRow) throw new PlatformError(409, "NO_CHANGES", "Nessuna modifica rispetto alla versione in vigore.");
  await getDb().transaction((tx) => writeVersionedSetting(tx, body.key, value, actor.id));
  await audit(actor, "crm.settings_approved", "setting", body.key, { version: value.version, changes: changes.slice(0, 50) });
  return json({ ok: true, version: value.version, changes, effect: EFFECTS[body.key] });
}
/** Catalogo con i prezzi calcolati dal listino in vigore (mai inseriti a mano) e l'esito dei controlli. */
export async function catalogView(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "crm.read");
  const current = await readSetting("catalog", SCHEMAS.catalog, defaultCatalog as z.infer<typeof SCHEMAS.catalog>);
  const policy = await resolvePaymentPolicy();
  const rule = await resolvePurchaseRule();
  const links = await getDb().select({ key: crmShareLinks.catalogKey, n: sql<number>`count(*)::int` }).from(crmShareLinks).where(sql`${crmShareLinks.catalogKey} is not null`).groupBy(crmShareLinks.catalogKey);
  return json({
    version: current.version,
    pricingVersion,
    items: current.items.map((item) => {
      const pkg = computeQuote(item.input).packages.find((p) => p.recommended) ?? computeQuote(item.input).packages[0]!;
      const standard = Boolean(item.input.singleService) && purchasePath(item.input) === "standard";
      return { ...item, price: { netCents: moneyBreakdown(pkg.total, policy).netCents, grossCents: moneyBreakdown(pkg.total, policy).grossCents, depositGrossCents: moneyBreakdown(pkg.deposit, policy).grossCents }, standard, purchasableAlone: standard && rule.autoOfferSingleServices.includes(item.input.singleService!), links: Number(links.find((l) => l.key === item.key)?.n ?? 0) };
    }),
    services: rule.autoOfferSingleServices,
    note: "I prezzi vengono dal listino in vigore: per cambiarli serve una nuova versione del listino, non il catalogo.",
  });
}

export async function fieldCollection(request: Request, actor: Actor, id?: string) {
  if (request.method === "GET" && !id) {
    demandAvailable(actor, "crm.read");
    const history = await getDb().select({ action: auditEvents.action, resourceId: auditEvents.resourceId, detail: auditEvents.detail, createdAt: auditEvents.createdAt, name: user.name }).from(auditEvents).leftJoin(user, eq(user.id, auditEvents.actorId)).where(sql`${auditEvents.action} in ('crm.field_created','crm.field_updated','crm.template_updated')`).orderBy(desc(auditEvents.createdAt)).limit(100);
    return json({ fields: await getDb().select().from(crmFieldDefinitions).orderBy(crmFieldDefinitions.entity, crmFieldDefinitions.key), history });
  }
  demand(actor, "settings.manage");
  if (request.method === "POST" && !id) {
    const body = await readBody(request, fieldDefinitionSchema);
    if (body.type === "select" && !body.options.length) throw new PlatformError(422, "VALIDATION_ERROR", "Un elenco a scelta ha bisogno di almeno un'opzione.", { options: "Aggiungi almeno un'opzione." });
    const [field] = await getDb().insert(crmFieldDefinitions).values(body).onConflictDoNothing().returning();
    if (!field) throw new PlatformError(409, "FIELD_EXISTS", "Esiste già un campo con questa chiave.");
    await audit(actor, "crm.field_created", "field", field.id, { entity: body.entity, key: body.key });
    return json({ field }, 201);
  }
  if (request.method === "PATCH" && id) {
    const body = await readBody(request, z.object({ label: z.string().trim().min(2).max(80).optional(), options: z.array(z.string().trim().min(1).max(80)).max(50).optional(), required: z.boolean().optional(), active: z.boolean().optional() }).strict());
    const [current] = await getDb().select().from(crmFieldDefinitions).where(eq(crmFieldDefinitions.id, id));
    if (!current) throw notFound();
    // Togliere un'opzione già usata lascerebbe valori non più validi: si aggiunge, non si toglie.
    if (body.options && current.type === "select") {
      const removed = current.options.filter((o) => !body.options!.includes(o));
      if (removed.length) {
        const table = { contact: "crm_contacts", deal: "crm_deals", lead: "leads", company: "crm_companies" }[current.entity as "contact"];
        const used = (await getDb().execute(sql`select count(*)::int as n from ${sql.identifier(table)} where ${sql.identifier("custom")}->>${current.key} in (${sql.join(removed.map((o) => sql`${o}`), sql`, `)})`)) as unknown as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
        const n = Number((Array.isArray(used) ? used : used.rows ?? [])[0]?.n ?? 0);
        if (n > 0) throw new PlatformError(409, "IN_USE", `Le opzioni ${removed.join(", ")} sono usate in ${n} schede: lasciale, oppure archivia il campo.`);
      }
    }
    await getDb().update(crmFieldDefinitions).set(body).where(eq(crmFieldDefinitions.id, id));
    await audit(actor, "crm.field_updated", "field", id, { changes: diffValues({ label: current.label, options: current.options, required: current.required, active: current.active }, { label: current.label, options: current.options, required: current.required, active: current.active, ...body }) });
    return json({ ok: true });
  }
  throw notFound();
}

const VARIABLES = ["nome", "responsabile", "prossima_azione", "marchio"] as const;
export function renderTemplate(text: string, values: Partial<Record<(typeof VARIABLES)[number], string>>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => ((VARIABLES as readonly string[]).includes(key) ? (values[key as (typeof VARIABLES)[number]] ?? "") : match));
}
export async function templateCollection(request: Request, actor: Actor, id?: string, action?: string) {
  if (request.method === "GET" && !id) {
    demandAvailable(actor, "crm.read");
    // Con ?all=1 chi gestisce le impostazioni vede anche i modelli archiviati.
    const all = new URL(request.url).searchParams.get("all") === "1" && can(actor.grants, "settings.manage");
    const rows = await getDb().select().from(crmTemplates).where(all ? undefined : eq(crmTemplates.active, true)).orderBy(crmTemplates.kind, crmTemplates.name);
    return json({ templates: rows, variables: VARIABLES });
  }
  if (request.method === "POST" && id && action === "render") {
    demandAvailable(actor, "crm.read");
    const body = await readBody(request, z.object({ leadId: z.string().uuid() }).strict());
    await leadAccess(actor, body.leadId, "crm.read");
    const [template] = await getDb().select().from(crmTemplates).where(eq(crmTemplates.id, id));
    const [lead] = await getDb().select().from(leads).where(eq(leads.id, body.leadId));
    if (!template || !lead) throw notFound();
    const brand = await readSetting("brand", brandSchema, DEFAULTS.brand as z.infer<typeof brandSchema>);
    const values = { nome: lead.nome.split(/\s+/)[0], responsabile: actor.name, prossima_azione: lead.nextAction ?? "", marchio: brand.name };
    // Il testo è una bozza da rivedere e inviare a mano: nessun invio parte da qui.
    return json({ draft: { subject: template.subject ? renderTemplate(template.subject, values) : null, body: template.body ? renderTemplate(template.body, values) : null, items: template.items }, sent: false });
  }
  demand(actor, "settings.manage");
  const schema = z.object({ kind: z.enum(["email", "checklist"]), key: z.string().regex(/^[a-z0-9_-]{2,60}$/), name: z.string().trim().min(2).max(120), subject: z.string().trim().max(200).nullable().optional(), body: z.string().trim().max(10000).nullable().optional(), items: z.array(z.string().trim().min(1).max(300)).max(50).default([]) }).strict();
  if (request.method === "POST" && !id) {
    const body = await readBody(request, schema);
    const [template] = await getDb().insert(crmTemplates).values({ ...body, updatedBy: actor.id }).onConflictDoNothing().returning();
    if (!template) throw new PlatformError(409, "TEMPLATE_EXISTS", "Esiste già un modello con questa chiave.");
    return json({ template }, 201);
  }
  if (request.method === "PATCH" && id && !action) {
    const body = await readBody(request, schema.omit({ key: true, kind: true }).partial().extend({ active: z.boolean().optional() }).strict());
    const [current] = await getDb().select().from(crmTemplates).where(eq(crmTemplates.id, id));
    if (!current) throw notFound();
    // La versione precedente resta nello storico: un modello archiviato non si cancella.
    await getDb().transaction(async (tx) => {
      await tx.insert(settingVersions).values({ key: `template:${current.key}`, version: `v${current.version}`, value: { name: current.name, subject: current.subject, body: current.body, items: current.items, active: current.active }, approvedBy: current.updatedBy }).onConflictDoNothing();
      await tx.update(crmTemplates).set({ ...body, version: current.version + 1, updatedBy: actor.id, updatedAt: new Date() }).where(eq(crmTemplates.id, id));
    });
    await audit(actor, "crm.template_updated", "template", id, { version: current.version + 1, changes: diffValues({ name: current.name, subject: current.subject, body: current.body, items: current.items, active: current.active }, { name: current.name, subject: current.subject, body: current.body, items: current.items, active: current.active, ...body }) });
    return json({ ok: true, version: current.version + 1 });
  }
  throw notFound();
}
export async function notificationSettings(request: Request, actor: Actor) {
  if (request.method === "GET") {
    const rows = await getDb().select().from(notificationPreferences).where(eq(notificationPreferences.userId, actor.id));
    return json({ events: Object.entries(NOTIFICATION_EVENTS).map(([event, e]) => ({ event, label: e.label, channel: rows.find((r) => r.event === event)?.channel ?? e.default, default: e.default })) });
  }
  if (request.method !== "PUT") throw notFound();
  const body = await readBody(request, z.object({ event: z.enum(Object.keys(NOTIFICATION_EVENTS) as [keyof typeof NOTIFICATION_EVENTS, ...Array<keyof typeof NOTIFICATION_EVENTS>]), channel: z.enum(CHANNELS) }).strict());
  await getDb().insert(notificationPreferences).values({ userId: actor.id, ...body }).onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.event], set: { channel: body.channel, updatedAt: new Date() } });
  return json({ ok: true });
}

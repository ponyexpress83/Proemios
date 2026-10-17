/**
 * Configurazione del CRM: regole versionate (assegnazione, attribuzione,
 * produzione, motivi di perdita, pipeline, marchio), campi personalizzati,
 * modelli di email e liste di controllo, preferenze di notifica. Nessun nome,
 * dominio o servizio è scritto nel codice del nucleo: tutto passa da qui.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { crmFieldDefinitions, crmTemplates, notificationPreferences, settingVersions } from "@/db/crm-schema";
import { platformSettings } from "@/db/platform-schema";
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
  catalog: z.object({ version: z.string().min(1).max(60), items: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]{2,40}$/), name: z.string().min(2).max(120), input: pricingInputSchema, active: z.boolean().default(true) }).strict()).max(100), approvedAt: z.string().optional(), approvedBy: z.string().optional() }).strict(),
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

export async function crmSettings(request: Request, actor: Actor) {
  if (request.method === "GET") {
    demandAvailable(actor, "crm.read");
    const rows = await getDb().select().from(platformSettings);
    const history = await getDb().select({ key: settingVersions.key, version: settingVersions.version, approvedBy: settingVersions.approvedBy, createdAt: settingVersions.createdAt }).from(settingVersions).orderBy(desc(settingVersions.createdAt)).limit(200);
    return json({
      settings: Object.fromEntries((Object.keys(SCHEMAS) as Key[]).map((k) => [k, rows.find((r) => r.key === k)?.value ?? DEFAULTS[k]])),
      history,
      pipelines: await pipelines(),
      notificationEvents: NOTIFICATION_EVENTS,
    });
  }
  if (request.method !== "PUT") throw notFound();
  demand(actor, "settings.manage");
  demandRecent(actor);
  const body = await readBody(request, z.object({ key: z.enum(Object.keys(SCHEMAS) as [Key, ...Key[]]), value: z.record(z.unknown()) }).strict());
  const parsed = SCHEMAS[body.key].safeParse({ ...body.value, approvedAt: new Date().toISOString(), approvedBy: actor.id });
  if (!parsed.success) throw new PlatformError(422, "INVALID_POLICY", "Controlla i valori della regola.", Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
  const value = parsed.data as Record<string, unknown> & { version: string };
  const [previous] = await getDb().select().from(settingVersions).where(and(eq(settingVersions.key, body.key), eq(settingVersions.version, value.version)));
  // Una versione già usata non si riscrive con contenuti diversi: si pubblica una versione nuova.
  if (previous && JSON.stringify({ ...(previous.value as object), approvedAt: undefined, approvedBy: undefined }) !== JSON.stringify({ ...value, approvedAt: undefined, approvedBy: undefined }))
    throw new PlatformError(409, "VERSION_EXISTS", "Questa versione esiste già con contenuti diversi: indica una versione nuova.");
  await getDb().transaction((tx) => writeVersionedSetting(tx, body.key, value, actor.id));
  await audit(actor, "crm.settings_approved", "setting", body.key, { version: value.version });
  return json({ ok: true, version: value.version });
}

export async function fieldCollection(request: Request, actor: Actor, id?: string) {
  if (request.method === "GET" && !id) {
    demandAvailable(actor, "crm.read");
    return json({ fields: await getDb().select().from(crmFieldDefinitions).orderBy(crmFieldDefinitions.entity, crmFieldDefinitions.key) });
  }
  demand(actor, "settings.manage");
  if (request.method === "POST" && !id) {
    const body = await readBody(request, fieldDefinitionSchema);
    const [field] = await getDb().insert(crmFieldDefinitions).values(body).onConflictDoNothing().returning();
    if (!field) throw new PlatformError(409, "FIELD_EXISTS", "Esiste già un campo con questa chiave.");
    await audit(actor, "crm.field_created", "field", field.id, { entity: body.entity, key: body.key });
    return json({ field }, 201);
  }
  if (request.method === "PATCH" && id) {
    const body = await readBody(request, z.object({ label: z.string().trim().min(2).max(80).optional(), options: z.array(z.string().trim().min(1).max(80)).max(50).optional(), required: z.boolean().optional(), active: z.boolean().optional() }).strict());
    await getDb().update(crmFieldDefinitions).set(body).where(eq(crmFieldDefinitions.id, id));
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
    return json({ templates: await getDb().select().from(crmTemplates).where(eq(crmTemplates.active, true)).orderBy(crmTemplates.kind, crmTemplates.name), variables: VARIABLES });
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
    await getDb().update(crmTemplates).set({ ...body, version: current.version + 1, updatedBy: actor.id, updatedAt: new Date() }).where(eq(crmTemplates.id, id));
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

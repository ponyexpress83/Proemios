import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { user } from "@/db/auth-schema";
import {
  contracts,
  quoteRecords,
  paymentOrders,
  billingProfiles,
  emailOutbox,
  notifications,
  projects,
  type OrderSheet,
  type ContractAcceptances,
  type PaymentPlan,
} from "@/db/platform-schema";
import type { QuotePackage } from "@/lib/pricing";
import { BRAND } from "@/config/brand";
import { TITOLARE } from "@/config/legal";
import { contractTerms, ORDER_SHEET_TEXTS } from "@/config/contract-terms";
import { moneyBreakdown, appOrigin, type PaymentPolicy } from "./config";
import { quoteAccess } from "./crm";
import { audit, demand, type Actor } from "./access";
import { readBody, json, notFound, PlatformError } from "./http";
import { SimplePdf, euroCents } from "./pdf";
import { storePrivate, readPrivate, storageConfigured } from "./storage";
import { protectMailHtml } from "./mail";
import { impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { installmentSchedule } from "./schedule";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
const serviceNames: Record<string, string> = { proofreading: "Correzione bozze", editing: "Editing", layout: "Impaginazione", epub: "EPUB", cover: "Copertina", kdp: "Pubblicazione KDP", isbn: "Assistenza ISBN", amazonListing: "Scheda Amazon" };
const projectNames: Record<string, string> = { romanzo: "Romanzo", saggio: "Saggio", memoir: "Memoir", "libro-professionale": "Libro professionale", "solo-grafica": "Solo grafica" };
const textStates: Record<string, string> = { "finito-revisionato": "testo finito e revisionato", "finito-da-revisionare": "testo finito da revisionare", "bozza-incompleta": "bozza incompleta", "solo-materiali": "solo materiali" };

export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
/** JSON con chiavi ordinate: la stessa scheda produce sempre la stessa impronta. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : v));
}
export function termsSnapshot() {
  const terms = contractTerms();
  const text = terms.sections.map((s) => `${s.title}\n${s.paragraphs.join("\n")}`).join("\n\n");
  return { ...terms, text, hash: sha256(text) };
}
/** Prova proporzionata dell'accettazione: indirizzo di rete e browser, troncati. */
export function acceptanceEvidence(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  const ip = forwarded && /^[0-9a-f.:]{3,45}$/i.test(forwarded) ? forwarded : null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  return { ip, userAgent };
}
export function buildOrderSheet(input: {
  quoteId: string;
  version: number;
  pricingVersion: string;
  policy: PaymentPolicy;
  pkg: QuotePackage;
  quoteInput: { projectType: string; textState: string; wordCount: number; singleService?: string; urgency?: string };
  plan: PaymentPlan | null;
  customer: { name: string; kind: string; taxCode: string | null; vatNumber: string | null; street: string; postcode: string; city: string; province: string | null; country: string } | null;
  email: string;
}): OrderSheet {
  const money = moneyBreakdown(input.pkg.total, input.policy), deposit = moneyBreakdown(input.pkg.deposit, input.policy).grossCents;
  const schedule = installmentSchedule(money.grossCents, deposit, input.plan);
  const service = input.quoteInput.singleService ? serviceNames[input.quoteInput.singleService] ?? input.quoteInput.singleService : "Percorso editoriale";
  const extraRound = input.pkg.lineItems.some((li) => li.key === "extraRevisionRound");
  return {
    reference: input.quoteId,
    quoteVersion: input.version,
    pricingVersion: input.pricingVersion,
    policyVersion: input.policy.version,
    termsVersion: input.policy.termsVersion,
    service,
    projectType: projectNames[input.quoteInput.projectType] ?? input.quoteInput.projectType,
    packageName: input.pkg.name,
    tier: input.pkg.tier,
    quantity: { wordCount: input.quoteInput.wordCount, textState: textStates[input.quoteInput.textState] ?? input.quoteInput.textState, urgency: input.quoteInput.urgency === "prioritaria" ? "prioritaria" : "standard" },
    lines: input.pkg.lineItems.map((li) => ({ key: li.key, label: li.label, amount: li.amount })),
    includes: input.pkg.includes,
    excludes: input.pkg.excludes,
    revisions: `I giri di revisione indicati nelle voci della fornitura${extraRound ? ", con un giro aggiuntivo" : ""}. Ogni consegna passa dall'approvazione del cliente nell'area riservata; senza riscontro entro 15 giorni la consegna si intende approvata.`,
    deliveries: "File di consegna caricati nell'area riservata, con versioni e approvazioni tracciate. File sorgente consegnati al termine della lavorazione.",
    deadlines: `Tempi ${input.quoteInput.urgency === "prioritaria" ? "prioritari, con maggiorazione inclusa" : "standard"}: decorrono dalla conferma dell'acconto e dalla ricezione di tutti i materiali. Ritardi nei materiali o nei riscontri spostano di pari durata i termini successivi.`,
    startConditions: ORDER_SHEET_TEXTS.startConditions,
    amounts: { vatMode: input.policy.vatMode, vatRateBps: input.policy.vatRateBps, netCents: money.netCents, taxCents: money.taxCents, grossCents: money.grossCents, depositCents: deposit, balanceCents: money.grossCents - deposit },
    installments: schedule.map((s) => ({ kind: s.kind, sequence: s.sequence, amountCents: s.amountCents, label: s.label })),
    customer: input.customer ? { name: input.customer.name, kind: input.customer.kind, taxCode: input.customer.taxCode, vatNumber: input.customer.vatNumber, address: `${input.customer.street}, ${input.customer.postcode} ${input.customer.city}${input.customer.province ? ` (${input.customer.province})` : ""}, ${input.customer.country}`, email: input.email } : null,
    supplier: { name: TITOLARE.ragioneSociale, legalForm: TITOLARE.formaGiuridica, address: TITOLARE.sedeLegale, vat: TITOLARE.partitaIva, email: BRAND.email.general },
    earlyStartText: ORDER_SHEET_TEXTS.earlyStart,
    withdrawalText: ORDER_SHEET_TEXTS.withdrawal,
  };
}
export async function renderContractPdf(sheet: OrderSheet, meta: { acceptedAt: Date; acceptedBy: string; acceptances: ContractAcceptances; consumer: boolean; ip: string | null; termsHash: string; sheetHash: string }) {
  const pdf = await SimplePdf.create();
  const terms = termsSnapshot();
  pdf.line("PROEMIOS · Contratto di fornitura di servizi editoriali", { heading: true });
  pdf.line(`Scheda d'ordine · riferimento ${sheet.reference} · versione proposta ${sheet.quoteVersion} · listino ${sheet.pricingVersion}`);
  pdf.line(`Condizioni generali versione ${terms.version} (aggiornate il ${terms.updated}) · condizioni economiche ${sheet.policyVersion}`);
  pdf.space();
  pdf.line("Fornitore", { heading: true });
  pdf.line(`${sheet.supplier.name} (${sheet.supplier.legalForm}), ${sheet.supplier.address}, P. IVA ${sheet.supplier.vat}, ${sheet.supplier.email}`);
  pdf.line("Cliente", { heading: true });
  pdf.line(sheet.customer ? `${sheet.customer.name}${sheet.customer.vatNumber ? ` · P. IVA ${sheet.customer.vatNumber}` : sheet.customer.taxCode ? ` · CF ${sheet.customer.taxCode}` : ""} · ${sheet.customer.address} · ${sheet.customer.email}` : "Dati di fatturazione da completare prima del pagamento.");
  pdf.line(meta.consumer ? "Cliente consumatore: si applicano le tutele del Codice del Consumo." : "Cliente professionista o impresa.");
  pdf.space();
  pdf.line("Oggetto della fornitura", { heading: true });
  pdf.line(`${sheet.service} · ${sheet.projectType} · pacchetto ${sheet.packageName}`);
  pdf.line(`Quantità: ${sheet.quantity.wordCount.toLocaleString("it-IT")} parole dichiarate, ${sheet.quantity.textState}. Tempi ${sheet.quantity.urgency}.`);
  for (const l of sheet.lines) pdf.line(`- ${l.label} · EUR ${l.amount.toLocaleString("it-IT")}`, { indent: 8 });
  if (sheet.includes.length) pdf.line(`Incluso: ${sheet.includes.join("; ")}`);
  if (sheet.excludes.length) pdf.line(`Non incluso: ${sheet.excludes.join("; ")}`);
  pdf.line(`Revisioni: ${sheet.revisions}`);
  pdf.line(`Consegne: ${sheet.deliveries}`);
  pdf.line(`Tempi: ${sheet.deadlines}`);
  pdf.line(`Avvio: ${sheet.startConditions}`);
  pdf.space();
  pdf.line("Corrispettivo", { heading: true });
  const a = sheet.amounts;
  pdf.line(a.vatMode === "exempt" ? `Totale ${euroCents(a.grossCents)}, operazione esente IVA.` : `Imponibile ${euroCents(a.netCents)} · IVA ${a.vatRateBps / 100}% ${euroCents(a.taxCents)} · Totale ${euroCents(a.grossCents)}`);
  for (const i of sheet.installments) pdf.line(`- ${i.label}: ${euroCents(i.amountCents)}`, { indent: 8 });
  pdf.space();
  pdf.line("Accettazioni registrate", { heading: true });
  pdf.line(`Accettata il ${meta.acceptedAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })} (ora italiana) dall'utente ${meta.acceptedBy}${meta.ip ? `, indirizzo di rete ${meta.ip}` : ""}.`);
  pdf.line("- Condizioni generali di contratto e di pagamento: accettate.", { indent: 8 });
  pdf.line("- Scheda d'ordine (servizio, quantità, importi, tempi): verificata e accettata.", { indent: 8 });
  pdf.line(`- Avvio anticipato durante il periodo di recesso: ${meta.acceptances.earlyStart ? "richiesto espressamente" : "non richiesto"}.`, { indent: 8 });
  if (meta.acceptances.earlyStart) pdf.line(sheet.earlyStartText, { indent: 16 });
  pdf.line(`- Comunicazioni informative facoltative: ${meta.acceptances.marketing ? "consenso dato" : "nessun consenso"} (revocabile in qualsiasi momento, non incide sul contratto).`, { indent: 8 });
  if (meta.consumer) pdf.line(`Recesso: ${sheet.withdrawalText}`);
  pdf.line(`Impronte SHA-256 · scheda d'ordine ${meta.sheetHash} · condizioni generali ${meta.termsHash}`, { size: 8 });
  pdf.line("Documento registrato elettronicamente con le accettazioni sopra indicate. Non è una firma elettronica qualificata.", { size: 8 });
  pdf.space(20);
  pdf.line(`Condizioni generali · versione ${terms.version}`, { heading: true });
  for (const section of terms.sections) {
    pdf.line(section.title, { heading: true, size: 11.5 });
    for (const p of section.paragraphs) pdf.line(p);
  }
  return pdf.finish("Proemios · contratto");
}
/**
 * Crea il contratto dentro la transazione di accettazione: snapshot, impronte,
 * copia stabile nello storage (se configurato) e conferma su supporto durevole
 * (email con allegato). L'assenza dello storage non blocca l'accettazione:
 * la copia viene rigenerata dallo snapshot e la cosa è dichiarata.
 */
export async function createContract(tx: Tx, input: {
  quoteId: string; version: number; tier: string; actor: Actor; sheet: OrderSheet; acceptances: ContractAcceptances; consumer: boolean; evidence: { ip: string | null; userAgent: string | null };
}) {
  const terms = termsSnapshot(), acceptedAt = new Date();
  const sheetHash = sha256(canonical(input.sheet));
  const bytes = await renderContractPdf(input.sheet, { acceptedAt, acceptedBy: input.actor.email, acceptances: input.acceptances, consumer: input.consumer, ip: input.evidence.ip, termsHash: terms.hash, sheetHash });
  const storageKey = storageConfigured() ? await storePrivate(`contracts-${input.quoteId}`, bytes, "application/pdf") : null;
  const [contract] = await tx.insert(contracts).values({
    quoteId: input.quoteId, version: input.version, tier: input.tier, authorId: input.actor.id,
    termsVersion: terms.version, termsHash: terms.hash, orderSheet: input.sheet, orderSheetHash: sheetHash,
    storageKey, pdfHash: sha256(bytes), acceptances: input.acceptances, acceptedAt,
    acceptedIp: input.evidence.ip, acceptedUserAgent: input.evidence.userAgent, consumer: input.consumer,
    withdrawalDeadline: input.consumer ? new Date(acceptedAt.getTime() + 14 * 86400_000) : null,
  }).returning();
  const link = `${appOrigin()}/api/platform/contracts/${contract!.id}/pdf`;
  await tx.insert(emailOutbox).values({
    eventKey: `contract:${contract!.id}:author`,
    recipient: input.actor.email,
    subject: "Conferma del contratto · Proemios",
    html: await protectMailHtml(impaginaEmail("Il tuo contratto", `<p>Ciao ${esc(input.actor.name)}, hai accettato la proposta ${esc(input.sheet.packageName)} (${esc(input.sheet.service)}) per ${esc(euroCents(input.sheet.amounts.grossCents))}${input.sheet.amounts.vatMode === "exempt" ? ", esente IVA" : ", IVA inclusa"}.</p><p>In allegato trovi la scheda d'ordine con le condizioni generali versione ${esc(terms.version)}: è la copia stabile del contratto, che resta scaricabile dalla tua area riservata.</p>${input.consumer ? `<p>${esc(input.sheet.withdrawalText)}</p>` : ""}<p><a href="${esc(link)}">Scarica il contratto</a> · <a href="${esc(appOrigin())}/area-autore?preventivo=${esc(input.quoteId)}">Apri la tua area</a></p>`)),
    attachments: storageKey ? [{ filename: `proemios-contratto-${input.quoteId.slice(0, 8)}.pdf`, storageKey, mime: "application/pdf" }] : null,
  }).onConflictDoNothing();
  return contract!;
}
async function contractFor(actor: Actor, id: string) {
  const [contract] = await getDb().select().from(contracts).where(eq(contracts.id, id));
  if (!contract) throw notFound();
  await quoteAccess(actor, contract.quoteId, "quote.read");
  return contract;
}
export function contractView(c: typeof contracts.$inferSelect) {
  return {
    id: c.id, quoteId: c.quoteId, version: c.version, tier: c.tier, termsVersion: c.termsVersion, termsHash: c.termsHash,
    orderSheetHash: c.orderSheetHash, pdfHash: c.pdfHash, stableCopy: Boolean(c.storageKey), acceptances: c.acceptances,
    acceptedAt: c.acceptedAt, consumer: c.consumer, withdrawalDeadline: c.withdrawalDeadline, withdrawalRequestedAt: c.withdrawalRequestedAt,
    withdrawalOutcome: c.withdrawalOutcome, withdrawalHandledAt: c.withdrawalHandledAt, orderSheet: c.orderSheet,
    pdfUrl: `/api/platform/contracts/${c.id}/pdf`,
  };
}
export async function contractDetail(request: Request, actor: Actor, id: string) {
  if (request.method !== "GET") throw notFound();
  const contract = await contractFor(actor, id);
  return json({ contract: { ...contractView(contract), acceptedIp: actor.staff ? contract.acceptedIp : undefined, acceptedUserAgent: actor.staff ? contract.acceptedUserAgent : undefined } });
}
export async function contractCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  const url = new URL(request.url), quoteId = url.searchParams.get("quote");
  if (!quoteId || !z.string().uuid().safeParse(quoteId).success) throw notFound();
  await quoteAccess(actor, quoteId, "quote.read");
  const rows = await getDb().select().from(contracts).where(eq(contracts.quoteId, quoteId)).orderBy(desc(contracts.version));
  return json({ contracts: rows.map(contractView) });
}
/** Copia stabile: dallo storage se c'è, altrimenti rigenerata dallo snapshot (e dichiarata tale). */
export async function contractPdf(actor: Actor, id: string) {
  const contract = await contractFor(actor, id);
  let bytes: Buffer;
  if (contract.storageKey) {
    const chunks: Uint8Array[] = [];
    const reader = (await readPrivate(contract.storageKey)).getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    bytes = Buffer.concat(chunks);
    if (contract.pdfHash && sha256(bytes) !== contract.pdfHash) throw new PlatformError(409, "CONTRACT_COPY_MISMATCH", "La copia archiviata non corrisponde all'impronta registrata. Contatta il team.");
  } else {
    const [person] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, contract.authorId));
    bytes = await renderContractPdf(contract.orderSheet, { acceptedAt: contract.acceptedAt, acceptedBy: person?.email ?? contract.authorId, acceptances: contract.acceptances, consumer: contract.consumer, ip: contract.acceptedIp, termsHash: contract.termsHash, sheetHash: contract.orderSheetHash });
  }
  await audit(actor, "contract.downloaded", "contract", id, { stable: Boolean(contract.storageKey) });
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=proemios-contratto-${contract.quoteId.slice(0, 8)}-v${contract.version}.pdf`,
    "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
  } });
}
/**
 * Recesso online del consumatore (art. 54 Codice del Consumo: la funzione
 * sul sito vale come modulo). Registra la richiesta, avvisa il team e blocca
 * la lavorazione; nessun rimborso parte da solo: lo prepara e autorizza Finance.
 */
export async function contractWithdraw(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, z.object({ note: z.string().trim().max(2000).optional() }).strict());
  const result = await getDb().transaction(async (tx) => {
    const [contract] = await tx.select().from(contracts).where(eq(contracts.id, id)).for("update");
    if (!contract || contract.authorId !== actor.id) throw notFound();
    if (!contract.consumer || !contract.withdrawalDeadline) throw new PlatformError(409, "WITHDRAWAL_NOT_APPLICABLE", "Il diritto di recesso online vale per i clienti consumatori: scrivi al team per interrompere la lavorazione.");
    if (contract.withdrawalRequestedAt) return { contract, duplicate: true };
    if (contract.withdrawalDeadline.getTime() < Date.now()) throw new PlatformError(409, "WITHDRAWAL_EXPIRED", "I 14 giorni per il recesso sono passati. Puoi comunque interrompere la lavorazione scrivendo al team.");
    const [updated] = await tx.update(contracts).set({ withdrawalRequestedAt: new Date(), withdrawalNote: body.note ?? null }).where(eq(contracts.id, id)).returning();
    await tx.update(projects).set({ remindersPausedAt: new Date(), updatedAt: new Date() }).where(eq(projects.quoteId, contract.quoteId));
    const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, contract.quoteId));
    const paid = await tx.select().from(paymentOrders).where(and(eq(paymentOrders.quoteId, contract.quoteId), eq(paymentOrders.status, "paid")));
    const collected = paid.reduce((n, o) => n + o.amountCents, 0);
    const seller = record?.acceptedSellerId ?? null;
    const detail = `${actor.name} ha esercitato il recesso sul contratto ${contract.quoteId.slice(0, 8)} (incassato ${euroCents(collected)}). ${collected > 0 ? "Finance deve preparare e autorizzare il rimborso entro 14 giorni, al netto del lavoro svolto se era stato chiesto l'avvio anticipato." : "Nessun incasso da rimborsare."}`;
    if (seller) await tx.insert(notifications).values({ userId: seller, title: "Recesso del cliente", body: detail, href: `/spazio?preventivo=${contract.quoteId}` });
    await tx.insert(emailOutbox).values({ eventKey: `contract:${contract.id}:withdrawal:team`, recipient: destinatarioInterno(), subject: "Recesso esercitato dal cliente · Proemios", html: await protectMailHtml(impaginaEmail("Recesso esercitato", `<p>${esc(detail)}</p>${body.note ? `<p>Nota del cliente: ${esc(body.note)}</p>` : ""}<p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(contract.quoteId)}">Apri nello spazio del team</a></p>`)) }).onConflictDoNothing();
    await tx.insert(emailOutbox).values({ eventKey: `contract:${contract.id}:withdrawal:author`, recipient: actor.email, subject: "Richiesta di recesso ricevuta · Proemios", html: await protectMailHtml(impaginaEmail("Recesso ricevuto", `<p>Abbiamo registrato la tua richiesta di recesso del ${esc(new Date().toLocaleDateString("it-IT"))}. ${collected > 0 ? "Il rimborso dovuto arriva entro 14 giorni con lo stesso mezzo di pagamento; ti scriviamo quando parte." : "Non risultano importi da rimborsare."}</p>`)) }).onConflictDoNothing();
    return { contract: updated!, duplicate: false };
  });
  await audit(actor, "contract.withdrawal-requested", "contract", id);
  return json({ contract: contractView(result.contract), duplicate: result.duplicate });
}
/** Il team chiude la pratica di recesso (accolto, con rimborso già gestito da Finance, o non applicabile). */
export async function contractWithdrawalHandle(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, z.object({ outcome: z.enum(["accepted", "not_applicable", "partial"]), note: z.string().trim().max(2000).optional() }).strict());
  const contract = await contractFor(actor, id);
  if (!actor.staff) throw notFound();
  demand(actor, "finance.record");
  if (!contract.withdrawalRequestedAt) throw new PlatformError(409, "NO_WITHDRAWAL", "Nessuna richiesta di recesso da gestire.");
  const [updated] = await getDb().update(contracts).set({ withdrawalHandledAt: new Date(), withdrawalOutcome: body.outcome, withdrawalNote: body.note ?? contract.withdrawalNote }).where(eq(contracts.id, id)).returning();
  await audit(actor, "contract.withdrawal-handled", "contract", id, { outcome: body.outcome });
  return json({ contract: contractView(updated!) });
}
/** Dati del cliente per la scheda d'ordine: profilo di fatturazione se c'è, altrimenti solo l'email. */
export async function customerForSheet(tx: Tx, userId: string) {
  const [profile] = await tx.select().from(billingProfiles).where(eq(billingProfiles.userId, userId));
  return profile ? { name: profile.name, kind: profile.kind, taxCode: profile.taxCode, vatNumber: profile.vatNumber, street: profile.street, postcode: profile.postcode, city: profile.city, province: profile.province, country: profile.country } : null;
}

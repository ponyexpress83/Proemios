#!/usr/bin/env node
/**
 * Collaudo del CRM su un ambiente di PROVA (anteprima Vercel o server locale):
 * scenari A–F della messa in uso, con account di prova e dati sintetici.
 *
 *   node scripts/collaudo-crm.mjs avvia            A, D, F (cron) e B/C fino al pagamento
 *   node scripts/collaudo-crm.mjs dopo-pagamento   verifica B, C, E ed F (doppioni) dopo i pagamenti di prova
 *
 * Variabili:
 *   COLLAUDO_URL          indirizzo dell'ambiente (https://…vercel.app o http://localhost:…)
 *   COLLAUDO_ACCOUNTS     file JSON con gli account di prova (vedi docs/CRM_COLLAUDO.md); mai nel repository
 *   COLLAUDO_STATE        file di stato tra le due fasi (predefinito: ./collaudo-crm-stato.json)
 *   COLLAUDO_CRON_SECRET  facoltativo: per provare /api/cron e /api/cron/frequent
 *   VERCEL_PROTECTION_BYPASS  facoltativo: token di bypass della protezione dell'anteprima
 *   Solo in locale: COLLAUDO_LOCAL_DATABASE_URL e COLLAUDO_LOCAL_STRIPE_WEBHOOK_SECRET per simulare
 *   il pagamento con un evento firmato, come fa Stripe in modalità test.
 *
 * Si ferma se l'indirizzo è il sito pubblico o se i pagamenti non sono in modalità test.
 * Non invia campagne, non usa carte reali, non crea persone reali: solo gli account del file.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { URI, TOTP, Secret } from "otpauth";

const phase = process.argv[2];
if (!["avvia", "dopo-pagamento"].includes(phase ?? "")) {
  console.error("Uso: node scripts/collaudo-crm.mjs avvia | dopo-pagamento");
  process.exit(2);
}
const base = (process.env.COLLAUDO_URL ?? "").replace(/\/$/, "");
const host = (() => { try { return new URL(base).hostname; } catch { return ""; } })();
const local = host === "localhost" || host === "127.0.0.1";
if (!host || !(local || host.endsWith(".vercel.app"))) {
  console.error("COLLAUDO_URL deve essere un'anteprima *.vercel.app o un server locale: il collaudo non gira sul sito pubblico.");
  process.exit(2);
}
const accounts = JSON.parse(readFileSync(process.env.COLLAUDO_ACCOUNTS ?? "", "utf8"));
for (const k of ["owner", "sellerA", "sellerB", "operator", "clientB", "clientC"]) if (!accounts[k]?.email || !accounts[k]?.password) throw new Error(`Account «${k}» mancante nel file degli account.`);
const statePath = process.env.COLLAUDO_STATE ?? "collaudo-crm-stato.json";
const state = phase === "avvia" ? { run: new Date().toISOString().replace(/\D/g, "").slice(0, 14), ids: {} } : JSON.parse(readFileSync(statePath, "utf8"));
const results = [];
const bypass = process.env.VERCEL_PROTECTION_BYPASS ? { "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS } : {};

// ── HTTP con un barattolo di cookie per account ─────────────────────────────
const jars = {};
const jar = (name, res) => {
  const m = new Map((jars[name] ?? "").split("; ").filter(Boolean).map((v) => [v.slice(0, v.indexOf("=")), v.slice(v.indexOf("=") + 1)]));
  for (const c of res.headers.getSetCookie()) { const p = c.split(";")[0]; m.set(p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)); }
  jars[name] = [...m].map(([k, v]) => `${k}=${v}`).join("; ");
};
async function raw(name, path, method = "GET", body, extra = {}) {
  const headers = { origin: base, ...bypass, ...extra, ...(name ? { cookie: jars[name] ?? "" } : {}) };
  if (body !== undefined && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), redirect: "manual" });
  if (name) jar(name, res);
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const api = async (name, path, method, body, expected = [200, 201]) => {
  const r = await raw(name, `/api/platform/${path}`, method, body);
  if (!expected.includes(r.status)) throw new Error(`${method ?? "GET"} ${path} come ${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};
const totpCode = (secret) => (secret.startsWith("otpauth://") ? URI.parse(secret) : new TOTP({ secret: Secret.fromBase32(secret) })).generate();
/** Rispetta i limiti anti-abuso dell'accesso: pausa tra un accesso e l'altro e nuovi tentativi su 429. */
async function patient(work) {
  for (let i = 0; ; i++) {
    const r = await work();
    if (r.status !== 429 || i >= 5) return r;
    await wait(15_000 * (i + 1));
  }
}
async function login(name) {
  const a = accounts[name];
  await wait(11_000);
  const r = await patient(() => raw(name, "/api/auth/sign-in/email", "POST", { email: a.email, password: a.password }));
  if (r.status !== 200) throw new Error(`Accesso di ${name} non riuscito: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  if (r.data?.twoFactorRedirect) {
    if (!a.totp) throw new Error(`L'account ${name} chiede la verifica in due passaggi: aggiungi «totp» nel file degli account.`);
    const v = await patient(() => raw(name, "/api/auth/two-factor/verify-totp", "POST", { code: totpCode(a.totp), trustDevice: false }));
    if (v.status !== 200) throw new Error(`Verifica in due passaggi di ${name} non riuscita: ${v.status}`);
  }
  const me = await api(name, "me");
  accounts[name].id = me.user.id;
}
async function step(code, title, work) {
  try {
    const detail = await work();
    results.push({ code, title, outcome: "verificato", detail });
    console.log(`✔ ${code} ${title}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push({ code, title, outcome: "non verificato", detail: String(error.message ?? error) });
    console.log(`✘ ${code} ${title} — ${error.message ?? error}`);
  }
}
const check = (ok, message) => { if (!ok) throw new Error(message); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (s) => `collaudo-${state.run}-${s}`;
const testEmail = (s) => (local ? `${tag(s)}@example.test` : `delivered+${tag(s)}@resend.dev`);
const nextWeek = () => new Date(Date.now() + 7 * 86400_000).toISOString();

// ── Pagamento: Stripe in modalità test (anteprima) o evento firmato (solo locale) ──
async function startPayment(client, quoteId) {
  const detail = await api(client, `quotes/${quoteId}`);
  const tier = (detail.packages.find((p) => p.recommended) ?? detail.packages[0]).tier;
  if (!detail.record.acceptedAt) await api(client, `quotes/${quoteId}/accept`, "POST", { tier, version: detail.record.version, policyVersion: detail.paymentPolicy.version, termsAccepted: true, orderSheetAccepted: true });
  if (local && process.env.COLLAUDO_LOCAL_DATABASE_URL && process.env.COLLAUDO_LOCAL_STRIPE_WEBHOOK_SECRET) return localSignedPayment(client, quoteId, tier);
  const { url } = await api(client, "checkout", "POST", { quoteId, kind: "deposit" });
  return { manual: url };
}
async function localSignedPayment(client, quoteId, tier) {
  const { default: pg } = await import("pg");
  const { default: Stripe } = await import("stripe");
  const detail = await api(client, `quotes/${quoteId}`);
  const pkg = detail.packages.find((p) => p.tier === tier);
  const db = new pg.Client({ connectionString: process.env.COLLAUDO_LOCAL_DATABASE_URL }); await db.connect();
  const session = `cs_test_${randomUUID()}`;
  const { rows } = await db.query("insert into platform_payment_orders (quote_id, author_id, tier, kind, amount_cents, stripe_session_id) values ($1, $2, $3, 'deposit', $4, $5) returning id", [quoteId, accounts[client].id, tier, pkg.depositMoney.grossCents, session]);
  await db.end();
  const event = { id: `evt_test_${randomUUID()}`, object: "event", type: "checkout.session.completed", livemode: false, data: { object: { id: session, object: "checkout.session", metadata: { orderId: rows[0].id, quoteId }, client_reference_id: rows[0].id, currency: "eur", amount_total: pkg.depositMoney.grossCents, payment_status: "paid", payment_intent: `pi_test_${randomUUID()}`, payment_method_types: ["card"] } } };
  const send = async (e) => {
    const payload = JSON.stringify(e);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.COLLAUDO_LOCAL_STRIPE_WEBHOOK_SECRET });
    const res = await fetch(`${base}/api/webhooks/stripe`, { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body: payload });
    check(res.status < 300, `webhook locale: ${res.status} ${await res.text()}`);
  };
  // Stesso evento ripetuto e stesso fatto con un id nuovo: come i ritentativi di Stripe.
  await send(event); await send(event); await send({ ...event, id: `evt_test_${randomUUID()}` });
  return { simulated: true };
}

// ── Fase 1 ──────────────────────────────────────────────────────────────────
async function avvia() {
  for (const k of ["owner", "sellerA", "sellerB", "operator", "clientB", "clientC"]) await login(k);
  await step("0", "Ambiente di prova, migrazioni e pagamenti in modalità test", async () => {
    const d = await api("owner", "crm/diagnostics");
    const by = Object.fromEntries(d.items.map((i) => [i.key, i]));
    check(by.database?.state !== "error", `database: ${by.database?.detail}`);
    check(!/live/i.test(by.payments?.detail ?? ""), "Stripe è in modalità reale: collaudo interrotto.");
    check(/test/i.test(by.payments?.detail ?? ""), `pagamenti non in modalità test (${by.payments?.state}: ${by.payments?.detail})`);
    state.diagnostics = d.items.map((i) => ({ key: i.key, state: i.state }));
    return d.items.map((i) => `${i.key}=${i.state}`).join(" ");
  });
  if (results[0].outcome !== "verificato") return;
  const seller = (id) => Object.keys(accounts).find((k) => accounts[k].id === id) ?? id;

  await step("A", "Richiesta da campagna → assegnazione → notifica → attività del venditore", async () => {
    const email = testEmail("a");
    const q = await raw(null, "/api/preventivo", "POST", { input: { projectType: "romanzo", textState: "finito-revisionato", wordCount: 48000, requestedServices: ["proofreading"], singleService: "proofreading", urgency: "standard" }, contatto: { nome: "Collaudo Campagna", email, consensoPrivacy: true, consensoMarketing: false }, attribution: { utmSource: "collaudo", utmMedium: "cpc", utmCampaign: tag("a") } }, { "idempotency-key": randomUUID() });
    check(q.status === 201, `preventivo pubblico: ${q.status} ${JSON.stringify(q.data).slice(0, 200)}`);
    const { leads } = await api("owner", `leads?q=${encodeURIComponent(email)}`);
    const lead = leads.find((l) => l.email === email);
    check(lead, "richiesta non trovata nel CRM");
    const detail = await api("owner", `leads/${lead.id}`);
    const assignee = detail.ownership?.assignedTo;
    check(assignee, `nessun responsabile (stato ${detail.lead.assignmentStatus}): controlla orari e profili dei venditori di prova`);
    const who = seller(assignee);
    check(["sellerA", "sellerB"].includes(who), `assegnata a una persona fuori dal collaudo (${who})`);
    const { notifications } = await api(who, "notifications");
    check(notifications.some((n) => n.href === `/spazio?lead=${lead.id}`), "nessuna notifica al venditore");
    await api(who, `leads/${lead.id}/activities`, "POST", { kind: "email", body: "Risposta di collaudo via email", outcome: "other", nextAction: "Inviare proposta", nextActionAt: nextWeek() });
    const after = await api(who, `leads/${lead.id}`);
    check(after.activities.some((a) => a.body === "Risposta di collaudo via email"), "attività non registrata");
    state.ids.leadA = lead.id;
    return `assegnata a ${who}, scadenza ${detail.lead.slaDueAt}`;
  });

  await step("D", "Nessun venditore idoneo → coda monitorata → assegnazione successiva", async () => {
    // Si usano solo gli account di prova: se altre persone ricevono richieste, lo scenario non si esegue.
    const team = await api("owner", "crm/team");
    const receiving = team.people.filter((p) => p.active && p.assignment?.eligible).map((p) => p.id);
    const ours = [accounts.sellerA.id, accounts.sellerB.id];
    check(receiving.every((id) => ours.includes(id)), "altre persone ricevono richieste in questo ambiente: scenario D non eseguito per non toccarle");
    const away = [{ from: new Date(Date.now() - 3600_000).toISOString(), to: new Date(Date.now() + 3600_000).toISOString(), reason: "collaudo" }];
    const saved = {};
    for (const k of ["sellerA", "sellerB"]) {
      saved[k] = team.people.find((p) => p.id === accounts[k].id)?.profile?.absences ?? [];
      await api("owner", `crm/team/${accounts[k].id}/profile`, "PUT", { absences: [...saved[k], ...away] });
    }
    let lead;
    try {
      const email = testEmail("d");
      const q = await raw(null, "/api/preventivo", "POST", { input: { projectType: "romanzo", textState: "finito-revisionato", wordCount: 30000, requestedServices: ["proofreading"], singleService: "proofreading", urgency: "standard" }, contatto: { nome: "Collaudo Coda", email, consensoPrivacy: true, consensoMarketing: false } }, { "idempotency-key": randomUUID() });
      check(q.status === 201, `preventivo pubblico: ${q.status}`);
      lead = (await api("owner", `leads?q=${encodeURIComponent(email)}`)).leads.find((l) => l.email === email);
      const queued = await api("owner", `leads/${lead.id}`);
      check(!queued.ownership?.assignedTo && queued.lead.assignmentStatus === "queued", `la richiesta non è in coda (${queued.lead.assignmentStatus})`);
      const { notifications } = await api("owner", "notifications");
      check(notifications.some((n) => n.href === `/spazio?lead=${lead.id}`), "nessun avviso a chi gestisce le assegnazioni");
    } finally {
      for (const k of ["sellerA", "sellerB"]) await api("owner", `crm/team/${accounts[k].id}/profile`, "PUT", { absences: saved[k] });
    }
    const secret = process.env.COLLAUDO_CRON_SECRET;
    if (!secret) return "in coda con avviso; assegnazione successiva non provata (manca COLLAUDO_CRON_SECRET)";
    const run = await raw(null, "/api/cron/frequent", "GET", undefined, { authorization: `Bearer ${secret}` });
    check(run.status === 200, `cron frequente: ${run.status}`);
    const later = await api("owner", `leads/${lead.id}`);
    check(later.ownership?.assignedTo, "dopo il cron la richiesta è ancora senza responsabile");
    state.ids.leadD = lead.id;
    return `in coda con avviso, poi assegnata a ${seller(later.ownership.assignedTo)} dal cron frequente`;
  });

  await step("B1", "Proposta personalizzata → link → accettazione (fino al pagamento)", async () => {
    const d = await api("sellerA", "crm/deals", "POST", { contact: { name: "Collaudo Cliente B", email: accounts.clientB.email }, title: tag("b"), nextAction: "Inviare proposta", nextActionAt: nextWeek() }, [201]);
    const quote = await api("sellerA", `leads/${d.leadId}/quotes`, "POST", { input: { projectType: "romanzo", textState: "finito-revisionato", wordCount: 60000, requestedServices: ["editing", "layout"], urgency: "standard" } }, [201]);
    const quoteId = quote.quote.id;
    const link = await api("sellerA", `crm/quotes/${quoteId}/link`, "POST", { validityDays: 7 }, [201]);
    const token = link.url.split("/proposta/")[1];
    const pub = await raw(null, `/api/public/proposta/${token}`);
    check(pub.status === 200 && !JSON.stringify(pub.data).includes(accounts.clientB.email), "la pagina pubblica non risponde o espone l'email");
    const other = await raw("clientC", "/api/platform/crm/links/claim", "POST", { token });
    check(other.status === 403, `un altro cliente può collegare la proposta (${other.status})`);
    await api("clientB", "crm/links/claim", "POST", { token });
    const pay = await startPayment("clientB", quoteId);
    Object.assign(state.ids, { dealB: d.deal.id, quoteB: quoteId, payB: pay.manual ?? null });
    return pay.manual ? `paga l'acconto con la carta di prova 4242 4242 4242 4242: ${pay.manual}` : "pagamento simulato con eventi firmati ripetuti (solo locale)";
  });

  await step("C1", "Link a pacchetto standard → acquisto (fino al pagamento)", async () => {
    const catalog = await api("sellerB", "crm/catalog");
    const item = catalog.items.find((i) => i.active && i.purchasableAlone);
    check(item, "nessun pacchetto attivo acquistabile da solo nel catalogo");
    const d = await api("sellerB", "crm/deals", "POST", { contact: { name: "Collaudo Cliente C", email: accounts.clientC.email }, title: tag("c"), nextAction: "Mandare link", nextActionAt: nextWeek() }, [201]);
    const link = await api("sellerB", `crm/deals/${d.deal.id}/package-link`, "POST", { catalogKey: item.key, validityDays: 5 }, [201]);
    check(!link.url.includes("@"), "il link contiene dati personali");
    const token = link.url.split("/proposta/")[1];
    const bought = await api("clientC", "crm/links/purchase", "POST", { token }, [200, 201]);
    const pay = await startPayment("clientC", bought.quoteId);
    Object.assign(state.ids, { dealC: d.deal.id, quoteC: bought.quoteId, payC: pay.manual ?? null, packageC: item.key });
    return pay.manual ? `paga l'acconto con la carta di prova: ${pay.manual}` : `pacchetto «${item.name}», pagamento simulato (solo locale)`;
  });

  await step("F1", "Cron frequente e giornaliero ripetuti", async () => {
    const secret = process.env.COLLAUDO_CRON_SECRET;
    if (!secret) throw new Error("COLLAUDO_CRON_SECRET non impostato: cron non provato");
    const call = (p) => raw(null, p, "GET", undefined, { authorization: `Bearer ${secret}` });
    check((await raw(null, "/api/cron/frequent")).status === 403, "il cron frequente risponde senza segreto");
    const f1 = await call("/api/cron/frequent"), f2 = await call("/api/cron/frequent");
    check(f1.status === 200 && f2.status === 200, `cron frequente: ${f1.status}/${f2.status}`);
    const d1 = await call("/api/cron"), d2 = await call("/api/cron");
    check(d1.status === 200 && d2.status === 200, `cron giornaliero: ${d1.status}/${d2.status}`);
    check(d2.data?.status === "skipped" || d1.data?.status === "skipped", `il giornaliero non risulta saltato alla seconda chiamata (${JSON.stringify(d2.data).slice(0, 120)})`);
    const auto = await api("owner", "crm/automation");
    return auto.jobs.map((j) => `${j.job}: ${j.state}`).join(", ");
  });
}

// ── Fase 2 ──────────────────────────────────────────────────────────────────
async function dopoPagamento() {
  for (const k of ["owner", "sellerA", "sellerB", "operator", "clientB", "clientC"]) await login(k);
  const projectOf = async (client, quoteId) => {
    for (let i = 0; i < 12; i++) {
      const { projects } = await api(client, "projects");
      const own = projects.filter((p) => p.quoteId === quoteId);
      if (own.length) return own;
      await wait(5000);
    }
    throw new Error("nessun progetto: il pagamento di prova non risulta confermato dal webhook Stripe");
  };
  const commissionsFor = async (quoteId) => {
    const att = await api("owner", `crm/attributions/${quoteId}`);
    return att.versions.find((v) => v.current);
  };

  await step("B", "Pagamento di prova → attribuzione → un solo progetto → passaggio alla produzione", async () => {
    const projects = await projectOf("clientB", state.ids.quoteB);
    check(projects.length === 1, `${projects.length} progetti per la stessa proposta`);
    const att = await commissionsFor(state.ids.quoteB);
    check(att.path === "custom_quote" && att.creditedSellerId === accounts.sellerA.id && att.status === "final", `attribuzione inattesa: ${att.path} ${att.status}`);
    const handoff = await api("sellerA", `crm/handoffs/${projects[0].id}`);
    state.ids.projectB = projects[0].id;
    return `progetto ${projects[0].id.slice(0, 8)}, attribuzione a sellerA (${att.closing}), passaggio: ${handoff.opsStatus}`;
  });

  await step("C", "Acquisto da link → attribuzione al venditore del link", async () => {
    const projects = await projectOf("clientC", state.ids.quoteC);
    check(projects.length === 1, `${projects.length} progetti per la stessa proposta`);
    const att = await commissionsFor(state.ids.quoteC);
    check(att.path === "package_link" && att.creditedSellerId === accounts.sellerB.id, `attribuzione inattesa: ${att.path} ${att.creditedSellerId}`);
    state.ids.projectC = projects[0].id;
    return `pacchetto ${state.ids.packageC}, attribuzione a sellerB (${att.status})`;
  });

  await step("E", "Operatore: solo i materiali autorizzati; avanzamento visibile al cliente", async () => {
    check(state.ids.projectB && state.ids.projectC, "servono i progetti di B e C");
    const form = new FormData();
    form.set("kind", "manuscript");
    form.set("file", new File(["Testo sintetico di collaudo. ".repeat(40)], "collaudo.txt"));
    await api("clientB", `projects/${state.ids.projectB}/files`, "POST", form, [200, 201]);
    const { projects: before } = await api("operator", "projects");
    check(!before.some((p) => p.id === state.ids.projectB), "l'operatore vede il progetto prima dell'assegnazione");
    const phases = await api("owner", `crm/projects/${state.ids.projectB}/phases`, "POST", { phases: [{ phase: "editing", skill: "editing", title: "Editing di collaudo" }] }, [201]);
    await api("owner", `crm/tasks/${phases.taskIds[0]}/assign`, "POST", { userId: accounts.operator.id, confirm: true });
    const { projects: after } = await api("operator", "projects");
    check(after.some((p) => p.id === state.ids.projectB), "l'operatore assegnato non vede il progetto");
    check(!after.some((p) => p.id === state.ids.projectC), "l'operatore vede un progetto non suo");
    const other = await raw("operator", `/api/platform/projects/${state.ids.projectC}`);
    check([403, 404].includes(other.status), `progetto altrui leggibile dall'operatore (${other.status})`);
    await api("operator", `crm/work/task/${phases.taskIds[0]}`, "PATCH", { to: "in_progress" });
    const client = await api("clientB", `projects/${state.ids.projectB}`);
    return `il cliente vede lo stato «${client.project?.opsStatus ?? client.project?.status ?? "?"}»`;
  });

  await step("F2", "Webhook duplicati → nessun effetto doppio", async () => {
    for (const q of [state.ids.quoteB, state.ids.quoteC]) {
      const att = await api("owner", `crm/attributions/${q}`);
      check(att.versions.filter((v) => v.current).length === 1, "più attribuzioni correnti");
    }
    const { projects: b } = await api("clientB", "projects");
    check(b.filter((p) => p.quoteId === state.ids.quoteB).length === 1, "progetto duplicato");
    const { orders } = await api("owner", "finance");
    const { commissions } = await api("owner", "commissions");
    for (const q of [state.ids.quoteB, state.ids.quoteC]) {
      const paid = orders.filter((o) => o.quoteId === q && o.kind === "deposit" && o.status === "paid");
      check(paid.length === 1, `ordini di acconto pagati per la stessa proposta: ${paid.length}`);
      const own = commissions.filter((c) => c.orderId === paid[0].id);
      check(new Set(own.map((c) => c.beneficiaryId)).size === own.length, "provvigione duplicata per la stessa persona");
    }
    return local ? "eventi firmati inviati tre volte: un progetto, un'attribuzione" : "dopo aver reinviato l'evento dalla Dashboard Stripe (test): ancora un progetto e un'attribuzione";
  });
}

try {
  if (phase === "avvia") await avvia(); else await dopoPagamento();
} finally {
  const prev = existsSync(statePath) && phase !== "avvia" ? JSON.parse(readFileSync(statePath, "utf8")).results ?? [] : [];
  writeFileSync(statePath, JSON.stringify({ ...state, url: base, results: [...prev, ...results.map((r) => ({ ...r, phase, at: new Date().toISOString() }))] }, null, 2));
  console.log(`\nStato e risultati in ${statePath}. Nessun dato reale toccato: solo account e contatti di prova.`);
}

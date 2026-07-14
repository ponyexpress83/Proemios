import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { leads, manuscriptAnalyses } from "@/db/schema";
import { analisiEmailSchema } from "@/lib/validation";
import { estraiTesto, estensioneConsentita, MAX_FILE_BYTES } from "@/lib/extract";
import { analizzaManoscritto, contaParole, anthropicConfigured } from "@/lib/analysis";
import { stimaFasciaCosto } from "@/lib/pricing";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { sendEmail, emailLayout } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import type { FullReport } from "@/lib/analysisSchema";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ANALISI_GIORNO = 3;

export async function POST(req: Request) {
  // Rate limit per IP (contenimento costi API).
  const ip = clientIp(req);
  const rl = checkRateLimit(`analisi:${ip}`, MAX_ANALISI_GIORNO);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Hai raggiunto il numero massimo di analisi giornaliere. Riprova domani." },
      { status: 429 },
    );
  }

  if (!anthropicConfigured()) {
    return NextResponse.json(
      { error: "Servizio di analisi non configurato al momento." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const file = form.get("file");
  const nome = String(form.get("nome") ?? "");
  const email = String(form.get("email") ?? "");

  const gate = analisiEmailSchema.safeParse({ nome, email });
  if (!gate.success) {
    return NextResponse.json({ error: "Nome ed email sono obbligatori." }, { status: 422 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Carica un file da analizzare." }, { status: 422 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Il file supera i 15 MB." }, { status: 413 });
  }
  const ext = estensioneConsentita(file.name);
  if (!ext) {
    return NextResponse.json(
      { error: "Formato non supportato. Usa .docx, .pdf o .txt." },
      { status: 415 },
    );
  }

  // Estrazione testo.
  let testo: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    testo = await estraiTesto(buffer, ext);
  } catch (err) {
    console.error("[analisi] Estrazione testo fallita:", err);
    return NextResponse.json(
      { error: "Non siamo riusciti a leggere il file. Prova con un altro formato." },
      { status: 422 },
    );
  }

  const wordCount = contaParole(testo);
  if (wordCount < 100) {
    return NextResponse.json(
      { error: "Il testo è troppo breve per un'analisi significativa (min. 100 parole)." },
      { status: 422 },
    );
  }

  // Analisi AI.
  let report: FullReport;
  try {
    const ai = await analizzaManoscritto(testo);
    const fascia = stimaFasciaCosto(wordCount, ai.livelloIntervento);
    report = { ...ai, wordCount, fasciaCosto: { min: fascia.min, max: fascia.max } };
  } catch (err) {
    console.error("[analisi] Analisi AI fallita:", err);
    return NextResponse.json({ error: "Analisi non riuscita. Riprova tra poco." }, { status: 502 });
  }

  // Salvataggio DB.
  try {
    const db = getDb();
    const [lead] = await db
      .insert(leads)
      .values({ nome: gate.data.nome, email: gate.data.email, fonte: "analisi" })
      .returning();
    if (lead) {
      await db.insert(manuscriptAnalyses).values({
        leadId: lead.id,
        filename: file.name,
        wordCount,
        report,
      });
    }
  } catch (err) {
    // Non blocchiamo l'utente se il salvataggio fallisce: il report è già pronto.
    console.error("[analisi] Salvataggio fallito:", err);
  }

  // Email del report al cliente + notifica interna (best-effort).
  void sendReportEmails(gate.data.nome, gate.data.email, file.name, report).catch((e) =>
    console.error("[analisi] Invio email fallito:", e),
  );

  return NextResponse.json({ report });
}

async function sendReportEmails(nome: string, email: string, filename: string, report: FullReport) {
  const env = serverEnv();
  const livelloLabel: Record<string, string> = {
    correzione: "Correzione bozze",
    "editing-leggero": "Editing leggero",
    "editing-profondo": "Editing profondo",
  };

  await sendEmail({
    to: email,
    subject: "La tua analisi del manoscritto — Kalamos Studio",
    html: emailLayout(
      "La tua analisi è pronta",
      `<p>Ciao ${escapeHtml(nome)},</p>
       <p>ecco una sintesi dell'analisi automatica del tuo manoscritto
       (${report.wordCount.toLocaleString("it-IT")} parole):</p>
       <p style="background:#efe6d5;padding:12px;border-radius:8px;">${escapeHtml(report.sintesi)}</p>
       <p><strong>Livello di intervento consigliato:</strong> ${escapeHtml(livelloLabel[report.livelloIntervento] ?? report.livelloIntervento)}<br/>
       <strong>Fascia di costo indicativa:</strong> € ${report.fasciaCosto.min.toLocaleString("it-IT")} – € ${report.fasciaCosto.max.toLocaleString("it-IT")}</p>
       <p>Il report è generato automaticamente ed è una stima preliminare, verificata poi da un professionista.</p>
       <p>Vuoi un preventivo esatto? Configuralo sul nostro sito.</p>
       <p>A presto,<br/>Kalamos Studio</p>`,
    ),
  });

  await sendEmail({
    to: env.EMAIL_INTERNAL_NOTIFY,
    replyTo: email,
    subject: `Nuova analisi manoscritto: ${nome}`,
    html: emailLayout(
      "Nuova analisi manoscritto",
      `<p><strong>${escapeHtml(nome)}</strong> · ${escapeHtml(email)}</p>
       <p>File: ${escapeHtml(filename)} · ${report.wordCount.toLocaleString("it-IT")} parole</p>
       <p>Livello: ${escapeHtml(report.livelloIntervento)} · Fascia: € ${report.fasciaCosto.min}–${report.fasciaCosto.max}</p>`,
    ),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

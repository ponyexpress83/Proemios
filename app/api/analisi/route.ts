import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, manuscriptAnalyses } from "@/db/schema";
import { gateAnalisiSchema, primoErrore } from "@/lib/validation";
import { estraiTesto, estensioneDi, MAX_BYTES, EstrazioneError } from "@/lib/extract";
import { calcolaMetriche } from "@/lib/metrics";
import { analizza, aiConfigurata, AiError, type ReportCompleto } from "@/lib/ai";
import { costBandForAnalysis } from "@/lib/pricing";
import { verificaLimite, ipClient } from "@/lib/rate-limit";
import { inviaEmail, impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { env } from "@/lib/env";
import { euro, numero } from "@/lib/format";
import { ANALISI } from "@/config/copy";
import { BRAND } from "@/config/brand";
import { assoluto } from "@/lib/seo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AL_GIORNO = 3;
const PAROLE_MINIME = 100;

export async function POST(req: Request) {
  // Rate limit per IP: contiene il costo delle chiamate al modello.
  const limite = verificaLimite(`analisi:${ipClient(req)}`, MAX_AL_GIORNO);
  if (!limite.consentito) {
    return NextResponse.json({ errore: ANALISI.erroreLimite }, { status: 429 });
  }

  if (!aiConfigurata()) {
    return NextResponse.json(
      { errore: "L'analisi non è attiva in questo momento. Scrivici e la facciamo a mano." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const gate = gateAnalisiSchema.safeParse({
    nome: String(form.get("nome") ?? ""),
    email: String(form.get("email") ?? ""),
    consensoPrivacy: form.get("consensoPrivacy") === "true",
    consensoMarketing: form.get("consensoMarketing") === "true",
  });
  if (!gate.success) {
    return NextResponse.json({ errore: primoErrore(gate.error) }, { status: 422 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ errore: "Scegli un file da analizzare." }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { errore: "Il file supera i 15 MB. Prova a esportarlo senza immagini." },
      { status: 413 },
    );
  }
  const ext = estensioneDi(file.name);
  if (!ext) {
    return NextResponse.json(
      { errore: "Formato non gestito. Accettiamo .docx, .pdf e .txt." },
      { status: 415 },
    );
  }

  // ── Estrazione ────────────────────────────────────────────────────────
  let testo: string;
  try {
    testo = await estraiTesto(Buffer.from(await file.arrayBuffer()), ext);
  } catch (err) {
    const motivo = err instanceof EstrazioneError ? err.motivo : "illeggibile";
    console.error(JSON.stringify({ evt: "analisi.estrazione", motivo, file: file.name }));
    return NextResponse.json({ errore: ANALISI.erroreEstrazione }, { status: 422 });
  }

  // ── Metriche in locale ────────────────────────────────────────────────
  const metriche = calcolaMetriche(testo);
  if (metriche.parole < PAROLE_MINIME) {
    return NextResponse.json({ errore: ANALISI.erroreBreve }, { status: 422 });
  }

  // ── Giudizio del modello ──────────────────────────────────────────────
  let report: ReportCompleto;
  try {
    const giudizio = await analizza(testo);
    const fascia = costBandForAnalysis(metriche.parole, giudizio.livelloIntervento);
    report = {
      ...giudizio,
      metriche,
      fasciaCosto: fascia,
      generatoIl: new Date().toISOString(),
    };
  } catch (err) {
    const codice = err instanceof AiError ? err.codice : "api";
    console.error(JSON.stringify({ evt: "analisi.ai", codice, err: String(err) }));
    return NextResponse.json(
      {
        errore:
          codice === "timeout"
            ? "L'analisi ha impiegato troppo tempo. Riprova: di solito al secondo tentativo va."
            : "L'analisi non è riuscita. Riprova fra qualche minuto o scrivici.",
      },
      { status: 502 },
    );
  }

  // ── Salvataggio ───────────────────────────────────────────────────────
  // Del manoscritto restano solo nome file, conteggio parole e report:
  // il testo integrale non viene mai archiviato.
  try {
    const scadenza = new Date(Date.now() + env.MANUSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const [lead] = await db
      .insert(leads)
      .values({
        nome: gate.data.nome,
        email: gate.data.email,
        fonte: "analisi",
        consensoPrivacy: gate.data.consensoPrivacy,
        consensoMarketing: gate.data.consensoMarketing,
      })
      .returning();
    if (lead) {
      await db.insert(manuscriptAnalyses).values({
        leadId: lead.id,
        filename: file.name,
        wordCount: metriche.parole,
        report,
        expiresAt: scadenza,
      });
    }
  } catch (err) {
    // Il report è già pronto: non lo perdiamo per un errore di scrittura.
    console.error(JSON.stringify({ evt: "analisi.db-errore", err: String(err) }));
  }

  // ── Email ─────────────────────────────────────────────────────────────
  void inviaEmail({
    to: gate.data.email,
    subject: `La tua analisi del manoscritto — ${BRAND.name}`,
    html: impaginaEmail(
      "Abbiamo letto il tuo testo",
      `<p>Ciao ${esc(gate.data.nome)},</p>
       <p>ecco la sintesi della prima diagnosi su <em>${esc(file.name)}</em>
       (${numero(metriche.parole)} parole, circa ${numero(metriche.pagineStimate)} pagine):</p>
       <p style="background:#eae9e2;padding:14px;border-left:2px solid #22483b;">${esc(report.sintesi)}</p>
       <p><strong>Intervento consigliato:</strong> ${esc(report.livelloIntervento)}<br/>
       <strong>Fascia di costo indicativa:</strong> ${euro(report.fasciaCosto.min)} – ${euro(report.fasciaCosto.max)}<br/>
       <strong>Leggibilità (Gulpease):</strong> ${metriche.gulpease}/100</p>
       <p><a href="${assoluto("/preventivo")}?parole=${metriche.parole}" style="color:#22483b;">Calcola il preventivo esatto</a></p>
       <p style="font-size:13px;color:#6c6f67;">${BRAND.aiAnalysisNotice}</p>
       <p>A presto,<br/>${BRAND.name}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "analisi.email-cliente", err: String(e) })));

  void inviaEmail({
    to: destinatarioInterno(),
    replyTo: gate.data.email,
    subject: `Analisi manoscritto: ${gate.data.nome}`,
    html: impaginaEmail(
      "Nuova analisi manoscritto",
      `<p><strong>${esc(gate.data.nome)}</strong> · ${esc(gate.data.email)}</p>
       <p>File: ${esc(file.name)} · ${numero(metriche.parole)} parole ·
       Gulpease ${metriche.gulpease}</p>
       <p>Livello: ${esc(report.livelloIntervento)} ·
       Fascia: ${euro(report.fasciaCosto.min)}–${euro(report.fasciaCosto.max)}</p>
       <p style="font-size:13px;color:#6c6f67;">Marketing: ${gate.data.consensoMarketing ? "sì" : "no"}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "analisi.email-interna", err: String(e) })));

  return NextResponse.json({ report });
}

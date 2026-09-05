import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, quotes } from "@/db/schema";
import { preventivoSchema, primoErrore } from "@/lib/validation";
import { computeQuote } from "@/lib/pricing";
import { inviaEmail, impaginaEmail, rigaEmail, esc, destinatarioInterno } from "@/lib/email";
import { euro, numero } from "@/lib/format";
import { BRAND } from "@/config/brand";
import { assoluto } from "@/lib/seo";
import { demoAttiva, registraLead, registraPreventivo } from "@/lib/demo";
import { attributionFromRequest, scoreLead } from "@/lib/attribution";
import { proteggi } from "@/lib/sicurezza";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Limite di frequenza: un form pubblico senza limite è un modo per
  // riempire il database e la casella di posta di chiunque.
  const limite = await proteggi("preventivo", req);
  if (limite) return limite;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const esito = preventivoSchema.safeParse(corpo);
  if (!esito.success) {
    return NextResponse.json({ errore: primoErrore(esito.error) }, { status: 422 });
  }
  const { input, contatto, sito } = esito.data;

  if (sito && sito.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const preventivo = computeQuote(input);
  const consigliato = preventivo.packages.find((p) => p.recommended) ?? preventivo.packages[1];
  const attribution = attributionFromRequest(req);
  const leadScore = scoreLead({
    hasPhone: Boolean(contatto.telefono),
    wordCount: input.wordCount,
    projectType: input.projectType,
    urgency: input.urgency,
    requestedServices: input.requestedServices.length,
    noteLength: contatto.note?.length ?? 0,
  });

  if (demoAttiva()) {
    registraLead({
      nome: contatto.nome,
      email: contatto.email,
      fonte: "preventivo",
      consensoMarketing: contatto.consensoMarketing,
    });
    const finto = registraPreventivo({
      pacchetti: [...preventivo.packages],
      prezzoTotale: consigliato.total,
      acconto: consigliato.deposit,
    });
    return NextResponse.json({ quoteId: finto.id, preventivo, leadScore, demo: true });
  }

  let quoteId: string;
  try {
    const [lead] = await db
      .insert(leads)
      .values({
        nome: contatto.nome,
        email: contatto.email,
        telefono: contatto.telefono || null,
        fonte: "preventivo",
        stage: leadScore >= 75 ? "hot" : leadScore >= 45 ? "warm" : "new",
        leadScore,
        attribution,
        consensoPrivacy: contatto.consensoPrivacy,
        consensoMarketing: contatto.consensoMarketing,
        note: contatto.note || null,
      })
      .returning();
    if (!lead) throw new Error("Inserimento lead non riuscito.");

    const [quote] = await db
      .insert(quotes)
      .values({
        leadId: lead.id,
        input,
        pacchettiGenerati: preventivo.packages,
        prezzoTotale: consigliato.total,
        acconto: consigliato.deposit,
        stato: "sent",
      })
      .returning();
    if (!quote) throw new Error("Inserimento preventivo non riuscito.");
    quoteId = quote.id;
  } catch (err) {
    console.error(JSON.stringify({ evt: "preventivo.db-errore", err: String(err) }));
    return NextResponse.json(
      { errore: "Non siamo riusciti a salvare il preventivo. Riprova fra poco." },
      { status: 500 },
    );
  }

  const righe = preventivo.packages
    .map((p) =>
      rigaEmail(`${p.name}${p.recommended ? " (consigliato)" : ""}`, euro(p.total), p.recommended),
    )
    .join("");

  void inviaEmail({
    to: contatto.email,
    subject: `Il tuo preventivo — ${BRAND.name}`,
    html: impaginaEmail(
      "Tre modi di fare questo libro",
      `<p>Ciao ${esc(contatto.nome)},</p>
       <p>ecco i tre percorsi che abbiamo calcolato sul tuo progetto
       (${numero(preventivo.wordCount)} parole, circa ${numero(preventivo.estimatedPages)} pagine):</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;">${righe}</table>
       <p>Sono stime costruite sui dati che hai inserito. Il prezzo lo confermiamo dopo
       una call in cui guardiamo il testo: se serve meno lavoro di quanto previsto, scende.</p>
       <p><a href="${assoluto("/contatti")}" style="color:#5b3df5;">Prenota una call</a>
       oppure rispondi a questa email e ci sentiamo.</p>
       <p>A presto,<br/>${BRAND.name}</p>`,
    ),
  }).catch((e) =>
    console.error(JSON.stringify({ evt: "preventivo.email-cliente", err: String(e) })),
  );

  const campaign = attribution?.utmCampaign ?? attribution?.utmSource ?? "diretto/non attribuito";
  void inviaEmail({
    to: destinatarioInterno(),
    replyTo: contatto.email,
    subject: `[${leadScore}/100] Preventivo: ${contatto.nome} — ${euro(consigliato.total)}`,
    html: impaginaEmail(
      "Nuovo preventivo dal configuratore",
      `<p><strong>${esc(contatto.nome)}</strong><br/>
       ${esc(contatto.email)} · ${esc(contatto.telefono || "nessun telefono")}</p>
       <p>Progetto: ${esc(input.projectType)} · Stato: ${esc(input.textState)} ·
       ${numero(input.wordCount)} parole · ${esc(input.urgency)}</p>
       <p><strong>Lead score:</strong> ${leadScore}/100 · <strong>Campagna:</strong> ${esc(campaign)}</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;">${righe}</table>
       ${contatto.note ? `<p><strong>Note:</strong><br/>${esc(contatto.note)}</p>` : ""}
       <p style="font-size:13px;color:#5f5b72;">Preventivo ${quoteId} ·
       Marketing: ${contatto.consensoMarketing ? "sì" : "no"}</p>`,
    ),
  }).catch((e) =>
    console.error(JSON.stringify({ evt: "preventivo.email-interna", err: String(e) })),
  );

  return NextResponse.json({ quoteId, preventivo, leadScore });
}

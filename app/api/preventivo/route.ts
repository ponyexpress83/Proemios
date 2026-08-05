import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, quotes } from "@/db/schema";
import { preventivoSchema, primoErrore } from "@/lib/validation";
import { computeQuote } from "@/lib/pricing";
import { inviaEmail, impaginaEmail, rigaEmail, esc, destinatarioInterno } from "@/lib/email";
import { euro, numero } from "@/lib/format";
import { BRAND } from "@/config/brand";
import { assoluto } from "@/lib/seo";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  // Honeypot: rispondiamo ok senza salvare nulla.
  if (sito && sito.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Ricalcolo autoritativo lato server: il client non può alterare i prezzi.
  const preventivo = computeQuote(input);
  const consigliato = preventivo.packages.find((p) => p.recommended) ?? preventivo.packages[1];

  let quoteId: string;
  try {
    const [lead] = await db
      .insert(leads)
      .values({
        nome: contatto.nome,
        email: contatto.email,
        telefono: contatto.telefono || null,
        fonte: "preventivo",
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

  // Email al cliente e notifica interna: best-effort, non bloccano la risposta.
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
       <p><a href="${assoluto("/preventivo")}" style="color:#22483b;">Rivedi il preventivo sul sito</a>
       oppure rispondi a questa email e ci sentiamo.</p>
       <p>A presto,<br/>${BRAND.name}</p>`,
    ),
  }).catch((e) =>
    console.error(JSON.stringify({ evt: "preventivo.email-cliente", err: String(e) })),
  );

  void inviaEmail({
    to: destinatarioInterno(),
    replyTo: contatto.email,
    subject: `Preventivo: ${contatto.nome} — ${euro(consigliato.total)}`,
    html: impaginaEmail(
      "Nuovo preventivo dal configuratore",
      `<p><strong>${esc(contatto.nome)}</strong><br/>
       ${esc(contatto.email)} · ${esc(contatto.telefono || "nessun telefono")}</p>
       <p>Progetto: ${esc(input.projectType)} · Stato: ${esc(input.textState)} ·
       ${numero(input.wordCount)} parole · ${esc(input.urgency)}</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;">${righe}</table>
       ${contatto.note ? `<p><strong>Note:</strong><br/>${esc(contatto.note)}</p>` : ""}
       <p style="font-size:13px;color:#6c6f67;">Preventivo ${quoteId} ·
       Marketing: ${contatto.consensoMarketing ? "sì" : "no"}</p>`,
    ),
  }).catch((e) =>
    console.error(JSON.stringify({ evt: "preventivo.email-interna", err: String(e) })),
  );

  return NextResponse.json({ quoteId, preventivo });
}

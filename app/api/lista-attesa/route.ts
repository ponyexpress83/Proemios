import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { waitlistSchema, primoErrore } from "@/lib/validation";
import { inviaEmail, impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { BRAND } from "@/config/brand";

export const runtime = "nodejs";

/**
 * Lista d'attesa degli Strumenti AI.
 * In Fase 1 non c'è alcun addebito: si raccoglie l'interesse per validare la
 * domanda prima di attivare Stripe subscription (config/plans.ts).
 */
export async function POST(req: Request) {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const esito = waitlistSchema.safeParse(corpo);
  if (!esito.success) {
    return NextResponse.json({ errore: primoErrore(esito.error) }, { status: 422 });
  }
  const d = esito.data;

  if (d.sito && d.sito.length > 0) return NextResponse.json({ ok: true });

  try {
    await db.insert(leads).values({
      nome: d.email.split("@")[0] ?? "Iscritto",
      email: d.email,
      fonte: "contatto",
      consensoPrivacy: d.consensoPrivacy,
      consensoMarketing: true,
      note: `Lista d'attesa Strumenti AI · piano ${d.piano} · ${d.periodo}`,
    });
  } catch (err) {
    console.error(JSON.stringify({ evt: "lista-attesa.db-errore", err: String(err) }));
    return NextResponse.json(
      { errore: "Non siamo riusciti a registrare l'iscrizione. Riprova fra poco." },
      { status: 500 },
    );
  }

  void inviaEmail({
    to: d.email,
    subject: `Sei in lista per gli Strumenti AI — ${BRAND.name}`,
    html: impaginaEmail(
      "Ti avvisiamo all'apertura",
      `<p>Ci sei.</p>
       <p>Hai segnalato interesse per il piano <strong>${esc(d.piano)}</strong>
       (${esc(d.periodo === "annual" ? "annuale" : "mensile")}). Ti scriviamo appena apriamo,
       e chi è in lista mantiene le condizioni di lancio.</p>
       <p>Intanto l'analisi del manoscritto e il configuratore restano gratuiti e senza registrazione.</p>
       <p>A presto,<br/>${BRAND.name}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "lista-attesa.email", err: String(e) })));

  void inviaEmail({
    to: destinatarioInterno(),
    subject: `Lista d'attesa: ${d.piano} (${d.periodo})`,
    html: impaginaEmail(
      "Nuova iscrizione alla lista d'attesa",
      `<p>${esc(d.email)} · piano <strong>${esc(d.piano)}</strong> · ${esc(d.periodo)}</p>`,
    ),
  }).catch((e) =>
    console.error(JSON.stringify({ evt: "lista-attesa.email-interna", err: String(e) })),
  );

  return NextResponse.json({ ok: true });
}

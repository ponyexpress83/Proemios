import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { contattoSchema, primoErrore } from "@/lib/validation";
import { inviaEmail, impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { BRAND } from "@/config/brand";
import { demoAttiva, registraLead } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const esito = contattoSchema.safeParse(corpo);
  if (!esito.success) {
    return NextResponse.json({ errore: primoErrore(esito.error) }, { status: 422 });
  }
  const d = esito.data;

  // Honeypot.
  if (d.sito && d.sito.length > 0) return NextResponse.json({ ok: true });

  if (demoAttiva()) {
    registraLead({
      nome: d.nome,
      email: d.email,
      fonte: "contatto",
      consensoMarketing: d.consensoMarketing,
    });
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    await db.insert(leads).values({
      nome: d.nome,
      email: d.email,
      telefono: d.telefono || null,
      fonte: "contatto",
      consensoPrivacy: d.consensoPrivacy,
      consensoMarketing: d.consensoMarketing,
      note: d.messaggio,
    });
  } catch (err) {
    console.error(JSON.stringify({ evt: "contatto.db-errore", err: String(err) }));
    return NextResponse.json(
      { errore: "Non siamo riusciti a registrare il messaggio. Scrivici direttamente via email." },
      { status: 500 },
    );
  }

  void inviaEmail({
    to: d.email,
    subject: `Abbiamo ricevuto il tuo messaggio — ${BRAND.name}`,
    html: impaginaEmail(
      "Messaggio ricevuto",
      `<p>Ciao ${esc(d.nome)},</p>
       <p>ti rispondiamo entro un giorno lavorativo. Se nel frattempo vuoi già dei numeri,
       il configuratore di preventivo è sempre aperto.</p>
       <p>A presto,<br/>${BRAND.name}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "contatto.email-cliente", err: String(e) })));

  void inviaEmail({
    to: destinatarioInterno(),
    replyTo: d.email,
    subject: `Contatto: ${d.nome}`,
    html: impaginaEmail(
      "Nuovo messaggio dal sito",
      `<p><strong>${esc(d.nome)}</strong><br/>
       ${esc(d.email)} · ${esc(d.telefono || "nessun telefono")}</p>
       <p>${esc(d.messaggio).replace(/\n/g, "<br/>")}</p>
       <p style="font-size:13px;color:#6c6f67;">Marketing: ${d.consensoMarketing ? "sì" : "no"}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "contatto.email-interna", err: String(e) })));

  return NextResponse.json({ ok: true });
}

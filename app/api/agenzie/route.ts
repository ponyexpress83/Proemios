import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, agencyLeads } from "@/db/schema";
import { agenziaSchema, primoErrore } from "@/lib/validation";
import { inviaEmail, impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { BRAND } from "@/config/brand";
import { demoAttiva, registraAgenzia, registraLead } from "@/lib/demo";
import { proteggi } from "@/lib/sicurezza";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Limite di frequenza: un form pubblico senza limite è un modo per
  // riempire il database e la casella di posta di chiunque.
  const limite = await proteggi("agenzie", req);
  if (limite) return limite;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const esito = agenziaSchema.safeParse(corpo);
  if (!esito.success) {
    return NextResponse.json({ errore: primoErrore(esito.error) }, { status: 422 });
  }
  const d = esito.data;

  if (d.website && d.website.length > 0) return NextResponse.json({ ok: true });

  if (demoAttiva()) {
    registraLead({
      nome: d.referente,
      email: d.email,
      fonte: "agenzie",
      consensoMarketing: false,
    });
    registraAgenzia({
      nomeAgenzia: d.nomeAgenzia,
      sito: d.sito || null,
      serviziEsternalizzati: d.serviziEsternalizzati || null,
      volumeStimato: d.volumeStimato || null,
    });
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    const [lead] = await db
      .insert(leads)
      .values({
        nome: d.referente,
        email: d.email,
        telefono: d.telefono || null,
        fonte: "agenzie",
        consensoPrivacy: d.consensoPrivacy,
        consensoMarketing: false,
        note: `Agenzia: ${d.nomeAgenzia}`,
      })
      .returning();
    if (!lead) throw new Error("Inserimento lead non riuscito.");

    await db.insert(agencyLeads).values({
      leadId: lead.id,
      nomeAgenzia: d.nomeAgenzia,
      sito: d.sito || null,
      serviziEsternalizzati: d.serviziEsternalizzati || null,
      volumeStimato: d.volumeStimato || null,
    });
  } catch (err) {
    console.error(JSON.stringify({ evt: "agenzie.db-errore", err: String(err) }));
    return NextResponse.json(
      { errore: "Non siamo riusciti a registrare la richiesta. Scrivici direttamente via email." },
      { status: 500 },
    );
  }

  void inviaEmail({
    to: d.email,
    subject: `Richiesta partner ricevuta — ${BRAND.name}`,
    html: impaginaEmail(
      "Richiesta ricevuta",
      `<p>Buongiorno ${esc(d.referente)},</p>
       <p>abbiamo ricevuto la richiesta per <strong>${esc(d.nomeAgenzia)}</strong>.
       Entro un giorno lavorativo vi mandiamo l'NDA da firmare e il listino riservato
       con le condizioni per il volume che avete indicato.</p>
       <p>A presto,<br/>${BRAND.name}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "agenzie.email-cliente", err: String(e) })));

  void inviaEmail({
    to: destinatarioInterno(),
    replyTo: d.email,
    subject: `Partner white label: ${d.nomeAgenzia}`,
    html: impaginaEmail(
      "Nuova richiesta partner",
      `<p><strong>${esc(d.nomeAgenzia)}</strong><br/>
       Referente: ${esc(d.referente)} · ${esc(d.email)} · ${esc(d.telefono || "—")}<br/>
       Sito: ${esc(d.sito || "—")}</p>
       <p><strong>Esternalizzano:</strong> ${esc(d.serviziEsternalizzati || "—")}</p>
       <p><strong>Volume stimato:</strong> ${esc(d.volumeStimato || "—")}</p>`,
    ),
  }).catch((e) => console.error(JSON.stringify({ evt: "agenzie.email-interna", err: String(e) })));

  return NextResponse.json({ ok: true });
}

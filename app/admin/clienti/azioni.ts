"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { creaClienteEsistente } from "@/lib/dati/onboarding";
import { leggiCliente } from "@/lib/dati/clienti";
import { creaInvito } from "@/lib/dati/utenti";
import { inviaEmail, impaginaEmail, esc } from "@/lib/email";
import { ambienteLive, publicEnv } from "@/lib/env";

export type EsitoAccesso = { ok: true; messaggio: string } | { ok: false; messaggio: string };

export type EsitoCliente =
  | { ok: true; messaggio: string; clienteId: string }
  | { ok: false; messaggio: string; clienteId?: undefined };

const vuotaANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opzionale = z.preprocess(vuotaANull, z.string().max(500).optional());

const schema = z.object({
  tipo: z.enum(["privato", "azienda"]),
  nome: z.string().trim().min(1).max(200),
  cognome: opzionale,
  ragioneSociale: z.preprocess(vuotaANull, z.string().max(300).optional()),
  email: z.string().trim().email().max(320),
  telefono: z.preprocess(vuotaANull, z.string().max(40).optional()),
  partitaIva: z.preprocess(vuotaANull, z.string().max(30).optional()),
  codiceFiscale: z.preprocess(vuotaANull, z.string().max(30).optional()),
  pec: z.preprocess(vuotaANull, z.string().email().max(320).optional()),
  codiceDestinatario: z.preprocess(vuotaANull, z.string().max(20).optional()),
  alias: z.preprocess(vuotaANull, z.string().max(80).optional()),
  noteCommerciali: z.preprocess(vuotaANull, z.string().max(5000).optional()),
});

export async function creaClienteAttuale(
  _precedente: EsitoCliente | null,
  formData: FormData,
): Promise<EsitoCliente> {
  const analisi = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!analisi.success) {
    return { ok: false, messaggio: "Controlla i dati inseriti: alcuni campi non sono validi." };
  }

  try {
    const attore = await esigiAttore();
    const cliente = await creaClienteEsistente(attore, analisi.data);
    revalidatePath("/admin/clienti");
    return { ok: true, messaggio: "Cliente inserito. Ora puoi creare il suo progetto.", clienteId: cliente.id };
  } catch (errore) {
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Creazione cliente non riuscita.",
    };
  }
}

/**
 * Invita un cliente nella propria area.
 *
 * Inserire un'anagrafica e dare un accesso sono due cose diverse, e la
 * seconda mancava del tutto: `creaClienteEsistente` scrive solo la riga in
 * `clients`, e l'area riservata trova i progetti per `clients.userId`. Un
 * cliente inserito così poteva avere progetti, file e consegne, e non vedere
 * niente — perché non poteva nemmeno entrare.
 *
 * L'account nasce dall'invito, come per lo staff: è l'unico punto in cui si
 * assegna un ruolo. Il collegamento con l'anagrafica avviene all'accettazione
 * (vedi `accettaInvito`).
 */
export async function invitaClienteAllArea(clienteId: string): Promise<EsitoAccesso> {
  if (!z.string().uuid().safeParse(clienteId).success) {
    return { ok: false, messaggio: "Cliente non valido." };
  }

  try {
    const attore = await esigiAttore();
    const cliente = await leggiCliente(attore, clienteId);
    if (!("email" in cliente)) {
      return { ok: false, messaggio: "Non hai i permessi per invitare questo cliente." };
    }

    const invito = await creaInvito(attore, { email: cliente.email, ruolo: "client" });
    const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    const link = `${base}/invito/${encodeURIComponent(invito.token)}`;

    const { inviata } = await inviaEmail({
      to: invito.email,
      subject: "Il tuo accesso a Proemios",
      html: impaginaEmail(
        "Segui il tuo progetto",
        `<p>Abbiamo aperto per te l'area riservata di Proemios: da lì vedi lo stato del
          lavoro, scarichi i file e approvi le consegne.</p>
         <p><a href="${esc(link)}" style="display:inline-block;background:#5b3df5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-weight:600;">Attiva l'accesso</a></p>
         <p>Il link scade tra 7 giorni ed è utilizzabile una sola volta.</p>`,
      ),
    });

    revalidatePath("/admin/clienti");

    // Stessa regola dell'invito allo staff: il token vive solo dentro
    // quell'email, quindi non si dichiara inviato ciò che non è partito.
    if (!inviata) {
      return ambienteLive()
        ? {
            ok: false,
            messaggio:
              `Invito creato per ${invito.email}, ma l'email non è partita: ` +
              "RESEND_API_KEY non è configurata.",
          }
        : {
            ok: true,
            messaggio:
              `Invito creato. La posta non è configurata, quindi consegna tu questo link ` +
              `(scade fra 7 giorni, vale una volta sola): ${link}`,
          };
    }

    return { ok: true, messaggio: `Invito inviato a ${invito.email}.` };
  } catch (errore) {
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Invito non riuscito.",
    };
  }
}

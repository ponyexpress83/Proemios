"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { creaInvito } from "@/lib/dati/utenti";
import { RUOLI_STAFF, type Ruolo } from "@/lib/auth/ruoli";
import { inviaEmail, impaginaEmail, esc } from "@/lib/email";
import { ambienteLive, publicEnv } from "@/lib/env";

export type EsitoInvito = { ok: true; messaggio: string } | { ok: false; messaggio: string };

const schema = z.object({
  email: z.string().email().max(320),
  ruolo: z.enum(["operations_admin", "editorial_manager", "editor_reviewer", "finance"]),
});

export async function invitaStaff(
  _precedente: EsitoInvito | null,
  formData: FormData,
): Promise<EsitoInvito> {
  const analisi = schema.safeParse({
    email: formData.get("email"),
    ruolo: formData.get("ruolo"),
  });
  if (!analisi.success) return { ok: false, messaggio: "Controlla email e ruolo." };

  try {
    const attore = await esigiAttore();
    if (!RUOLI_STAFF.includes(analisi.data.ruolo as Ruolo)) {
      return { ok: false, messaggio: "Ruolo non valido per lo staff." };
    }

    const invito = await creaInvito(attore, analisi.data);
    const link = `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/invito/${encodeURIComponent(invito.token)}`;
    const { inviata } = await inviaEmail({
      to: invito.email,
      subject: "Invito a Proemios",
      html: impaginaEmail(
        "Sei stato invitato su Proemios",
        `<p>È stato creato per te un accesso al back-office di Proemios.</p>
         <p><a href="${esc(link)}" style="display:inline-block;background:#5b3df5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-weight:600;">Accetta l'invito</a></p>
         <p>Il link scade tra 7 giorni ed è utilizzabile una sola volta.</p>`,
      ),
    });
    revalidatePath("/admin/staff");

    /*
     * Il token dell'invito esiste solo dentro quell'email: in database c'è
     * l'hash. Se l'invio non è partito, dire "inviato" lascerebbe la persona
     * ad aspettare un messaggio che non arriverà, e l'invito andrebbe
     * revocato e rifatto senza che nessuno capisca perché.
     *
     * Fuori dalla produzione si restituisce il link, così l'invito si può
     * comunque consegnare a mano. In produzione no: finirebbe in un log o in
     * uno screenshot, e chi lo intercetta entra con quel ruolo.
     */
    if (!inviata) {
      return ambienteLive()
        ? {
            ok: false,
            messaggio:
              `Invito creato per ${invito.email}, ma l'email non è partita: ` +
              "RESEND_API_KEY non è configurata. Revoca l'invito e rifallo quando la posta funziona.",
          }
        : {
            ok: true,
            messaggio:
              `Invito creato per ${invito.email}. La posta non è configurata, ` +
              `quindi consegna tu questo link (scade fra 7 giorni, vale una volta sola): ${link}`,
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

/**
 * DTO di lead. Materiale interamente commerciale: nessuna forma esiste per il
 * redattore né per il cliente. `leadDTO` lancia se l'attore non ha il permesso,
 * invece di restituire una versione ridotta: un lead ridotto non serve a
 * nessuno, e restituirlo maschererebbe un errore di autorizzazione a monte.
 */
import type { Lead } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { NonAutorizzato } from "@/lib/auth/errori";
import { iso, sigilla } from "./comuni";

export type LeadPerStaff = {
  id: string;
  nome: string;
  email: string;
  telefono: string | null;
  fonte: string;
  stato: string;
  leadScore: number | null;
  valoreStimato: number | null;
  ownerId: string | null;
  clientId: string | null;
  organizationId: string | null;
  consensoPrivacy: boolean;
  consensoMarketing: boolean;
  note: string | null;
  ultimaAttivitaAt: string | null;
  prossimaAttivitaAt: string | null;
  prossimaAttivita: string | null;
  callPrenotataAt: string | null;
  persoMotivo: string | null;
  createdAt: string | null;
};

/** L'attribuzione di campagna è un DTO a parte: ha il proprio permesso. */
export type AttribuzioneLead = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  fbclid: string | null;
  landingPath: string | null;
  referrer: string | null;
  primoContattoAt: string | null;
};

export function leadDTO(attore: Attore, lead: Lead): LeadPerStaff {
  if (!haPermesso(attore, "crm.vedi_lead")) {
    throw new NonAutorizzato(`crm.vedi_lead mancante per ruolo ${attore.ruolo}`);
  }
  return sigilla({
    id: lead.id,
    nome: lead.nome,
    email: lead.email,
    telefono: lead.telefono,
    fonte: lead.fonte,
    stato: lead.stato,
    leadScore: lead.leadScore,
    valoreStimato: lead.valoreStimato,
    ownerId: lead.ownerId,
    clientId: lead.clientId,
    organizationId: lead.organizationId,
    consensoPrivacy: lead.consensoPrivacy,
    consensoMarketing: lead.consensoMarketing,
    note: lead.note,
    ultimaAttivitaAt: iso(lead.ultimaAttivitaAt),
    prossimaAttivitaAt: iso(lead.prossimaAttivitaAt),
    prossimaAttivita: lead.prossimaAttivita,
    callPrenotataAt: iso(lead.callPrenotataAt),
    persoMotivo: lead.persoMotivo,
    createdAt: iso(lead.createdAt),
  });
}

export function attribuzioneDTO(attore: Attore, lead: Lead): AttribuzioneLead {
  if (!haPermesso(attore, "crm.vedi_attribuzione")) {
    throw new NonAutorizzato(`crm.vedi_attribuzione mancante per ruolo ${attore.ruolo}`);
  }
  const a = lead.attribution ?? {};
  return sigilla({
    utmSource: a.utmSource ?? null,
    utmMedium: a.utmMedium ?? null,
    utmCampaign: a.utmCampaign ?? null,
    utmTerm: a.utmTerm ?? null,
    utmContent: a.utmContent ?? null,
    gclid: a.gclid ?? null,
    fbclid: a.fbclid ?? null,
    landingPath: a.landingPath ?? null,
    referrer: a.referrer ?? null,
    primoContattoAt: a.firstSeenAt ?? null,
  });
}

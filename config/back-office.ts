import type { Permesso } from "@/lib/auth/ruoli";

/**
 * Navigazione del back-office. Ogni voce dichiara il permesso che la rende
 * visibile: la barra si costruisce da qui, così una sezione nuova non può
 * comparire a un ruolo per dimenticanza.
 *
 * Nascondere una voce non è sicurezza — la pagina verifica comunque il permesso
 * lato server — è coerenza: mostrare un link che porta a un rifiuto è un modo
 * per far perdere tempo alle persone.
 */
export type VoceBackOffice = {
  href: string;
  titolo: string;
  permesso: Permesso;
  /** Sezione della barra laterale. */
  gruppo: "lavoro" | "commerciale" | "amministrazione" | "piattaforma";
};

export const NAV_BACK_OFFICE: VoceBackOffice[] = [
  { href: "/admin", titolo: "Cruscotto", permesso: "progetto.vedi_assegnati", gruppo: "lavoro" },
  { href: "/admin/progetti", titolo: "Progetti", permesso: "progetto.vedi_assegnati", gruppo: "lavoro" },
  { href: "/admin/approvazioni", titolo: "Approvazioni", permesso: "progetto.vedi_assegnati", gruppo: "lavoro" },

  { href: "/admin/crm", titolo: "CRM", permesso: "crm.vedi_lead", gruppo: "commerciale" },
  { href: "/admin/clienti", titolo: "Clienti", permesso: "cliente.vedi_identita", gruppo: "commerciale" },

  { href: "/admin/pagamenti", titolo: "Pagamenti", permesso: "pagamento.vedi", gruppo: "amministrazione" },

  { href: "/admin/staff", titolo: "Staff", permesso: "staff.vedi", gruppo: "piattaforma" },
  { href: "/admin/audit", titolo: "Audit", permesso: "audit.vedi", gruppo: "piattaforma" },
];

export const ETICHETTE_GRUPPO: Record<VoceBackOffice["gruppo"], string> = {
  lavoro: "Lavoro",
  commerciale: "Commerciale",
  amministrazione: "Amministrazione",
  piattaforma: "Piattaforma",
};

/** Stati di progetto, con etichetta e tono per i badge. */
export const STATO_PROGETTO: Record<
  string,
  { etichetta: string; tono: "neutro" | "viola" | "lime" | "successo" | "attenzione" | "errore" }
> = {
  avvio: { etichetta: "Avvio", tono: "neutro" },
  in_corso: { etichetta: "In corso", tono: "viola" },
  in_attesa_cliente: { etichetta: "Attende il cliente", tono: "attenzione" },
  in_revisione: { etichetta: "In revisione", tono: "viola" },
  in_consegna: { etichetta: "In consegna", tono: "lime" },
  concluso: { etichetta: "Concluso", tono: "successo" },
  sospeso: { etichetta: "Sospeso", tono: "attenzione" },
  annullato: { etichetta: "Annullato", tono: "errore" },
};

export const STATO_TAPPA: Record<string, "completata" | "corrente" | "attesa" | "bloccata"> = {
  completata: "completata",
  in_corso: "corrente",
  attesa: "attesa",
  bloccata: "bloccata",
  saltata: "attesa",
};

export const TIPO_APPROVAZIONE: Record<string, string> = {
  milestone_cliente: "Approvazione del cliente",
  editoriale: "Approvazione editoriale",
  operativa: "Approvazione alla consegna",
  variazione: "Variazione da accettare",
};

import { z } from "zod";

/** Servizi selezionabili nel configuratore (deve combaciare con config/pricing Servizio). */
export const servizioSchema = z.enum([
  "editing",
  "correzioneBozze",
  "impaginazioneCartacea",
  "epub",
  "copertina",
  "pubblicazioneKdp",
  "isbnEsterno",
  "schedaAmazon",
]);

export const projectTypeSchema = z.enum([
  "romanzo",
  "saggio",
  "memoir",
  "professionale",
  "grafica",
]);

export const textStateSchema = z.enum([
  "scritto-revisionato",
  "scritto-da-revisionare",
  "bozza-incompleta",
  "solo-materiali",
]);

/** Contatto generico / form agenzie. */
export const contattoSchema = z.object({
  nome: z.string().min(2, "Inserisci il tuo nome").max(120),
  email: z.string().email("Email non valida"),
  telefono: z.string().max(40).optional().or(z.literal("")),
  messaggio: z.string().min(10, "Scrivi qualche riga in più").max(4000),
  fonte: z.enum(["contatto", "agenzie"]).default("contatto"),
  // Honeypot anti-spam: deve restare vuoto.
  website: z.string().max(0).optional(),
});
export type ContattoInput = z.infer<typeof contattoSchema>;

/** Input del configuratore di preventivo. */
export const preventivoInputSchema = z.object({
  projectType: projectTypeSchema,
  statoTesto: textStateSchema,
  parole: z.coerce.number().int().min(0).max(2_000_000).default(0),
  pagineStimate: z.coerce.number().int().min(0).max(5000).optional(),
  servizi: z.array(servizioSchema).default([]),
  tempistica: z.enum(["standard", "prioritaria"]).default("standard"),
});
export type PreventivoInput = z.infer<typeof preventivoInputSchema>;

/** Payload completo del salvataggio preventivo (input + contatto). */
export const preventivoSubmitSchema = z.object({
  input: preventivoInputSchema,
  contatto: z.object({
    nome: z.string().min(2).max(120),
    email: z.string().email(),
    telefono: z.string().max(40).optional().or(z.literal("")),
    note: z.string().max(2000).optional().or(z.literal("")),
  }),
});
export type PreventivoSubmit = z.infer<typeof preventivoSubmitSchema>;

/** Creazione sessione di checkout per l'acconto. */
export const checkoutSchema = z.object({
  quoteId: z.string().uuid(),
  pacchetto: z.enum(["essenziale", "consigliato", "signature"]),
});

/** Email gate dell'analisi manoscritto. */
export const analisiEmailSchema = z.object({
  nome: z.string().min(2, "Inserisci il tuo nome").max(120),
  email: z.string().email("Email non valida"),
});

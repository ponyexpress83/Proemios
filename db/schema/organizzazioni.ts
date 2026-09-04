import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  timestamp,
} from "drizzle-orm/pg-core";
import { tempi, tipoOrganizzazioneEnum } from "./comuni";

/**
 * Il tenant. Proemios stesso è un'organizzazione di tipo `studio`; ogni agenzia
 * white label è un'organizzazione di tipo `agenzia`.
 *
 * L'isolamento fra tenant è applicato nel livello dati (`lib/dati/`), che esige
 * sempre un attore e filtra per `organizationId`. Non è affidato alle viste:
 * nascondere una riga nell'interfaccia non è isolamento.
 *
 * Nota sul modello: il brief elencava `agency_accounts` e `agency_clients` come
 * tabelle a sé. Sono rappresentate qui da `organizations.tipo = 'agenzia'` e da
 * `clients.organization_id`: una tabella ponte fra agenzia e cliente sarebbe
 * ridondante rispetto alla colonna di tenant, e due fonti di verità sulla
 * proprietà di un cliente sono un modo sicuro per farle divergere.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    nome: varchar("nome", { length: 200 }).notNull(),
    tipo: tipoOrganizzazioneEnum("tipo").notNull().default("agenzia"),
    attiva: boolean("attiva").notNull().default(true),

    /** Branding del portale quando l'organizzazione è white label. */
    branding: jsonb("branding").$type<{
      logoUrl?: string;
      coloreIdentita?: string;
      nomeVisualizzato?: string;
      dominio?: string;
      emailMittente?: string;
      firmaEmail?: string;
    }>(),

    /** Se vero, il marchio Proemios non compare in nulla di ciò che l'agenzia vede o inoltra. */
    proemiosInvisibile: boolean("proemios_invisibile").notNull().default(false),

    ndaFirmatoAt: timestamp("nda_firmato_at", { withTimezone: true }),
    slaGiorniLavorazione: jsonb("sla_giorni_lavorazione").$type<Record<string, number>>(),
    noteInterne: text("note_interne"),
    ...tempi,
  },
  (t) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(t.slug),
    tipoIdx: index("organizations_tipo_idx").on(t.tipo),
  }),
);

export type Organizzazione = typeof organizations.$inferSelect;
export type NuovaOrganizzazione = typeof organizations.$inferInsert;

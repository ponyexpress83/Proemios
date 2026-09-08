import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { leads } from "./crm";
import { tempi } from "./comuni";

/**
 * Conversioni registrate lato server.
 *
 * Esistono perché gli eventi che contano davvero — un lead qualificato, una
 * proposta inviata, un incasso — succedono quando nessun browser è aperto. Un
 * pixel non può vederli, e farli scattare al ritorno del cliente su una pagina
 * di ringraziamento significherebbe misurare il ritorno alla pagina invece
 * dell'incasso: si perderebbe ogni bonifico e ogni pagamento fatto da un altro
 * dispositivo.
 *
 * La riga conserva l'attribuzione **congelata al momento della conversione**:
 * il `gclid` di un lead può essere sovrascritto da una visita successiva, e
 * un'attribuzione che cambia dopo il fatto rende le campagne illeggibili.
 *
 * `inviataAt` e `erroreInvio` tracciano la consegna alla piattaforma
 * pubblicitaria: una conversione registrata ma non inviata resta visibile e
 * ritentabile, invece di sparire.
 */
export const conversions = pgTable(
  "conversions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),

    /** Nome dell'evento: uno di EVENTI_ESITO. */
    evento: varchar("evento", { length: 60 }).notNull(),
    /** Valore in centesimi. Nullo quando l'evento non ne ha uno reale. */
    valoreCent: integer("valore_cent"),
    valuta: varchar("valuta", { length: 3 }).notNull().default("EUR"),

    /**
     * Chiave di deduplicazione: la stessa conversione registrata due volte non
     * deve contarsi due volte, né qui né presso la piattaforma.
     */
    chiaveDedup: varchar("chiave_dedup", { length: 200 }).notNull(),

    /** Attribuzione congelata: gclid, utm, landing. Mai dati personali. */
    attribuzione: jsonb("attribuzione").$type<Record<string, string>>(),

    avvenutaAt: timestamp("avvenuta_at", { withTimezone: true }).notNull().defaultNow(),
    inviataAt: timestamp("inviata_at", { withTimezone: true }),
    erroreInvio: varchar("errore_invio", { length: 300 }),
    tentativi: integer("tentativi").notNull().default(0),
    ...tempi,
  },
  (t) => ({
    eventoIdx: index("conversions_evento_idx").on(t.evento),
    orgIdx: index("conversions_organization_idx").on(t.organizationId),
    leadIdx: index("conversions_lead_idx").on(t.leadId),
    dedupIdx: index("conversions_dedup_idx").on(t.chiaveDedup),
    avvenutaIdx: index("conversions_avvenuta_idx").on(t.avvenutaAt),
  }),
);

export type Conversione = typeof conversions.$inferSelect;
export type NuovaConversione = typeof conversions.$inferInsert;

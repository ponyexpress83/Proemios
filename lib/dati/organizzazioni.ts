/**
 * Organizzazioni: il tenant, e il suo aspetto quando è white label.
 *
 * Un'agenzia non deve poter leggere né toccare un'altra organizzazione, e
 * nemmeno sapere che esiste. Perciò le funzioni di lettura filtrano sempre
 * sull'organizzazione dell'attore, e l'elenco completo dei tenant esiste solo
 * per lo studio — l'organizzazione di tipo `studio`, che è Proemios.
 *
 * Il super_admin di un'agenzia è super_admin **della sua agenzia**: il ruolo
 * non attraversa il tenant, e un test lo verifica.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations } from "@/db/schema/organizzazioni";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { iso, sigilla } from "@/lib/dto/comuni";
import { brandingValido, type Branding } from "@/lib/branding";

export type OrganizzazioneDTO = {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
  attiva: boolean;
  branding: Branding | null;
  proemiosInvisibile: boolean;
  createdAt: string;
};

/** In più, ciò che riguarda l'accordo commerciale con l'agenzia. */
export type OrganizzazionePerStudio = OrganizzazioneDTO & {
  ndaFirmatoAt: string | null;
  slaGiorniLavorazione: Record<string, number> | null;
  noteInterne: string | null;
};

function organizzazioneDTO(o: typeof organizations.$inferSelect): OrganizzazioneDTO {
  return sigilla({
    id: o.id,
    slug: o.slug,
    nome: o.nome,
    tipo: o.tipo,
    attiva: o.attiva,
    branding: (o.branding ?? null) as Branding | null,
    proemiosInvisibile: o.proemiosInvisibile,
    createdAt: iso(o.createdAt)!,
  });
}

function organizzazionePerStudio(o: typeof organizations.$inferSelect): OrganizzazionePerStudio {
  return sigilla({
    ...organizzazioneDTO(o),
    ndaFirmatoAt: iso(o.ndaFirmatoAt),
    slaGiorniLavorazione: o.slaGiorniLavorazione ?? null,
    // Le note su un'agenzia sono note su un partner commerciale: le legge lo
    // studio, non l'agenzia stessa.
    noteInterne: o.noteInterne,
  });
}

/** Vero se l'attore appartiene allo studio: Proemios, non un'agenzia. */
export async function isStudio(attore: Attore): Promise<boolean> {
  const db = getDb();
  const [org] = await db
    .select({ tipo: organizations.tipo })
    .from(organizations)
    .where(eq(organizations.id, attore.organizationId))
    .limit(1);
  return org?.tipo === "studio";
}

/** La propria organizzazione. Ogni attore autenticato può vedere la sua. */
export async function organizzazioneCorrente(attore: Attore): Promise<OrganizzazioneDTO> {
  const db = getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, attore.organizationId))
    .limit(1);
  if (!org) throw new NonTrovato(`organizzazione ${attore.organizationId} inesistente`);
  return organizzazioneDTO(org);
}

/**
 * Le agenzie. Solo per lo studio.
 *
 * Un'agenzia che chiamasse questa funzione riceve un rifiuto, non un elenco
 * filtrato: non esiste una versione «vedi le altre agenzie, ma meno».
 */
export async function elencaAgenzie(attore: Attore): Promise<OrganizzazionePerStudio[]> {
  esigiPermesso(attore, "organizzazione.gestisci");
  if (!(await isStudio(attore))) {
    throw new NonAutorizzato(
      `organizzazione ${attore.organizationId} non è lo studio: non elenca gli altri tenant`,
    );
  }

  const db = getDb();
  const righe = await db
    .select()
    .from(organizations)
    .where(ne(organizations.id, attore.organizationId))
    .orderBy(organizations.nome);
  return righe.map(organizzazionePerStudio);
}

/**
 * Aggiorna il branding della propria organizzazione.
 *
 * Il branding è validato prima di essere scritto: un colore che non è un colore
 * finisce in una `<style>` e diventa un vettore di iniezione, e un logo servito
 * da un dominio qualunque è un modo per far tracciare gli utenti da terzi.
 */
export async function aggiornaBranding(
  attore: Attore,
  branding: Branding,
): Promise<OrganizzazioneDTO> {
  esigiPermesso(attore, "organizzazione.gestisci");

  const esito = brandingValido(branding);
  if (!esito.ok) throw new Error(esito.motivo);

  const db = getDb();
  const [aggiornata] = await db
    .update(organizations)
    .set({ branding: esito.branding, updatedAt: new Date() })
    .where(eq(organizations.id, attore.organizationId))
    .returning();
  if (!aggiornata) throw new NonTrovato(`organizzazione ${attore.organizationId} inesistente`);

  await registra(attore, {
    azione: "configurazione.modificata",
    entita: "organizzazione",
    entitaId: attore.organizationId,
    metadati: { campo: "branding" },
  });

  return organizzazioneDTO(aggiornata);
}

/**
 * Crea un'agenzia. Solo lo studio.
 *
 * Non crea utenti: un'agenzia senza persone è un tenant vuoto, e le persone si
 * invitano con il flusso degli inviti, che manda un magic link e traccia chi ha
 * invitato chi.
 */
export async function creaAgenzia(
  attore: Attore,
  dati: { slug: string; nome: string; proemiosInvisibile?: boolean },
): Promise<OrganizzazionePerStudio> {
  esigiPermesso(attore, "organizzazione.gestisci");
  if (!(await isStudio(attore))) {
    throw new NonAutorizzato(`organizzazione ${attore.organizationId} non è lo studio`);
  }

  const slug = dati.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/.test(slug)) {
    throw new Error(
      "Lo slug ammette lettere minuscole, cifre e trattini, e non può cominciare o finire con un trattino.",
    );
  }

  const db = getDb();
  const [esistente] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (esistente) throw new Error(`Lo slug «${slug}» è già usato.`);

  const [creata] = await db
    .insert(organizations)
    .values({
      slug,
      nome: dati.nome.trim(),
      tipo: "agenzia",
      proemiosInvisibile: dati.proemiosInvisibile ?? false,
    })
    .returning();

  await registra(attore, {
    azione: "configurazione.modificata",
    entita: "organizzazione",
    entitaId: creata!.id,
    metadati: { creata: slug },
  });

  return organizzazionePerStudio(creata!);
}

/**
 * Attiva o disattiva un'agenzia. Solo lo studio, e mai su sé stesso.
 *
 * Disattivare la propria organizzazione significherebbe chiudersi fuori senza
 * possibilità di rientrare, e nessuna interfaccia deve permetterlo per errore.
 */
export async function cambiaAttivazione(
  attore: Attore,
  organizationId: string,
  attiva: boolean,
): Promise<void> {
  esigiPermesso(attore, "organizzazione.gestisci");
  if (!(await isStudio(attore))) {
    throw new NonAutorizzato(`organizzazione ${attore.organizationId} non è lo studio`);
  }
  if (organizationId === attore.organizationId) {
    throw new Error("Non si disattiva la propria organizzazione.");
  }

  const db = getDb();
  const [aggiornata] = await db
    .update(organizations)
    .set({ attiva, updatedAt: new Date() })
    .where(and(eq(organizations.id, organizationId), eq(organizations.tipo, "agenzia")))
    .returning({ id: organizations.id });
  if (!aggiornata) throw new NonTrovato(`agenzia ${organizationId} inesistente`);

  await registra(attore, {
    azione: "configurazione.modificata",
    entita: "organizzazione",
    entitaId: organizationId,
    metadati: { attiva },
  });
}

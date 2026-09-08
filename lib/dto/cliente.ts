/**
 * DTO dell'anagrafica cliente.
 *
 * Tre forme, non una filtrata: chi può vedere l'identità la vede, chi può
 * vedere la fatturazione vede anche quella, e chi lavora sul testo riceve un
 * oggetto che *non ha proprio* i campi anagrafici.
 */
import type { Cliente } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { iso, sigilla } from "./comuni";

/** Ciò che vede chi lavora sul testo: un riferimento, non una persona. */
export type ClienteAnonimo = {
  id: string;
  /** Alias esplicito, oppure un riferimento derivato dall'id. Mai il nome vero. */
  riferimento: string;
};

/** Identità, senza dati fiscali. */
export type ClienteIdentita = ClienteAnonimo & {
  tipo: string;
  nome: string;
  cognome: string | null;
  ragioneSociale: string | null;
  email: string;
  telefono: string | null;
  createdAt: string | null;
};

/** Identità più anagrafica fiscale. Solo finance, operations, super_admin. */
export type ClienteCompleto = ClienteIdentita & {
  indirizzo: Cliente["indirizzo"];
  partitaIva: string | null;
  codiceFiscale: string | null;
  codiceDestinatario: string | null;
  pec: string | null;
};

export type ClienteDTO = ClienteAnonimo | ClienteIdentita | ClienteCompleto;

/**
 * Riferimento anonimo stabile. Non è un hash crittografico: serve a dare al
 * redattore un'etichetta con cui parlare del progetto, non a proteggere l'id,
 * che il redattore comunque non riceve.
 */
function riferimentoDi(cliente: Pick<Cliente, "id" | "alias">): string {
  return cliente.alias ?? `Cliente ${cliente.id.slice(0, 8).toUpperCase()}`;
}

export function clienteAnonimo(cliente: Cliente): ClienteAnonimo {
  return sigilla({ id: cliente.id, riferimento: riferimentoDi(cliente) });
}

export function clienteIdentita(cliente: Cliente): ClienteIdentita {
  return sigilla({
    id: cliente.id,
    riferimento: riferimentoDi(cliente),
    tipo: cliente.tipo,
    nome: cliente.nome,
    cognome: cliente.cognome,
    ragioneSociale: cliente.ragioneSociale,
    email: cliente.email,
    telefono: cliente.telefono,
    createdAt: iso(cliente.createdAt),
  });
}

export function clienteCompleto(cliente: Cliente): ClienteCompleto {
  return sigilla({
    ...clienteIdentita(cliente),
    indirizzo: cliente.indirizzo,
    partitaIva: cliente.partitaIva,
    codiceFiscale: cliente.codiceFiscale,
    codiceDestinatario: cliente.codiceDestinatario,
    pec: cliente.pec,
  });
}

/**
 * Mapper unico. Decide la forma dal ruolo dell'attore: il chiamante non deve
 * ricordarsi quale DTO usare, e non può sbagliare scegliendone uno troppo largo.
 *
 * `noteCommerciali` non compare in nessuna forma: è materiale che serve solo
 * alla scheda CRM, e lì viene letto a parte con il suo permesso.
 */
export function clienteDTO(attore: Attore, cliente: Cliente): ClienteDTO {
  if (haPermesso(attore, "cliente.vedi_dati_fatturazione")) return clienteCompleto(cliente);
  if (haPermesso(attore, "cliente.vedi_identita")) return clienteIdentita(cliente);
  return clienteAnonimo(cliente);
}

/** Type guard utile alle viste: `"email" in dto` non restringe abbastanza. */
export function haIdentita(dto: ClienteDTO): dto is ClienteIdentita {
  return "email" in dto;
}

export function haDatiFatturazione(dto: ClienteDTO): dto is ClienteCompleto {
  return "partitaIva" in dto;
}

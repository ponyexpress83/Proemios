/**
 * File e versioni.
 *
 * Il vincolo fondativo: **l'originale non si tocca mai**. Ogni lavorazione
 * produce una versione nuova, con `precedenteId` verso quella da cui deriva.
 * Nessuna funzione di questo modulo modifica il contenuto di una versione
 * esistente, e lo storage rifiuta la scrittura su una chiave già usata.
 */
import { createHash } from "node:crypto";
import { and, desc, eq, isNull, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deliverables, fileVersions, files } from "@/db/schema/file";

import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { storage, costruisciChiave } from "@/lib/storage";
import { nomeSicuro, validaFile } from "@/lib/file/validazione";
import { progettoAccessibile } from "./comunicazioni";

export type RuoloVersione =
  | "originale"
  | "lavorazione"
  | "revisionata"
  | "approvata"
  | "deliverable";

export type VersioneDTO = {
  id: string;
  fileId: string;
  numeroVersione: number;
  ruolo: string;
  stato: string;
  nomeFile: string;
  mimeType: string;
  dimensioneByte: number;
  /** Primi 12 caratteri: bastano a riconoscere il file, non a ricalcolarlo. */
  hashBreve: string;
  precedenteId: string | null;
  notaVerifica: string | null;
  createdAt: string;
};

export type FileDTO = {
  id: string;
  nome: string;
  categoria: string;
  versioni: VersioneDTO[];
  createdAt: string;
};

function versioneDTO(v: typeof fileVersions.$inferSelect): VersioneDTO {
  return {
    id: v.id,
    fileId: v.fileId,
    numeroVersione: v.numeroVersione,
    ruolo: v.ruolo,
    stato: v.stato,
    nomeFile: v.nomeFile,
    mimeType: v.mimeType,
    dimensioneByte: v.dimensioneByte,
    hashBreve: v.hashSha256.slice(0, 12),
    precedenteId: v.precedenteId,
    notaVerifica: v.notaVerifica,
    createdAt: v.createdAt.toISOString(),
  };
}

/**
 * Chi può vedere i file di un progetto.
 *
 * Finance ha `progetto.vedi_tutti` ma non `file.vedi_manoscritto`: vede il
 * progetto come voce contabile e non i suoi contenuti. È il confine richiesto
 * dal capitolato, e passa da qui perché è l'unico punto in cui i file si
 * leggono.
 */
function esigiAccessoAiFile(attore: Attore): void {
  if (attore.ruolo === "client") return; // accede ai propri, per proprietà
  if (!haPermesso(attore, "file.vedi_manoscritto")) {
    throw new NonAutorizzato(`file.vedi_manoscritto mancante per ruolo ${attore.ruolo}`);
  }
}

export async function elencaFile(attore: Attore, progettoId: string): Promise<FileDTO[]> {
  await progettoAccessibile(attore, progettoId);
  esigiAccessoAiFile(attore);

  const db = getDb();
  const righeFile = await db
    .select()
    .from(files)
    .where(and(eq(files.projectId, progettoId), isNull(files.archiviatoAt)))
    .orderBy(desc(files.createdAt));

  if (righeFile.length === 0) return [];

  const versioni = await db
    .select()
    .from(fileVersions)
    .where(and(eq(fileVersions.projectId, progettoId), isNull(fileVersions.cancellataAt)))
    .orderBy(desc(fileVersions.numeroVersione));

  return righeFile.map((f) => ({
    id: f.id,
    nome: f.nome,
    categoria: f.categoria,
    createdAt: f.createdAt.toISOString(),
    versioni: versioni
      .filter((v) => v.fileId === f.id)
      // Il cliente non deve vedere le versioni di lavorazione interne: per lui
      // esistono l'originale che ha caricato e ciò che gli è stato consegnato.
      .filter((v) =>
        attore.ruolo === "client"
          ? v.ruolo === "originale" || v.ruolo === "deliverable"
          : true,
      )
      .map(versioneDTO),
  }));
}

export type DatiCaricamento = {
  progettoId: string;
  nomeFile: string;
  mimeType: string;
  contenuto: Buffer;
  categoria?: string;
  /** Quando la versione deriva da un'altra (lavorazione, revisione…). */
  fileId?: string;
  precedenteId?: string;
  ruolo?: RuoloVersione;
  jobId?: string;
  metadati?: Record<string, unknown>;
};

/**
 * Carica una versione.
 *
 * Ordine delle operazioni: prima si valida, poi si scrive sullo storage, poi si
 * registra in database. Se la scrittura sullo storage fallisce non resta una
 * riga che punta al nulla; se fallisce la riga resta un oggetto orfano, che la
 * manutenzione periodica può rimuovere — l'inverso, una riga senza file, è
 * molto peggio, perché il sistema crede di avere qualcosa che non ha.
 */
export async function caricaVersione(
  attore: Attore,
  dati: DatiCaricamento,
): Promise<VersioneDTO> {
  esigiPermesso(attore, "file.carica");
  const progetto = await progettoAccessibile(attore, dati.progettoId);

  const nome = nomeSicuro(dati.nomeFile);
  const validazione = validaFile({
    nomeFile: nome,
    mimeDichiarato: dati.mimeType,
    dimensioneByte: dati.contenuto.byteLength,
    primiByte: dati.contenuto.subarray(0, 16),
  });
  if (!validazione.ok) throw new Error(validazione.motivo);

  /*
   * Il ruolo della versione:
   *  - ciò che manda un cliente è per definizione un originale, e nessuno può
   *    dichiararlo diversamente dall'interfaccia;
   *  - la prima versione di un file nuovo è l'originale, chiunque la carichi:
   *    è il punto di partenza della catena;
   *  - una versione aggiunta a un file esistente è una lavorazione, salvo che
   *    il chiamante dichiari altro.
   */
  const ruolo: RuoloVersione =
    attore.ruolo === "client"
      ? "originale"
      : (dati.ruolo ?? (dati.fileId ? "lavorazione" : "originale"));

  const db = getDb();
  const deposito = storage();

  const chiave = costruisciChiave({
    organizationId: progetto.organizationId,
    projectId: dati.progettoId,
    ruolo,
    mimeType: validazione.mimeType,
  });

  const esito = await deposito.scrivi(chiave, dati.contenuto, {
    mimeType: validazione.mimeType,
  });

  return db.transaction(async (tx) => {
    let fileId = dati.fileId;

    if (!fileId) {
      const [nuovo] = await tx
        .insert(files)
        .values({
          organizationId: progetto.organizationId,
          projectId: dati.progettoId,
          nome,
          categoria: dati.categoria ?? "manoscritto",
          caricatoDaId: attore.userId,
        })
        .returning({ id: files.id });
      fileId = nuovo!.id;
    } else {
      // Un fileId che arriva dal client va verificato: appartenere a un altro
      // progetto significherebbe attaccare una versione a un file altrui.
      const [esistente] = await tx
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.projectId, dati.progettoId)))
        .limit(1);
      if (!esistente) throw new NonTrovato(`file ${fileId} non appartiene al progetto`);
    }

    const [ultimo] = await tx
      .select({ n: max(fileVersions.numeroVersione) })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId));
    const numeroVersione = Number(ultimo?.n ?? 0) + 1;

    // L'originale è uno solo: una seconda versione con ruolo `originale`
    // significherebbe che il file di partenza è stato sostituito.
    if (ruolo === "originale" && numeroVersione > 1) {
      const [giaOriginale] = await tx
        .select({ id: fileVersions.id })
        .from(fileVersions)
        .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.ruolo, "originale")))
        .limit(1);
      if (giaOriginale) {
        throw new Error(
          "Questo file ha già un originale: l'originale non si sostituisce, si carica un file nuovo.",
        );
      }
    }

    const [versione] = await tx
      .insert(fileVersions)
      .values({
        fileId,
        organizationId: progetto.organizationId,
        projectId: dati.progettoId,
        jobId: dati.jobId ?? null,
        numeroVersione,
        ruolo,
        stato: "disponibile",
        nomeFile: nome,
        mimeType: validazione.mimeType,
        dimensioneByte: esito.dimensioneByte,
        hashSha256: esito.hashSha256,
        chiaveStorage: esito.chiave,
        driverStorage: deposito.nome,
        precedenteId: dati.precedenteId ?? null,
        creatoDaId: attore.userId,
        metadati: dati.metadati ?? null,
      })
      .returning();

    await tx
      .update(files)
      .set({ versioneCorrenteId: versione!.id, updatedAt: new Date() })
      .where(eq(files.id, fileId));

    await registra(
      attore,
      {
        azione: "file.caricato",
        entita: "file_version",
        entitaId: versione!.id,
        metadati: {
          progettoId: dati.progettoId,
          ruolo,
          numeroVersione,
          dimensioneByte: esito.dimensioneByte,
          // L'hash sì, il nome del file no: il nome può contenere il titolo
          // dell'opera o il nome dell'autore.
          hash: esito.hashSha256.slice(0, 16),
        },
      },
      tx,
    );

    return versioneDTO(versione!);
  });
}

/**
 * URL firmato per scaricare una versione.
 *
 * Ogni accesso è registrato: chi ha scaricato cosa e quando è un'informazione
 * che serve tanto alla conformità quanto a capire un incidente.
 */
export async function urlDownload(
  attore: Attore,
  versioneId: string,
): Promise<{ url: string; nomeFile: string }> {
  const db = getDb();
  const [versione] = await db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.id, versioneId))
    .limit(1);
  if (!versione) throw new NonTrovato(`versione ${versioneId} inesistente`);

  await progettoAccessibile(attore, versione.projectId);

  if (attore.ruolo === "client") {
    // Il cliente scarica il proprio originale e i deliverable consegnati.
    // Le versioni di lavorazione non gli sono destinate: contengono lo stato
    // intermedio del lavoro, non il risultato.
    const ammesso = versione.ruolo === "originale" || versione.ruolo === "deliverable";
    if (!ammesso) throw new NonTrovato(`versione ${versioneId} non consegnabile al cliente`);

    if (versione.ruolo === "deliverable") {
      const [consegnato] = await db
        .select({ id: deliverables.id })
        .from(deliverables)
        .where(
          and(
            eq(deliverables.fileVersionId, versioneId),
            eq(deliverables.visibileAlCliente, true),
            sql`${deliverables.consegnatoAt} is not null`,
          ),
        )
        .limit(1);
      if (!consegnato) throw new NonTrovato(`versione ${versioneId} non ancora consegnata`);
    }
  } else {
    esigiAccessoAiFile(attore);
  }

  if (versione.cancellataAt) throw new NonTrovato(`versione ${versioneId} cancellata`);

  const url = await storage().urlFirmato(versione.chiaveStorage, {
    secondi: 300,
    nomeDownload: versione.nomeFile,
  });

  await registra(attore, {
    azione: "file.scaricato",
    entita: "file_version",
    entitaId: versioneId,
    metadati: { progettoId: versione.projectId, ruolo: versione.ruolo },
  });

  return { url, nomeFile: versione.nomeFile };
}

/** Contenuto di una versione, per l'elaborazione lato server. */
export async function contenutoVersione(
  attore: Attore,
  versioneId: string,
): Promise<{ contenuto: Buffer; nomeFile: string; mimeType: string }> {
  esigiAccessoAiFile(attore);
  const db = getDb();
  const [versione] = await db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.id, versioneId))
    .limit(1);
  if (!versione) throw new NonTrovato(`versione ${versioneId} inesistente`);
  await progettoAccessibile(attore, versione.projectId);

  await registra(attore, {
    azione: "file.accesso",
    entita: "file_version",
    entitaId: versioneId,
    metadati: { progettoId: versione.projectId },
  });

  return {
    contenuto: await storage().leggi(versione.chiaveStorage),
    nomeFile: versione.nomeFile,
    mimeType: versione.mimeType,
  };
}

/** Marca una versione come da verificare, con il motivo. */
export async function segnalaDaVerificare(
  attore: Attore,
  versioneId: string,
  nota: string,
): Promise<void> {
  esigiPermesso(attore, "file.vedi_manoscritto");
  const db = getDb();
  await db
    .update(fileVersions)
    .set({ stato: "needs_review", notaVerifica: nota.slice(0, 500), updatedAt: new Date() })
    .where(
      and(
        eq(fileVersions.id, versioneId),
        eq(fileVersions.organizationId, attore.organizationId),
      ),
    );
}

/**
 * Verifica che il contenuto salvato corrisponda ancora all'hash registrato.
 * Serve prima di consegnare: dimostra che il file che parte è quello approvato.
 */
export async function verificaIntegrita(
  attore: Attore,
  versioneId: string,
): Promise<{ integra: boolean; hashAtteso: string; hashTrovato: string }> {
  esigiPermesso(attore, "file.vedi_manoscritto");
  const db = getDb();
  const [versione] = await db
    .select()
    .from(fileVersions)
    .where(
      and(eq(fileVersions.id, versioneId), eq(fileVersions.organizationId, attore.organizationId)),
    )
    .limit(1);
  if (!versione) throw new NonTrovato(`versione ${versioneId} inesistente o di altro tenant`);

  const contenuto = await storage().leggi(versione.chiaveStorage);
  const hashTrovato = createHash("sha256").update(contenuto).digest("hex");

  return {
    integra: hashTrovato === versione.hashSha256,
    hashAtteso: versione.hashSha256,
    hashTrovato,
  };
}

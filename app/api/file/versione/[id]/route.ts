import { NextResponse } from "next/server";
import { attoreCorrente } from "@/lib/auth/sessione";
import { urlDownload } from "@/lib/dati/file";
import { isErroreAutorizzazione } from "@/lib/auth/errori";

/**
 * Scarico di una versione di file.
 *
 * La rotta non serve il contenuto: chiede al livello dati un URL firmato e ci
 * rimanda. L'autorizzazione — tenant, ruolo, appartenenza al progetto, e per il
 * cliente il fatto che la versione sia davvero stata consegnata — vive tutta in
 * `urlDownload`, che è la stessa funzione usata ovunque. Qui non si ripete: si
 * chiama.
 *
 * Una versione non accessibile risponde 404, non 403. Distinguere «non tuo» da
 * «non esiste» permetterebbe di scoprire quali id esistono provandoli.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_richiesta: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Non trovato.", { status: 404 });

  const attore = await attoreCorrente();
  if (!attore) return new NextResponse("Accesso richiesto.", { status: 401 });

  try {
    const { url } = await urlDownload(attore, id);
    // 302 e non 307: il link è a uso singolo e scade in cinque minuti, non va
    // ripetuto né messo in cache da nessuno.
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) return new NextResponse("Non trovato.", { status: 404 });
    throw errore;
  }
}

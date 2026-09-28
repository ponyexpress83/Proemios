import { NextResponse } from "next/server";
import { attoreCorrente } from "@/lib/auth/sessione";
import { caricaVersione } from "@/lib/dati/file";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { DIMENSIONE_MASSIMA_BYTE } from "@/lib/file/validazione";
import { proteggi } from "@/lib/sicurezza";

/**
 * Caricamento di un file dentro un progetto.
 *
 * È una route e non una server action perché un manoscritto pesa decine di
 * megabyte: le action hanno un limite di corpo molto più basso, e superarlo
 * dà un errore che in pagina sembra un guasto qualsiasi.
 *
 * Qui non si valida il contenuto e non si decide chi può caricare: entrambe le
 * cose stanno in `caricaVersione` — permesso `file.carica`, appartenenza al
 * progetto, tipo e firma binaria del file, immutabilità dell'originale. Sono
 * le stesse regole che valgono per ogni altra via di scrittura, e ripeterle
 * qui vorrebbe dire averne due versioni che prima o poi divergono.
 *
 * Il nome del file non viene registrato nei log: è il titolo dell'opera di
 * qualcuno.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(richiesta: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ errore: "Progetto non valido." }, { status: 404 });

  const attore = await attoreCorrente();
  if (!attore) return NextResponse.json({ errore: "Accesso richiesto." }, { status: 401 });

  const limite = await proteggi("caricamento", richiesta, attore.userId);
  if (limite) return limite;

  let form: FormData;
  try {
    form = await richiesta.formData();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ errore: "Scegli un file da caricare." }, { status: 422 });
  }
  // Controllo anticipato sulla dimensione: leggere in memoria un file enorme
  // per poi rifiutarlo è il modo più semplice di far cadere il processo.
  if (file.size > DIMENSIONE_MASSIMA_BYTE) {
    return NextResponse.json(
      { errore: `Il file supera i ${Math.floor(DIMENSIONE_MASSIMA_BYTE / (1024 * 1024))} MB.` },
      { status: 413 },
    );
  }

  try {
    const versione = await caricaVersione(attore, {
      progettoId: id,
      nomeFile: file.name,
      mimeType: file.type,
      contenuto: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, versioneId: versione.id, nomeFile: versione.nomeFile });
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) {
      return NextResponse.json({ errore: "Non trovato." }, { status: 404 });
    }
    // Il messaggio di `validaFile` è pensato per chi carica ("Accettiamo .docx,
    // .pdf…"), quindi si riporta invece di nasconderlo dietro un 500 generico.
    const messaggio = errore instanceof Error ? errore.message : "Caricamento non riuscito.";
    console.error(JSON.stringify({ evt: "file.caricamento-fallito", progettoId: id }));
    return NextResponse.json({ errore: messaggio }, { status: 422 });
  }
}

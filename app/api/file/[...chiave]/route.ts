import { NextResponse, type NextRequest } from "next/server";
import { StorageFilesystem } from "@/lib/storage/filesystem";
import { nomeSicuro } from "@/lib/file/validazione";
import { ambienteLive } from "@/lib/env";

/**
 * Serve i file dello storage su filesystem, verificando la firma HMAC.
 *
 * Esiste **solo** per il driver filesystem, che è quello di sviluppo e dei
 * test: con S3 gli URL firmati puntano direttamente al bucket e questa rotta
 * non viene mai raggiunta. Se qualcuno la chiama con lo storage S3
 * configurato, risponde 404.
 */
export const runtime = "nodejs";

export async function GET(
  richiesta: NextRequest,
  { params }: { params: Promise<{ chiave: string[] }> },
) {
  /*
   * Sul sito vero i file riservati passano solo da URL firmati S3, mai da
   * qui. Il controllo è `ambienteLive()` e non `NODE_ENV`, per la terza volta
   * e per lo stesso motivo: `next start`, le preview e la CI girano tutti con
   * NODE_ENV=production, e legare il divieto a quella variabile rendeva ogni
   * scarico impossibile fuori da `next dev` — cioè impossibile provare il
   * prodotto prima di avere un bucket.
   *
   * Resta comunque il secondo controllo sul driver: in produzione il cancello
   * di lib/env.ts impone s3, quindi anche volendo questa rotta non servirebbe
   * nulla. Le due barriere sono indipendenti apposta.
   */
  if (ambienteLive()) {
    return new NextResponse("Non disponibile.", { status: 404 });
  }

  const driver = process.env.STORAGE_DRIVER ?? (process.env.S3_BUCKET ? "s3" : "filesystem");
  if (driver !== "filesystem") {
    return new NextResponse("Non disponibile.", { status: 404 });
  }

  const { chiave: parti } = await params;
  const chiave = parti.join("/");

  const scade = Number(richiesta.nextUrl.searchParams.get("scade"));
  const firma = richiesta.nextUrl.searchParams.get("firma") ?? "";

  const deposito = new StorageFilesystem({
    radice: process.env.STORAGE_ROOT ?? `${process.cwd()}/.storage`,
    segreto: process.env.STORAGE_SIGNING_SECRET ?? "sviluppo-non-per-produzione",
  });

  // La firma è l'autorizzazione: senza, chiunque conoscesse la chiave potrebbe
  // scaricare il manoscritto.
  if (!deposito.verificaFirma(chiave, scade, firma)) {
    return new NextResponse("Collegamento non valido o scaduto.", { status: 403 });
  }

  let contenuto: Buffer;
  try {
    contenuto = await deposito.leggi(chiave);
  } catch {
    return new NextResponse("Non trovato.", { status: 404 });
  }

  const nome = nomeSicuro(richiesta.nextUrl.searchParams.get("nome") ?? "file");

  return new NextResponse(new Uint8Array(contenuto), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Content-Length": String(contenuto.byteLength),
      // Un file riservato non finisce in nessuna cache condivisa.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

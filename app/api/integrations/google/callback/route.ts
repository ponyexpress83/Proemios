import { NextResponse } from "next/server";
import { googleCallback } from "@/lib/platform/documents/google";
import { appOrigin } from "@/lib/platform/config";

export const runtime = "nodejs";

/** Ritorno dall'autorizzazione Google: nessun dato nell'URL di arrivo, solo l'esito. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  let outcome = "ok";
  try {
    if (!code || !state) throw new Error("missing");
    await googleCallback(code, state);
  } catch {
    outcome = "errore";
  }
  return NextResponse.redirect(`${appOrigin()}/spazio?tab=crm-settings&section=diagnostics&google=${outcome}`);
}

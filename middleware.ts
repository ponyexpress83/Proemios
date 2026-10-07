import { NextResponse, type NextRequest } from "next/server";
import {
  costruisciCsp,
  generaNonce,
  intestazioniFisse,
} from "@/lib/sicurezza/intestazioni";

/**
 * Il middleware fa **due** cose, e nessuna delle due è l'autorizzazione.
 *
 * 1. Applica le intestazioni di sicurezza, con una CSP a nonce per richiesta.
 *    Deve stare qui perché il nonce cambia a ogni risposta e le intestazioni
 *    statiche di `next.config.mjs` non possono contenerne uno.
 *
 * 2. Manda alla pagina di accesso chi non ha un cookie di sessione, invece di
 *    fargli vedere una pagina che fallirebbe.
 *
 * **Non è il livello di sicurezza.** La verifica vera — sessione valida, ruolo,
 * permesso, tenant — avviene lato server in ogni pagina e ogni azione, tramite
 * `esigiStaff` / `esigiAttore` e le guardie del livello dati. Deve essere così:
 * il middleware gira sul runtime edge, dove non c'è accesso al database, quindi
 * non può sapere se una sessione è ancora valida, se l'account è stato
 * disattivato o se il ruolo è cambiato. Un cookie presente non prova nulla.
 */

/** Nome del cookie di sessione Auth.js: cambia prefisso con HTTPS. */
const COOKIE_SESSIONE = ["authjs.session-token", "__Secure-authjs.session-token"];

const AREE_PROTETTE = ["/admin", "/area", "/redazione"];

export function middleware(request: NextRequest) {
  const percorso = request.nextUrl.pathname;
  const sviluppo = process.env.NODE_ENV !== "production";

  const nonce = generaNonce();
  const csp = costruisciCsp({
    nonce,
    sviluppo,
    gtm: Boolean(process.env.NEXT_PUBLIC_GTM_ID),
    analytics: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN,
  });

  const protetta = AREE_PROTETTE.some((a) => percorso === a || percorso.startsWith(`${a}/`));
  if (protetta && !COOKIE_SESSIONE.some((nome) => request.cookies.has(nome))) {
    const destinazione = new URL("/accedi", request.url);
    destinazione.searchParams.set("da", percorso);
    const rimando = NextResponse.redirect(destinazione);
    applicaIntestazioni(rimando, csp, sviluppo);
    return rimando;
  }

  // Il nonce viaggia in un'intestazione della richiesta: Next lo legge da lì e
  // lo applica agli script che genera, e `app/layout.tsx` lo rilegge con
  // `headers()` per i propri.
  const intestazioniRichiesta = new Headers(request.headers);
  intestazioniRichiesta.set("x-nonce", nonce);

  const risposta = NextResponse.next({ request: { headers: intestazioniRichiesta } });
  applicaIntestazioni(risposta, csp, sviluppo);
  return risposta;
}

function applicaIntestazioni(risposta: NextResponse, csp: string, sviluppo: boolean) {
  risposta.headers.set("Content-Security-Policy", csp);
  for (const [nome, valore] of Object.entries(intestazioniFisse(sviluppo))) {
    risposta.headers.set(nome, valore);
  }
}

export const config = {
  /*
   * Tutte le rotte tranne gli asset statici e le immagini generate.
   *
   * Le intestazioni servono su ogni documento HTML, non solo sulle aree
   * riservate; escludere `_next/static` evita di far girare il middleware su
   * migliaia di richieste che non ne hanno bisogno.
   */
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

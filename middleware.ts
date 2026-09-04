import { NextResponse, type NextRequest } from "next/server";

/**
 * Il middleware fa **una cosa sola**: manda alla pagina di accesso chi non ha
 * un cookie di sessione, invece di fargli vedere una pagina che fallirebbe.
 *
 * Non è il livello di sicurezza. La verifica vera — sessione valida, ruolo,
 * permesso, tenant — avviene lato server in ogni pagina e ogni azione, tramite
 * `esigiStaff` / `esigiAttore` (lib/auth/sessione.ts) e le guardie del livello
 * dati. Deve essere così: il middleware gira sul runtime edge, dove non c'è
 * accesso al database, quindi non può sapere se una sessione è ancora valida,
 * se l'account è stato disattivato o se il ruolo è cambiato. Un cookie presente
 * non prova nulla.
 *
 * Chi arrivasse a una pagina protetta con un cookie scaduto la vede fallire
 * lato server, con un 401 o un rimando: è il comportamento corretto.
 */

/** Nome del cookie di sessione Auth.js: cambia prefisso con HTTPS. */
const COOKIE_SESSIONE = ["authjs.session-token", "__Secure-authjs.session-token"];

const AREE_PROTETTE = ["/admin", "/area", "/redazione"];

export function middleware(request: NextRequest) {
  const percorso = request.nextUrl.pathname;
  if (!AREE_PROTETTE.some((a) => percorso === a || percorso.startsWith(`${a}/`))) {
    return NextResponse.next();
  }

  const haCookie = COOKIE_SESSIONE.some((nome) => request.cookies.has(nome));
  if (haCookie) return NextResponse.next();

  const destinazione = new URL("/accedi", request.url);
  destinazione.searchParams.set("da", percorso);
  return NextResponse.redirect(destinazione);
}

export const config = {
  matcher: ["/admin/:path*", "/area/:path*", "/redazione/:path*"],
};

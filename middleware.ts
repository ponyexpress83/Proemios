import { NextResponse, type NextRequest } from "next/server";

/**
 * Protegge /admin con Basic Auth (nessun account utente in Fase 1).
 * Credenziali da ADMIN_USER / ADMIN_PASSWORD.
 */

/** Confronto a tempo costante: evita di far trapelare la password dai tempi di risposta. */
function ugualeCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function richiediCredenziali() {
  return new NextResponse("Autenticazione richiesta.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Proemios Admin", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    return new NextResponse(
      "Admin non configurato: imposta ADMIN_USER e ADMIN_PASSWORD fra le variabili d'ambiente.",
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth) return richiediCredenziali();

  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return richiediCredenziali();

  let decoded: string;
  try {
    // `atob` è disponibile sul runtime edge del middleware.
    decoded = atob(encoded);
  } catch {
    return richiediCredenziali();
  }

  const idx = decoded.indexOf(":");
  if (idx === -1) return richiediCredenziali();

  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  // Entrambi i confronti vengono eseguiti sempre: nessun cortocircuito.
  const okUser = ugualeCostante(u, user);
  const okPass = ugualeCostante(p, password);
  if (okUser && okPass) return NextResponse.next();

  return richiediCredenziali();
}

export const config = {
  matcher: ["/admin/:path*"],
};

import { NextResponse, type NextRequest } from "next/server";

/**
 * Protegge /admin con Basic Auth (nessun account utente in Fase 1).
 * Credenziali da ADMIN_USER / ADMIN_PASSWORD.
 *
 * In modalità demo — nessun `DATABASE_URL`, quindi nessun dato vero da
 * proteggere — valgono credenziali note e dichiarate, così il cruscotto si può
 * mostrare senza configurare niente. L'autenticazione resta attiva: cambia solo
 * quali credenziali accetta. La condizione è ripetuta qui invece di importarla
 * da `lib/demo.ts` per non trascinare il motore di prezzo nel bundle edge del
 * middleware: se cambia la regola, vanno allineati entrambi i punti.
 */
const DEMO_USER = "demo";
const DEMO_PASSWORD = "proemios";

function inDemo(): boolean {
  const forzatura = process.env.DEMO_MODE?.toLowerCase();
  if (forzatura === "off" || forzatura === "0" || forzatura === "false") return false;
  if (forzatura === "on" || forzatura === "1" || forzatura === "true") return true;
  return !process.env.DATABASE_URL;
}

/** Confronto a tempo costante: evita di far trapelare la password dai tempi di risposta. */
function ugualeCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function richiediCredenziali(demo: boolean) {
  return new NextResponse(
    demo
      ? `Area riservata. Credenziali della demo: ${DEMO_USER} / ${DEMO_PASSWORD}`
      : "Autenticazione richiesta.",
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Proemios Admin", charset="UTF-8"' },
    },
  );
}

export function middleware(request: NextRequest) {
  const demo = inDemo();
  const user = process.env.ADMIN_USER ?? (demo ? DEMO_USER : undefined);
  const password = process.env.ADMIN_PASSWORD ?? (demo ? DEMO_PASSWORD : undefined);

  if (!user || !password) {
    return new NextResponse(
      "Admin non configurato: imposta ADMIN_USER e ADMIN_PASSWORD fra le variabili d'ambiente.",
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth) return richiediCredenziali(demo);

  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return richiediCredenziali(demo);

  let decoded: string;
  try {
    // `atob` è disponibile sul runtime edge del middleware.
    decoded = atob(encoded);
  } catch {
    return richiediCredenziali(demo);
  }

  const idx = decoded.indexOf(":");
  if (idx === -1) return richiediCredenziali(demo);

  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  // Entrambi i confronti vengono eseguiti sempre: nessun cortocircuito.
  const okUser = ugualeCostante(u, user);
  const okPass = ugualeCostante(p, password);
  if (okUser && okPass) return NextResponse.next();

  return richiediCredenziali(demo);
}

export const config = {
  matcher: ["/admin/:path*"],
};

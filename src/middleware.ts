import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic Auth sulla pagina /admin (env ADMIN_USER / ADMIN_PASSWORD).
 * Nessuna autenticazione utente in Fase 1: l'unica area protetta è l'admin.
 */
export const config = {
  matcher: ["/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD ?? "changeme";

  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const sep = decoded.indexOf(":");
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    } catch {
      // credenziali malformate → richiedi di nuovo
    }
  }

  return new NextResponse("Autenticazione richiesta.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kalamos Admin", charset="UTF-8"' },
  });
}

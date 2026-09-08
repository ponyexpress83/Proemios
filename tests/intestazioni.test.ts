import { describe, it, expect } from "vitest";
import { costruisciCsp, generaNonce, intestazioniFisse } from "@/lib/sicurezza/intestazioni";

function direttive(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split(";").map((d) => {
      const [nome, ...resto] = d.trim().split(/\s+/);
      return [nome!, resto.join(" ")];
    }),
  );
}

describe("Content-Security-Policy", () => {
  const produzione = costruisciCsp({ nonce: "abc123", sviluppo: false, gtm: true });

  it("non ammette mai unsafe-inline sugli script", () => {
    // Con unsafe-inline attivo, uno script iniettato in pagina verrebbe
    // eseguito esattamente come i nostri: la policy non varrebbe niente.
    expect(direttive(produzione)["script-src"]).not.toContain("unsafe-inline");
  });

  it("non ammette unsafe-eval in produzione", () => {
    expect(produzione).not.toContain("unsafe-eval");
    // In sviluppo sì: senza, il refresh di Next non aggiorna la pagina.
    expect(costruisciCsp({ nonce: "x", sviluppo: true })).toContain("unsafe-eval");
  });

  it("porta il nonce della richiesta", () => {
    expect(direttive(produzione)["script-src"]).toContain("'nonce-abc123'");
  });

  it("blocca l'incorniciamento, i plugin e la riscrittura della base", () => {
    const d = direttive(produzione);
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
    // Un <base> iniettato riscriverebbe ogni URL relativo, form comprese.
    expect(d["base-uri"]).toBe("'self'");
    // Una form riscritta non può mandare altrove i dati dell'utente.
    expect(d["form-action"]).toBe("'self'");
  });

  it("forza https in produzione, non in sviluppo", () => {
    expect(produzione).toContain("upgrade-insecure-requests");
    expect(costruisciCsp({ nonce: "x", sviluppo: true })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("ammette i domini di GTM solo quando GTM è configurato", () => {
    const senza = direttive(costruisciCsp({ nonce: "x", sviluppo: false, gtm: false }));
    expect(senza["connect-src"]).not.toContain("googletagmanager");
    const con = direttive(costruisciCsp({ nonce: "x", sviluppo: false, gtm: true }));
    expect(con["connect-src"]).toContain("googletagmanager");
  });

  it("ammette l'analytics solo se ne è configurato uno", () => {
    const con = direttive(
      costruisciCsp({ nonce: "x", sviluppo: false, analytics: "plausible.io" }),
    );
    expect(con["connect-src"]).toContain("https://plausible.io");
    const senza = direttive(costruisciCsp({ nonce: "x", sviluppo: false }));
    expect(senza["connect-src"]).not.toContain("plausible");
  });

  it("dichiara una default-src restrittiva", () => {
    expect(direttive(produzione)["default-src"]).toBe("'self'");
  });
});

describe("intestazioni fisse", () => {
  it("in produzione include HSTS", () => {
    const h = intestazioniFisse(false);
    expect(h["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
  });

  it("in sviluppo non include HSTS", () => {
    // Bloccherebbe http://localhost nel browser per i mesi successivi, e
    // disfarlo richiede di entrare nelle impostazioni interne del browser.
    expect(intestazioniFisse(true)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("nega sniffing, incorniciamento e funzionalità che non usiamo", () => {
    const h = intestazioniFisse(false);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    for (const funzione of ["camera", "microphone", "geolocation", "payment"]) {
      expect(h["Permissions-Policy"]).toContain(`${funzione}=()`);
    }
  });

  it("non manda il percorso ai domini esterni", () => {
    // Un referer completo rivelerebbe quali pagine private si stavano guardando.
    expect(intestazioniFisse(false)["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("nonce", () => {
  it("è diverso a ogni richiesta e abbastanza lungo", () => {
    const generati = new Set(Array.from({ length: 200 }, () => generaNonce()));
    expect(generati.size).toBe(200);
    for (const n of generati) expect(n.length).toBeGreaterThanOrEqual(16);
  });
});

import { test, expect } from "@playwright/test";

/**
 * I confini, provati dall'esterno.
 *
 * Questi test non sanno niente del codice: aprono URL come farebbe chiunque e
 * guardano cosa succede. È l'unico modo di verificare che le protezioni valgano
 * anche per chi non passa dalla nostra interfaccia.
 */

const AREE_RISERVATE = [
  "/admin",
  "/admin/pagamenti",
  "/admin/analytics",
  "/admin/organizzazione",
  "/admin/crm",
  "/area",
  "/area/pagamenti",
  "/redazione",
  "/redazione/00000000-0000-0000-0000-000000000000",
];

test.describe("aree riservate", () => {
  for (const percorso of AREE_RISERVATE) {
    test(`${percorso} non è raggiungibile senza sessione`, async ({ page }) => {
      const risposta = await page.goto(percorso);
      // Si finisce sulla pagina di accesso, non su un contenuto.
      expect(page.url()).toContain("/accedi");
      expect(risposta?.status()).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText("Cruscotto");
    });
  }

  test("un cookie di sessione inventato non apre niente", async ({ page, context }) => {
    // Il middleware lo lascia passare — non può verificarlo, gira sull'edge —
    // ma il controllo lato server lo rifiuta. È il comportamento voluto.
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: "a".repeat(64),
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/admin");
    expect(page.url()).toContain("/accedi");
  });
});

test.describe("intestazioni di sicurezza", () => {
  test("ogni documento porta la CSP e le altre intestazioni", async ({ page }) => {
    const risposta = await page.goto("/");
    const h = risposta!.headers();

    expect(h["content-security-policy"]).toBeTruthy();
    // Con unsafe-inline la policy non varrebbe niente.
    expect(h["content-security-policy"]).not.toContain("unsafe-inline'; script-src");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("il nonce cambia a ogni richiesta", async ({ page }) => {
    const prima = (await page.goto("/"))!.headers()["content-security-policy"];
    const dopo = (await page.goto("/servizi"))!.headers()["content-security-policy"];
    const nonce = (csp: string) => csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce(prima!)).toBeTruthy();
    expect(nonce(prima!)).not.toBe(nonce(dopo!));
  });

  test("la CSP non impedisce al prodotto di funzionare", async ({ page }) => {
    // Una CSP sbagliata non dà errore al build: dà pagine che si caricano e
    // non funzionano, perché il JavaScript viene rifiutato in silenzio.
    const rifiuti: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) rifiuti.push(m.text());
    });
    await page.goto("/preventivo", { waitUntil: "load" });
    await page.waitForTimeout(800);
    expect(rifiuti).toEqual([]);
  });
});

test.describe("limite di frequenza", () => {
  test("i form pubblici si difendono da chi insiste", async ({ request }) => {
    const origine = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    const codici: number[] = [];

    for (let i = 0; i < 8; i += 1) {
      const risposta = await request.post("/api/contatto", {
        headers: { "x-forwarded-for": origine },
        data: {},
      });
      codici.push(risposta.status());
    }

    expect(codici).toContain(429);
    // E la risposta dice quanto aspettare, invece di lasciare indovinare.
    const ultima = await request.post("/api/contatto", {
      headers: { "x-forwarded-for": origine },
      data: {},
    });
    expect(ultima.status()).toBe(429);
    expect(Number(ultima.headers()["retry-after"])).toBeGreaterThan(0);
  });

  test("aggiungere indirizzi all'intestazione non aggira il limite", async ({ request }) => {
    // Il primo indirizzo di x-forwarded-for è quello vero: gli altri sono i
    // proxy attraversati, e chiunque può aggiungerne.
    const origine = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    for (let i = 0; i < 8; i += 1) {
      await request.post("/api/contatto", { headers: { "x-forwarded-for": origine }, data: {} });
    }
    const camuffata = await request.post("/api/contatto", {
      headers: { "x-forwarded-for": `${origine}, 1.2.3.4, 5.6.7.8` },
      data: {},
    });
    expect(camuffata.status()).toBe(429);
  });
});

test.describe("indicizzazione", () => {
  test("robots.txt esclude le aree riservate", async ({ request }) => {
    const testo = await (await request.get("/robots.txt")).text();
    for (const area of ["/admin", "/area", "/redazione", "/accedi"]) {
      expect(testo).toContain(`Disallow: ${area}`);
    }
  });

  test("la sitemap non contiene percorsi privati", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const area of ["/admin", "/area", "/redazione", "/api/"]) {
      expect(xml).not.toContain(area);
    }
  });
});

import { test, expect } from "@playwright/test";

/**
 * Prestazioni percepite.
 *
 * Non è un benchmark: le soglie sono larghe di proposito, perché su una
 * macchina di CI condivisa un numero stretto darebbe test che falliscono a
 * caso, e un test che fallisce a caso viene disattivato dopo la terza volta.
 * Servono a cogliere un peggioramento vero — una pagina che raddoppia di peso,
 * un blocco di rendering introdotto per sbaglio.
 */

const PAGINE = ["/", "/servizi", "/preventivo", "/percorsi"];

test.describe("peso e reattività", () => {
  for (const percorso of PAGINE) {
    test(`${percorso} si carica e diventa interattiva`, async ({ page }) => {
      const inizio = Date.now();
      await page.goto(percorso, { waitUntil: "load" });
      const caricamento = Date.now() - inizio;

      expect(caricamento, `${percorso} ha impiegato ${caricamento}ms`).toBeLessThan(15_000);

      // Il primo contenuto significativo dev'esserci: una pagina che carica in
      // fretta e resta bianca non ha caricato in fretta.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("il JavaScript della home resta sotto il mezzo megabyte", async ({ page }) => {
    let byte = 0;
    page.on("response", async (r) => {
      if (r.url().includes("/_next/static") && r.url().endsWith(".js")) {
        const lunghezza = Number(r.headers()["content-length"] ?? 0);
        byte += lunghezza;
      }
    });
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(500);
    // Soglia larga: coglie un raddoppio, non una fluttuazione.
    expect(byte, `${Math.round(byte / 1024)} kB di JavaScript`).toBeLessThan(512 * 1024);
  });

  test("nessuna immagine servita senza dimensioni", async ({ page }) => {
    // Un'immagine senza dimensioni fa saltare il layout mentre carica.
    await page.goto("/");
    const senzaDimensioni = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img")).filter(
        (i) => !i.getAttribute("width") && !i.getAttribute("height") && !i.style.aspectRatio,
      ).length,
    );
    expect(senzaDimensioni).toBe(0);
  });
});

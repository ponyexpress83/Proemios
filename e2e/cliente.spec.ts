import { test, expect } from "@playwright/test";

/**
 * Il percorso pubblico, dal punto di vista di chi arriva sul sito.
 *
 * Non si prova il configuratore riga per riga — quello lo fanno i test unitari
 * sui prezzi — ma che il percorso commerciale regga: si arriva, si capisce cosa
 * si compra, si può chiedere un preventivo.
 */

test.describe("percorso commerciale", () => {
  test("dalla home si arriva al preventivo", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Proemios/i);

    await page.goto("/preventivo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Il configuratore dev'essere davvero interattivo: se la CSP avesse
    // bloccato il JavaScript, la pagina si vedrebbe uguale e non risponderebbe.
    // Perciò non basta che il controllo esista — bisogna premerlo.
    const scelta = page.locator("button[aria-pressed]").first();
    await expect(scelta).toBeVisible();
    const prima = await scelta.getAttribute("aria-pressed");
    await scelta.click();
    await expect(scelta).not.toHaveAttribute("aria-pressed", prima ?? "false");
  });

  test("il catalogo elenca i servizi e ognuno ha la sua pagina", async ({ page }) => {
    await page.goto("/servizi");
    const primo = page.locator('a[href^="/servizi/"]').first();
    await expect(primo).toBeVisible();
    const href = await primo.getAttribute("href");

    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("i prezzi mostrati vengono dal listino, non dal browser", async ({ page }) => {
    // Non si prova il numero — cambia col listino — ma che sia servito dal
    // server: una pagina che calcola i prezzi nel browser è una pagina in cui
    // i prezzi si possono cambiare.
    const risposta = await page.goto("/servizi/correzione-bozze");
    const html = await risposta!.text();
    expect(html).toMatch(/€|su preventivo/i);
  });

  test("le pagine legali esistono e sono raggiungibili", async ({ page }) => {
    for (const percorso of ["/privacy", "/termini", "/cookie"]) {
      const risposta = await page.goto(percorso);
      expect(risposta?.status(), percorso).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("i vecchi indirizzi rimandano ai nuovi invece di dare 404", async ({ page }) => {
    const risposta = await page.goto("/servizi/valutazione-editoriale");
    expect(risposta?.status()).toBe(200);
    expect(page.url()).toContain("/servizi/scheda-valutazione-editoriale");
  });

  test("una pagina inesistente dà un 404 con una via d'uscita", async ({ page }) => {
    const risposta = await page.goto("/questa-pagina-non-esiste-davvero");
    expect(risposta?.status()).toBe(404);
    await expect(page.locator("a[href='/']").first()).toBeVisible();
  });
});

test.describe("accesso", () => {
  test("la pagina di accesso chiede solo l'email", async ({ page }) => {
    await page.goto("/accedi");
    await expect(page.locator("input[type=email]")).toBeVisible();
    // Nessuna password da rubare: si entra con un link mandato per email.
    await expect(page.locator("input[type=password]")).toHaveCount(0);
  });

  test("chi arriva da un'area riservata ci torna dopo l'accesso", async ({ page }) => {
    await page.goto("/area/pagamenti");
    expect(page.url()).toContain("da=%2Farea%2Fpagamenti");
  });
});

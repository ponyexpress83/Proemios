import { test, expect } from "@playwright/test";

/**
 * Test di fumo del sito ridisegnato: quattro percorsi che devono reggere con
 * mouse e con tastiera. Non si inviano moduli — il configuratore arriva al
 * sesto passo senza premere «Calcola», il caricamento si ferma a «File
 * pronto» — perché qui si prova l'interfaccia, non le API.
 */

test.describe("configuratore", () => {
  test("si arriva al sesto passo con le sole scelte", async ({ page }) => {
    await page.goto("/preventivo");
    const legenda = page.locator("legend");

    // 1 — tipo di libro: una scelta singola avanza da sola.
    await expect(legenda).toHaveText("Che libro è?");
    await page.locator("fieldset button[aria-pressed]").first().click();

    // 2 — stato del testo.
    await expect(legenda).toHaveText("A che punto è il testo?");
    await page.locator("fieldset button[aria-pressed]").first().click();

    // 3 — lunghezza: scelta rapida e «Avanti».
    await expect(legenda).toContainText(/parole|libro finito/);
    await page.getByRole("group", { name: "Lunghezze frequenti" }).getByRole("button").first().click();
    await page.getByRole("button", { name: /avanti/i }).click();

    // 4 — servizi: facoltativi, si può passare oltre.
    await expect(legenda).toHaveText("Cosa ti serve?");
    await page.getByRole("button", { name: /avanti/i }).click();

    // 5 — tempi: avanza da sola.
    await expect(legenda).toHaveText("Che tempi hai?");
    await page.locator("fieldset button[aria-pressed]").first().click();

    // 6 — contatto: il pulsante finale esiste ed è attivo anche a campi vuoti.
    await expect(legenda).toHaveText("Dove mandiamo il preventivo?");
    await expect(page.getByText(/passo 6 di 6/i).first()).toBeVisible();
    const calcola = page.getByRole("button", { name: "Calcola il preventivo" });
    await expect(calcola).toBeVisible();
    await expect(calcola).toBeEnabled();

    // L'indicatore riporta ai passi già fatti.
    await page.getByRole("button", { name: "Tipo di progetto" }).click();
    await expect(legenda).toHaveText("Che libro è?");
  });
});

test.describe("analisi del manoscritto", () => {
  test("un file di testo porta a «File pronto» senza inviare nulla", async ({ page }) => {
    await page.goto("/analisi-manoscritto");
    await page.locator('input[type="file"]').setInputFiles({
      name: "prova.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Era una notte buia e tempestosa. ".repeat(40)),
    });
    await expect(page.getByText("File pronto")).toBeVisible();
    await expect(page.getByText("prova.txt")).toBeVisible();
    await expect(page.getByRole("button", { name: /cambia file/i })).toBeVisible();
    await expect(page.getByText("Il tuo testo non viene archiviato")).toBeVisible();
  });

  test("un formato sbagliato viene fermato prima dell'invio", async ({ page }) => {
    await page.goto("/analisi-manoscritto");
    await page.locator('input[type="file"]').setInputFiles({
      name: "foto.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    });
    await expect(page.getByText(/\.jpg non è tra quelli accettati/)).toBeVisible();
  });
});

test.describe("testata sul telefono", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("il menu si apre, si chiude e restituisce il fuoco con la sola tastiera", async ({ page }) => {
    await page.goto("/");
    const apri = page.getByRole("button", { name: "Apri il menu" });
    await apri.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    // Il fuoco è dentro il menu, e Tab non ne esce.
    await expect(menu.locator(":focus")).toHaveCount(1);
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    await expect(menu.locator(":focus")).toHaveCount(1);
    await expect(menu.getByRole("link", { name: "Area autori" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(apri).toBeFocused();
  });
});

test.describe("confronto prima/dopo", () => {
  test("il cursore risponde alle frecce, a Home e a End", async ({ page }) => {
    await page.goto("/");
    const cursore = page.locator('input[type="range"]').first();
    await cursore.scrollIntoViewIfNeeded();
    await cursore.focus();
    const prima = Number(await cursore.inputValue());

    await page.keyboard.press("ArrowRight");
    expect(Number(await cursore.inputValue())).toBeGreaterThan(prima);
    await page.keyboard.press("End");
    await expect(cursore).toHaveValue("95");
    await page.keyboard.press("Home");
    await expect(cursore).toHaveValue("5");
    await expect(cursore).toHaveAttribute("aria-valuetext", /5% della pagina/);
  });
});

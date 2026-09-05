/**
 * Verifica che la Content-Security-Policy non rompa il prodotto.
 *
 * Una CSP a nonce sbagliata non dà errore al build: dà pagine che si caricano e
 * non funzionano, perché il JavaScript viene rifiutato in silenzio. L'unico
 * modo di accorgersene è aprirle con un browser vero e guardare la console.
 *
 *   npm run build && npx next start -p 3111 &
 *   node scripts/verifica-csp.mjs
 */
import { chromium } from "@playwright/test";
import { opzioniBrowser } from "./browser.mjs";

const PAGINE = ["/", "/servizi", "/preventivo", "/percorsi", "/contatti", "/analisi-manoscritto", "/per-agenzie", "/blog"];
const browser = await chromium.launch(opzioniBrowser());
const pagina = await browser.newPage();

const violazioni = [];
const erroriConsole = [];
pagina.on("console", (m) => {
  const testo = m.text();
  if (m.type() === "error") erroriConsole.push(testo);
  if (/Content Security Policy|refused to (execute|load|apply)/i.test(testo)) violazioni.push(testo);
});
pagina.on("pageerror", (e) => erroriConsole.push(`pageerror: ${e.message}`));

for (const p of PAGINE) {
  violazioni.length = 0;
  erroriConsole.length = 0;
  const risposta = await pagina.goto(`http://localhost:3111${p}`, { waitUntil: "load", timeout: 30000 });
  await pagina.waitForTimeout(600);
  const stato = risposta?.status() ?? 0;
  // Prova che il JS di React sia partito: senza, la CSP ha bloccato tutto.
  const idratato = await pagina.evaluate(() => document.querySelectorAll("[class]").length > 20);
  console.log(
    `${p.padEnd(24)} ${stato} idratata=${idratato ? "sì" : "NO"} csp=${violazioni.length} errori=${erroriConsole.length}`,
  );
  for (const v of violazioni.slice(0, 3)) console.log("   CSP:", v.slice(0, 200));
  for (const e of erroriConsole.slice(0, 3)) console.log("   ERR:", e.slice(0, 200));
}

await browser.close();

/**
 * Verifica di accessibilità automatica (axe-core) sulle pagine principali.
 * Copre le violazioni rilevabili da una macchina — contrasto, ruoli, nomi
 * accessibili, ordine dei titoli — non sostituisce la verifica manuale con
 * tastiera e screen reader.
 *
 *   node scripts/accessibilita.mjs            # server su :3130
 *   BASE=http://localhost:3000 node scripts/accessibilita.mjs
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE ?? "http://localhost:3130";
const PAGINE = [
  "/",
  "/percorsi",
  "/percorsi/ho-gia-scritto-il-libro",
  "/servizi",
  "/servizi/correzione-bozze",
  "/preventivo",
  "/contatti",
  "/come-funziona",
  "/privacy",
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const contesto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contesto.newPage();

let totale = 0;
for (const url of PAGINE) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const esito = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  totale += esito.violations.length;
  const stato = esito.violations.length === 0 ? "ok" : `${esito.violations.length} violazioni`;
  console.log(`${url.padEnd(38)} ${stato}`);
  for (const v of esito.violations) {
    console.log(`   [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(" ")}`);
  }
}

await browser.close();
console.log(totale === 0 ? "\nNessuna violazione WCAG A/AA rilevata." : `\nTotale: ${totale}`);
process.exit(totale === 0 ? 0 : 1);

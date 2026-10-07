/**
 * Audit di design del sito pubblico: screenshot, inventario degli stili,
 * accessibilità. Serve a misurare il «prima» e il «dopo» di un redesign con
 * gli stessi strumenti, così il confronto è onesto.
 *
 *   BASE=http://localhost:3200 FASE=before node scripts/audit-design.mjs
 *
 * Produce in design-audit/<FASE>/:
 *   - <pagina>-<larghezza>.png     screenshot a pagina intera, 4 larghezze
 *   - inventario.json              valori distinti di font-size, radius, ombre,
 *                                  colori; testi sotto i 13 px; target < 44 px;
 *                                  altezza pagina; titoli
 *   - axe.json                     violazioni axe-core per pagina (A/AA)
 *   - riepilogo.md                 lettura umana dei numeri che contano
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { opzioniBrowser } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3200";
const FASE = process.env.FASE ?? "before";
const DIR = `design-audit/${FASE}`;
const LARGHEZZE = [375, 768, 1280, 1440];

const PAGINE = [
  ["home", "/"],
  ["preventivo", "/preventivo"],
  ["analisi-manoscritto", "/analisi-manoscritto"],
  ["accedi", "/accedi"],
  ["servizi", "/servizi"],
  ["percorsi", "/percorsi"],
  ["come-funziona", "/come-funziona"],
  ["per-agenzie", "/per-agenzie"],
  ["blog", "/blog"],
  ["contatti", "/contatti"],
  ["chi-siamo", "/chi-siamo"],
  ["casi-studio", "/casi-studio"],
  ["servizio", "/servizi/correzione-bozze"],
  ["percorso", "/percorsi/ho-gia-scritto-il-libro"],
  ["404", "/pagina-che-non-esiste"],
];

await mkdir(DIR, { recursive: true });
const browser = await chromium.launch(opzioniBrowser());

/** Inventario degli stili calcolati su tutti gli elementi visibili. */
async function inventario(page) {
  return page.evaluate(() => {
    const conta = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
    const fontSize = new Map(),
      radius = new Map(),
      ombre = new Map(),
      sfondi = new Map(),
      testi = new Map(),
      famiglie = new Map();
    const piccoli = [];
    const targetPiccoli = [];
    const visibile = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
    };
    const haTesto = (el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    for (const el of document.querySelectorAll("body *")) {
      if (!visibile(el)) continue;
      const cs = getComputedStyle(el);
      if (haTesto(el)) {
        const fs = parseFloat(cs.fontSize);
        conta(fontSize, fs.toFixed(2));
        conta(testi, cs.color);
        conta(famiglie, cs.fontFamily.split(",")[0].replace(/"/g, ""));
        if (fs < 13)
          piccoli.push({
            px: +fs.toFixed(2),
            testo: el.textContent.trim().slice(0, 60),
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.toString() ?? "").slice(0, 60),
          });
      }
      if (cs.borderRadius !== "0px") conta(radius, cs.borderRadius);
      if (cs.boxShadow !== "none") conta(ombre, cs.boxShadow);
      if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") conta(sfondi, cs.backgroundColor);
      if (el.matches("a, button, [role=button], input, select, textarea, [tabindex]")) {
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44)
          targetPiccoli.push({
            w: Math.round(r.width),
            h: Math.round(r.height),
            testo: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
            tag: el.tagName.toLowerCase(),
          });
      }
    }
    const ordina = (m) =>
      Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
    const titoli = Array.from(document.querySelectorAll("h1,h2,h3,h4")).map(
      (h) => `${h.tagName} ${h.textContent.trim().slice(0, 50)}`,
    );
    return {
      altezzaPagina: document.documentElement.scrollHeight,
      scrollOrizzontale: document.documentElement.scrollWidth > window.innerWidth,
      fontSize: ordina(fontSize),
      famiglie: ordina(famiglie),
      radius: ordina(radius),
      ombre: ordina(ombre),
      sfondi: ordina(sfondi),
      colori: ordina(testi),
      testiSotto13px: piccoli,
      targetSotto44px: targetPiccoli,
      h1: document.querySelectorAll("h1").length,
      titoli,
    };
  });
}

const risultati = {};
const axeRisultati = {};

for (const [nome, url] of PAGINE) {
  risultati[nome] = { url };
  for (const w of LARGHEZZE) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: w < 768 ? 667 : 900 },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await ctx.newPage();
    const risposta = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 60000 });
    // Lascia finire eventuali reveal allo scroll prima dello screenshot.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/${nome}-${w}.png`, fullPage: true });
    risultati[nome][w] = { stato: risposta?.status() ?? 0, ...(await inventario(page)) };
    if (w === 375 || w === 1280) {
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      axeRisultati[`${nome}@${w}`] = axe.violations.map((v) => ({
        id: v.id,
        impatto: v.impact,
        descrizione: v.help,
        nodi: v.nodes.length,
        esempi: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      }));
    }
    await ctx.close();
  }
  process.stdout.write(`${nome.padEnd(22)} ok\n`);
}

await browser.close();
await writeFile(`${DIR}/inventario.json`, JSON.stringify(risultati, null, 2));
await writeFile(`${DIR}/axe.json`, JSON.stringify(axeRisultati, null, 2));

// ── Riepilogo leggibile ─────────────────────────────────────────────────────
const unione = (chiave) => {
  const tot = new Map();
  for (const p of Object.values(risultati))
    for (const w of LARGHEZZE)
      for (const [k, n] of Object.entries(p[w]?.[chiave] ?? {})) tot.set(k, (tot.get(k) ?? 0) + n);
  return [...tot.entries()].sort((a, b) => b[1] - a[1]);
};
const righe = [];
righe.push(`# Audit di design — ${FASE}\n`);
righe.push(`Base: ${BASE} · ${PAGINE.length} pagine × ${LARGHEZZE.join("/")} px\n`);
for (const [etichetta, chiave] of [
  ["Font-size distinti", "fontSize"],
  ["Famiglie di font", "famiglie"],
  ["Border-radius distinti", "radius"],
  ["Ombre distinte", "ombre"],
  ["Colori di sfondo distinti", "sfondi"],
  ["Colori di testo distinti", "colori"],
]) {
  const u = unione(chiave);
  righe.push(`## ${etichetta}: ${u.length}\n`);
  righe.push(u.map(([k, n]) => `- \`${k}\` × ${n}`).join("\n") + "\n");
}
righe.push(`## Altezza pagina (px) e testi sotto i 13 px\n`);
righe.push(`| Pagina | 375 | 768 | 1280 | 1440 | <13px @375 | target<44 @375 | H1 |`);
righe.push(`|---|---|---|---|---|---|---|---|`);
for (const [nome] of PAGINE) {
  const p = risultati[nome];
  righe.push(
    `| ${nome} | ${p[375].altezzaPagina} | ${p[768].altezzaPagina} | ${p[1280].altezzaPagina} | ${p[1440].altezzaPagina} | ${p[375].testiSotto13px.length} | ${p[375].targetSotto44px.length} | ${p[1280].h1} |`,
  );
}
righe.push(`\n## Violazioni axe (serious/critical)\n`);
for (const [k, v] of Object.entries(axeRisultati)) {
  const gravi = v.filter((x) => x.impatto === "serious" || x.impatto === "critical");
  if (gravi.length)
    righe.push(`- **${k}**: ` + gravi.map((g) => `${g.id} (${g.nodi})`).join(", "));
}
const totGravi = Object.values(axeRisultati)
  .flat()
  .filter((x) => x.impatto === "serious" || x.impatto === "critical").length;
righe.push(`\nTotale violazioni serious/critical: ${totGravi}`);
await writeFile(`${DIR}/riepilogo.md`, righe.join("\n"));
console.log(`\nScritto in ${DIR}/`);

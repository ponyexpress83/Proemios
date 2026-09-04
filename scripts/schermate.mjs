/**
 * Screenshot delle pagine principali, desktop e mobile, per la verifica visiva.
 *
 *   npm run anteprima && npm run schermate
 *   SHOT=/tmp/x BASE=http://localhost:3000 node scripts/schermate.mjs
 */
import { chromium } from "@playwright/test";
const dir = process.env.SHOT ?? ".schermate";
await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
const BASE = process.env.BASE ?? "http://localhost:3114";
const pagine = [
  ["home", "/"],
  ["percorsi", "/percorsi"],
  ["percorso", "/percorsi/ho-gia-scritto-il-libro"],
  ["servizi", "/servizi"],
  ["servizio", "/servizi/correzione-bozze"],
  ["preventivo", "/preventivo"],
  ["come-funziona", "/come-funziona"],
];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
for (const [nome, url] of pagine) {
  await p.goto((process.env.BASE ?? "http://localhost:3114") + url, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${dir}/${nome}.png`, fullPage: false });
}
// mobile
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE + "/", { waitUntil: "networkidle" });
await m.screenshot({ path: `${dir}/home-mobile.png` });
await b.close();
console.log("ok");

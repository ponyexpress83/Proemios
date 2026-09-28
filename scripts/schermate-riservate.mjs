/**
 * Screenshot delle schermate riservate, per la verifica visiva.
 * Richiede sessioni già create in database (vedi docs/OPERATIONS.md).
 *
 *   BASE=http://localhost:3150 SHOT=/tmp/x node scripts/schermate-riservate.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { opzioniBrowser } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3150";
const dir = process.env.SHOT ?? ".schermate";
await mkdir(dir, { recursive: true });

const SESSIONI = [
  { nome: "admin", token: "s-finance", pagine: [["cruscotto", "/admin"], ["progetti", "/admin/progetti"], ["clienti", "/admin/clienti"], ["crm", "/admin/crm"]] },
  { nome: "cliente", token: "s-cliente.demo", pagine: [["area", "/area"]] },
  { nome: "redattore", token: "s-redattore.demo", pagine: [["cruscotto", "/admin"], ["progetti", "/admin/progetti"]] },
];

const browser = await chromium.launch({
  ...opzioniBrowser(),
});

for (const s of SESSIONI) {
  const contesto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await contesto.addCookies([
    {
      name: "authjs.session-token",
      value: s.token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await contesto.newPage();
  for (const [nome, url] of s.pagine) {
    // `networkidle` non si stabilizza quando una richiesta esterna resta appesa
    // (in questo ambiente l'uscita verso internet è filtrata): basta `load`.
    const risposta = await page.goto(BASE + url, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/${s.nome}-${nome}.png` });
    console.log(`${s.nome}${url}`.padEnd(34), risposta?.status(), page.url().replace(BASE, ""));
  }
  await contesto.close();
}

await browser.close();

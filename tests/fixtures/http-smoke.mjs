import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Run after npm run build. This server is isolated from all production integrations.
const port = 3103;
const origin = `http://127.0.0.1:${port}`;
const isolatedEnv = { ...process.env, DEMO_MODE: "on" };
for (const key of ["DATABASE_URL", "ANTHROPIC_API_KEY", "RESEND_API_KEY", "STRIPE_SECRET_KEY"])
  delete isolatedEnv[key];
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    env: isolatedEnv,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (data) => {
  logs += data;
});
child.stderr.on("data", (data) => {
  logs += data;
});
const results = [];
try {
  for (let i = 0; !logs.includes("Ready") && i < 100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(logs.includes("Ready"), "Server did not become ready");
  const routes = new Set([
    "/",
    "/servizi",
    "/percorsi",
    "/blog",
    "/come-funziona",
    "/contatti?motivo=editor",
    "/per-agenzie",
    "/analisi-manoscritto",
    "/preventivo",
    "/accedi",
    "/area-autore",
    "/privacy",
    "/termini",
    "/cookie",
    "/sitemap.xml",
  ]);
  for (const route of routes) {
    const response = await fetch(origin + route);
    const html = await response.text();
    if (response.status !== 200) console.error(logs.slice(-2500));
    assert.equal(response.status, 200, route);
    results.push({ method: "GET", route, status: response.status });
    if (["/", "/servizi", "/percorsi", "/blog"].includes(route)) {
      for (const [, link] of html.matchAll(/href="(\/[a-zA-Z0-9/?=,%&._-]*)"/g)) {
        const path = link.replaceAll("&amp;", "&").split("?")[0];
        if (
          !path.startsWith("/_next") &&
          !/\.(svg|webp|woff2|png)$/.test(path) &&
          !path.startsWith("/admin")
        )
          routes.add(path);
      }
    }
    if (route === "/percorsi/storia-impresa")
      assert.ok(html.includes("I materiali da cui partire"));
    // Demo previews are deliberately excluded from indexing.
    if (route === "/sitemap.xml" && html.includes("<loc>"))
      assert.ok(html.includes("/percorsi/storia-impresa"));
  }
  async function post(route, body, expectedStatus, demo = false) {
    const response = await fetch(origin + route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, expectedStatus, route + JSON.stringify(data));
    if (demo) assert.equal(data.demo, true);
    results.push({ method: "POST", route, status: response.status, demo: data.demo === true });
    return data;
  }
  const contact = {
    nome: "Verifica sintetica",
    email: "qa@example.test",
    messaggio: "Questo messaggio sintetico verifica il flusso dimostrativo.",
    consensoPrivacy: true,
    consensoMarketing: false,
  };
  await post("/api/contatto", contact, 200, true);
  await post("/api/contatto", { ...contact, consensoPrivacy: false }, 422);
  const agency = {
    nomeAgenzia: "Agenzia sintetica QA",
    referente: "Verifica sintetica",
    email: "qa@example.test",
    consensoPrivacy: true,
  };
  await post("/api/agenzie", agency, 200, true);
  await post("/api/agenzie", { ...agency, email: "non-valida" }, 422);
  const quote = {
    input: {
      projectType: "libro-professionale",
      textState: "finito-da-revisionare",
      wordCount: 50000,
      requestedServices: ["proofreading", "cover"],
      urgency: "standard",
    },
    contatto: {
      nome: contact.nome,
      email: contact.email,
      consensoPrivacy: true,
      consensoMarketing: false,
      note: "Storia di impresa: verifica sintetica",
    },
  };
  await post("/api/preventivo", quote, 200, true);
  await post("/api/preventivo", { ...quote, input: { ...quote.input, wordCount: -1 } }, 422);
  const report = {
    date: new Date().toISOString(),
    mode: "DEMO_MODE=on, integration variables absent",
    getRoutes: results.filter((r) => r.method === "GET").length,
    requests: results,
  };
  await writeFile(
    "docs/qa/proemios-20261006/http-smoke.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `HTTP smoke: ${results.length} richieste PASS (${report.getRoutes} pagine, 6 POST). Nessuna email o transazione reale.`,
  );
} finally {
  child.kill("SIGTERM");
}

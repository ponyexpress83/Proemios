import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * L'idempotenza della coda e la ripresa manuale sono in tensione fra loro, e
 * sbagliarla non si vede senza una coda vera: con la chiave sul solo `jobId`,
 * rimettere in coda un Job fallito produceva un evento che Inngest scartava
 * come doppione. Il Job tornava `queued` e ci restava per sempre, mentre
 * l'interfaccia mostrava un pulsante «Riprova» che non faceva niente.
 */

const ambiente = { ...process.env };
beforeEach(() => {
  process.env.INNGEST_EVENT_KEY = "chiave-di-test";
});
afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, ambiente);
  vi.restoreAllMocks();
});

describe("chiave di idempotenza", () => {
  it("comprende la ripresa, non solo il Job", () => {
    const sorgente = readFileSync(
      path.join(process.cwd(), "lib/lavori/funzioni.ts"),
      "utf8",
    );
    const riga = sorgente.split("\n").find((r) => r.includes("idempotency:"));
    expect(riga, "la funzione deve dichiarare un'idempotenza").toBeTruthy();
    expect(riga).toContain("event.data.jobId");
    expect(riga, "senza la ripresa, un ritentativo manuale viene scartato").toContain(
      "event.data.ripresa",
    );
  });
});

describe("accodaElaborazione", () => {
  async function conSpia() {
    vi.resetModules();
    const modulo = await import("@/lib/lavori/client");
    const spia = vi.spyOn(modulo.inngest, "send").mockResolvedValue({ ids: [] });
    return { modulo, spia };
  }

  it("manda sempre `ripresa`, così la chiave di idempotenza è completa", async () => {
    const { modulo, spia } = await conSpia();
    await modulo.accodaElaborazione({ jobId: "j1", organizationId: "o1" });
    const inviato = spia.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(inviato.data).toHaveProperty("ripresa");
  });

  it("l'avvio normale usa 0: due eventi accidentali restano una sola elaborazione", async () => {
    const { modulo, spia } = await conSpia();
    await modulo.accodaElaborazione({ jobId: "j1", organizationId: "o1" });
    await modulo.accodaElaborazione({ jobId: "j1", organizationId: "o1" });
    const chiavi = spia.mock.calls.map((c) => {
      const e = c[0] as { data: { jobId: string; ripresa: number } };
      return `${e.data.jobId}/${e.data.ripresa}`;
    });
    expect(chiavi[0]).toBe("j1/0");
    expect(chiavi[1], "due avvii identici devono collassare").toBe(chiavi[0]);
  });

  it("una ripresa dichiarata produce una chiave diversa, quindi riesegue", async () => {
    const { modulo, spia } = await conSpia();
    await modulo.accodaElaborazione({ jobId: "j1", organizationId: "o1" });
    await modulo.accodaElaborazione({ jobId: "j1", organizationId: "o1", ripresa: 1_700_000 });
    const chiavi = spia.mock.calls.map((c) => {
      const e = c[0] as { data: { jobId: string; ripresa: number } };
      return `${e.data.jobId}/${e.data.ripresa}`;
    });
    expect(chiavi[1]).not.toBe(chiavi[0]);
  });

  it("senza coda configurata non finge di aver accodato", async () => {
    delete process.env.INNGEST_EVENT_KEY;
    // `NODE_ENV` è di sola lettura nei tipi di Node: si scrive dall'oggetto.
    Object.assign(process.env, { NODE_ENV: "production" });
    vi.resetModules();
    const modulo = await import("@/lib/lavori/client");
    const spia = vi.spyOn(modulo.inngest, "send").mockResolvedValue({ ids: [] });
    expect(await modulo.accodaElaborazione({ jobId: "j1", organizationId: "o1" })).toBe(false);
    expect(spia).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from "vitest";
import {
  SEQUENZA_FUNNEL,
  STATI_LEAD,
  TRANSIZIONI,
  statiRaggiungibili,
  transizioneAmmessa,
  type StatoLead,
} from "@/lib/crm/pipeline";

describe("pipeline commerciale", () => {
  it("definisce le transizioni per ogni stato", () => {
    for (const s of STATI_LEAD) expect(TRANSIZIONI[s]).toBeDefined();
  });

  it("non ammette transizioni verso stati inesistenti", () => {
    const validi = new Set<string>(STATI_LEAD);
    for (const s of STATI_LEAD) {
      for (const a of TRANSIZIONI[s]) expect(validi.has(a), `${s} → ${a}`).toBe(true);
    }
  });

  it("non ammette una transizione verso sé stessi", () => {
    for (const s of STATI_LEAD) expect(TRANSIZIONI[s]).not.toContain(s);
  });

  it("impedisce i salti che falserebbero il funnel", () => {
    // Un lead che passa da "nuovo" a "cliente" senza qualificazione rende il
    // tasso di conversione una misura di niente.
    expect(transizioneAmmessa("nuovo", "cliente")).toBe(false);
    expect(transizioneAmmessa("nuovo", "proposta")).toBe(false);
    expect(transizioneAmmessa("qualificato", "cliente")).toBe(false);
  });

  it("ammette il percorso completo, un passo per volta", () => {
    const percorso: StatoLead[] = ["nuovo", "qualificato", "call", "proposta", "cliente", "produzione", "post_pubblicazione"];
    for (let i = 0; i < percorso.length - 1; i++) {
      expect(transizioneAmmessa(percorso[i]!, percorso[i + 1]!), `${percorso[i]} → ${percorso[i + 1]}`).toBe(true);
    }
  });

  it("consente di perdere un lead da qualunque stadio commerciale", () => {
    for (const s of ["nuovo", "qualificato", "call", "proposta", "cliente"] as StatoLead[]) {
      expect(transizioneAmmessa(s, "perso"), s).toBe(true);
    }
  });

  it("da perso si può solo riaprire", () => {
    expect(statiRaggiungibili("perso")).toEqual(["nuovo"]);
  });

  it("post_pubblicazione è terminale", () => {
    expect(statiRaggiungibili("post_pubblicazione")).toEqual([]);
  });

  it("la sequenza del funnel contiene solo stati validi e non include perso", () => {
    for (const s of SEQUENZA_FUNNEL) expect(STATI_LEAD).toContain(s);
    expect(SEQUENZA_FUNNEL).not.toContain("perso");
  });
});

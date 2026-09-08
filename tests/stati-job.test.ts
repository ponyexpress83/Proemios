import { describe, it, expect } from "vitest";
import {
  PERMESSO_PER_TRANSIZIONE,
  STATI_JOB,
  TRANSIZIONI_JOB,
  isTerminale,
  puoEssereConsegnato,
  statiRaggiungibili,
  transizioneAmmessa,
  type StatoJob,
} from "@/lib/produzione/stati";

describe("macchina a stati del Job — struttura", () => {
  it("copre tutti gli stati", () => {
    for (const s of STATI_JOB) expect(TRANSIZIONI_JOB[s]).toBeDefined();
  });

  it("non ammette transizioni verso stati inesistenti", () => {
    const validi = new Set<string>(STATI_JOB);
    for (const s of STATI_JOB) {
      for (const a of TRANSIZIONI_JOB[s]) expect(validi.has(a), `${s} → ${a}`).toBe(true);
    }
  });

  it("nessuno stato transisce in sé stesso", () => {
    for (const s of STATI_JOB) expect(TRANSIZIONI_JOB[s]).not.toContain(s);
  });

  it("delivered e cancelled sono terminali", () => {
    expect(isTerminale("delivered")).toBe(true);
    expect(isTerminale("cancelled")).toBe(true);
    // Un rifacimento è un Job nuovo: la storia di ciò che è stato consegnato
    // non si riscrive.
    expect(statiRaggiungibili("delivered")).toEqual([]);
  });
});

describe("il vincolo centrale — niente consegna senza doppia approvazione", () => {
  it("non esiste alcuna transizione diretta verso delivered che salti approved", () => {
    for (const s of STATI_JOB) {
      if (s === "approved") continue;
      expect(TRANSIZIONI_JOB[s], `${s} → delivered`).not.toContain("delivered");
    }
  });

  it("ad approved si arriva solo da editorially_approved", () => {
    const provenienze = STATI_JOB.filter((s) => TRANSIZIONI_JOB[s].includes("approved"));
    expect(provenienze).toEqual(["editorially_approved"]);
  });

  it("non si salta la revisione: da running non si va ad approvato", () => {
    expect(transizioneAmmessa("running", "editorially_approved")).toBe(false);
    expect(transizioneAmmessa("running", "approved")).toBe(false);
    expect(transizioneAmmessa("running", "delivered")).toBe(false);
    expect(transizioneAmmessa("queued", "delivered")).toBe(false);
  });

  it("il percorso completo è percorribile un passo per volta", () => {
    const percorso: StatoJob[] = [
      "queued",
      "running",
      "needs_review",
      "editorially_approved",
      "approved",
      "delivered",
    ];
    for (let i = 0; i < percorso.length - 1; i++) {
      expect(
        transizioneAmmessa(percorso[i]!, percorso[i + 1]!),
        `${percorso[i]} → ${percorso[i + 1]}`,
      ).toBe(true);
    }
  });

  it("puoEssereConsegnato rifiuta un Job senza le due approvazioni", () => {
    const base = { stato: "approved" as StatoJob, approvatoEditorialmenteAt: new Date(), approvatoAt: new Date() };
    expect(puoEssereConsegnato(base).ok).toBe(true);

    const senzaEditoriale = puoEssereConsegnato({ ...base, approvatoEditorialmenteAt: null });
    expect(senzaEditoriale.ok).toBe(false);
    expect(senzaEditoriale.ok === false && senzaEditoriale.motivo).toMatch(/editoriale/);

    const senzaOperativa = puoEssereConsegnato({ ...base, approvatoAt: null });
    expect(senzaOperativa.ok).toBe(false);
    expect(senzaOperativa.ok === false && senzaOperativa.motivo).toMatch(/operativa/);

    const statoSbagliato = puoEssereConsegnato({ ...base, stato: "needs_review" });
    expect(statoSbagliato.ok).toBe(false);
  });
});

describe("permessi delle transizioni", () => {
  it("l'approvazione editoriale e la consegna richiedono permessi diversi", () => {
    // È la separazione che impedisce a chi approva il contenuto di spedirlo.
    expect(PERMESSO_PER_TRANSIZIONE.editorially_approved).toBe("job.approva_editorialmente");
    expect(PERMESSO_PER_TRANSIZIONE.delivered).toBe("progetto.consegna_al_cliente");
    expect(PERMESSO_PER_TRANSIZIONE.editorially_approved).not.toBe(
      PERMESSO_PER_TRANSIZIONE.delivered,
    );
  });

  it("gli stati raggiunti dal worker non richiedono un permesso umano", () => {
    expect(PERMESSO_PER_TRANSIZIONE.running).toBeNull();
    expect(PERMESSO_PER_TRANSIZIONE.needs_review).toBeNull();
    expect(PERMESSO_PER_TRANSIZIONE.failed).toBeNull();
  });
});

describe("errori e ritentativi", () => {
  it("un Job fallito si può rimettere in coda", () => {
    expect(transizioneAmmessa("failed", "queued")).toBe(true);
  });

  it("un Job in revisione può tornare in lavorazione (rigenerazione)", () => {
    expect(transizioneAmmessa("needs_review", "running")).toBe(true);
  });

  it("un Job approvato può tornare indietro finché non è consegnato", () => {
    expect(transizioneAmmessa("approved", "needs_review")).toBe(true);
    expect(transizioneAmmessa("editorially_approved", "needs_review")).toBe(true);
  });

  it("ogni stato non terminale può essere annullato", () => {
    for (const s of STATI_JOB) {
      if (isTerminale(s)) continue;
      expect(TRANSIZIONI_JOB[s], s).toContain("cancelled");
    }
  });
});

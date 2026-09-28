import { describe, it, expect } from "vitest";
import { componiNotifica, TIPI_NOTIFICA } from "@/lib/notifiche/tipi";

describe("catalogo delle notifiche", () => {
  it("ogni tipo ha un modello", () => {
    for (const tipo of TIPI_NOTIFICA) {
      const m = componiNotifica(tipo);
      expect(m.titolo.length).toBeGreaterThan(0);
      expect(m.corpo.length).toBeGreaterThan(0);
    }
  });

  it("porta sempre a un percorso interno, mai a un URL", () => {
    // Una notifica che porta fuori dal prodotto è phishing con il nostro nome.
    for (const tipo of TIPI_NOTIFICA) {
      const m = componiNotifica(tipo, { progettoId: "abc", jobId: "def" });
      expect(m.percorso.startsWith("/")).toBe(true);
      expect(m.percorso.startsWith("//")).toBe(false);
      expect(m.percorso).not.toMatch(/^https?:/);
    }
  });

  it("le notifiche al cliente non nominano la lavorazione interna", () => {
    const vietate = [
      "job",
      "intervento",
      "modello",
      "provider",
      "run",
      "needs_review",
      "editorially_approved",
      "token",
    ];
    for (const tipo of TIPI_NOTIFICA) {
      const m = componiNotifica(tipo, { progettoTitolo: "Il mare d'inverno" });
      if (m.destinazione !== "cliente") continue;
      const testo = `${m.titolo} ${m.corpo}`.toLowerCase();
      for (const parola of vietate) {
        expect(testo, `«${tipo}» nomina «${parola}»`).not.toContain(parola);
      }
    }
  });

  it("usa il titolo del progetto quando c'è, e un fallback quando manca", () => {
    const con = componiNotifica("consegna.pronta", { progettoTitolo: "Il mare d'inverno" });
    expect(con.corpo).toContain("Il mare d'inverno");
    // Senza contesto non si tace: si degrada a un testo generico.
    const senza = componiNotifica("consegna.pronta");
    expect(senza.corpo).toContain("il tuo progetto");
  });

  it("manda l'email solo per ciò che merita di interrompere qualcuno", () => {
    // Un messaggio in una conversazione già aperta non vale un'email.
    expect(componiNotifica("messaggio.ricevuto").email).toBe(false);
    // Una consegna o una rata in scadenza sì.
    expect(componiNotifica("consegna.pronta").email).toBe(true);
    expect(componiNotifica("pagamento.dovuto").email).toBe(true);
  });

  it("le notifiche allo staff portano nel back-office, quelle al cliente nell'area", () => {
    for (const tipo of TIPI_NOTIFICA) {
      const m = componiNotifica(tipo, { progettoId: "p1", jobId: "j1" });
      if (m.destinazione === "cliente") {
        expect(m.percorso.startsWith("/area")).toBe(true);
      } else {
        expect(m.percorso.startsWith("/admin") || m.percorso.startsWith("/redazione")).toBe(true);
      }
    }
  });

  it("l'importo compare nel testo quando è noto", () => {
    const m = componiNotifica("pagamento.dovuto", {
      importo: "€ 1.200",
      ordineCodice: "O-2026-0007",
    });
    expect(m.corpo).toContain("€ 1.200");
    expect(m.corpo).toContain("O-2026-0007");
  });
});

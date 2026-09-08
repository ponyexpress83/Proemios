import { describe, it, expect } from "vitest";
import { brandingValido, nomeVisibile, variabiliStile } from "@/lib/branding";

describe("colore di identità", () => {
  it("accetta gli esadecimali nelle tre lunghezze", () => {
    for (const c of ["#fff", "#6c4bff", "#6c4bffcc"]) {
      expect(brandingValido({ coloreIdentita: c }).ok, c).toBe(true);
    }
  });

  it("rifiuta tutto ciò che non è un esadecimale", () => {
    // Questo valore finisce in una <style>: chiudere la regola e aprirne
    // un'altra è banale se il controllo non c'è.
    for (const c of [
      "red",
      "rgb(255,0,0)",
      "red; } body { display: none",
      "url(https://tracker.invalid/pixel)",
      "#xyzxyz",
      "javascript:alert(1)",
      "#6c4bff; background: url(//x)",
    ]) {
      const esito = brandingValido({ coloreIdentita: c });
      expect(esito.ok, `«${c}» non doveva passare`).toBe(false);
    }
  });

  it("normalizza in minuscolo", () => {
    const esito = brandingValido({ coloreIdentita: "#6C4BFF" });
    expect(esito.ok && esito.branding.coloreIdentita).toBe("#6c4bff");
  });
});

describe("variabili di stile", () => {
  it("emette le variabili solo per un colore valido", () => {
    expect(variabiliStile({ coloreIdentita: "#6c4bff" })).toEqual({
      "--color-viola": "#6c4bff",
      "--color-viola-chiaro": "#6c4bff",
    });
    expect(variabiliStile(null)).toEqual({});
    expect(variabiliStile({})).toEqual({});
  });

  it("non emette niente per un valore malevolo, nemmeno se già in database", () => {
    // Ricontrolla anche ciò che è già passato dalla validazione: è l'ultima
    // riga prima che una stringa diventi CSS.
    for (const veleno of [
      "red; } body { display: none",
      "</style><script>alert(1)</script>",
      "url(https://tracker.invalid/p)",
      "var(--x)",
    ]) {
      expect(variabiliStile({ coloreIdentita: veleno })).toEqual({});
    }
  });
});

describe("logo", () => {
  it("accetta solo https", () => {
    expect(brandingValido({ logoUrl: "https://cdn.esempio.it/logo.svg" }).ok).toBe(true);
    expect(brandingValido({ logoUrl: "http://cdn.esempio.it/logo.svg" }).ok).toBe(false);
    expect(brandingValido({ logoUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(brandingValido({ logoUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" }).ok).toBe(
      false,
    );
    expect(brandingValido({ logoUrl: "non un url" }).ok).toBe(false);
  });

  it("rifiuta le credenziali nell'URL", () => {
    expect(brandingValido({ logoUrl: "https://utente:segreto@cdn.esempio.it/l.png" }).ok).toBe(
      false,
    );
  });
});

describe("nome, dominio, mittente", () => {
  it("tronca un nome smisurato invece di rifiutarlo", () => {
    const esito = brandingValido({ nomeVisualizzato: "A".repeat(500) });
    expect(esito.ok && esito.branding.nomeVisualizzato!.length).toBe(60);
  });

  it("valida il dominio", () => {
    expect(brandingValido({ dominio: "agenzia.it" }).ok).toBe(true);
    expect(brandingValido({ dominio: "sotto.agenzia.co.uk" }).ok).toBe(true);
    expect(brandingValido({ dominio: "https://agenzia.it" }).ok).toBe(false);
    expect(brandingValido({ dominio: "agenzia" }).ok).toBe(false);
    expect(brandingValido({ dominio: "-agenzia.it" }).ok).toBe(false);
  });

  it("valida il mittente", () => {
    expect(brandingValido({ emailMittente: "ciao@agenzia.it" }).ok).toBe(true);
    expect(brandingValido({ emailMittente: "ciao@agenzia" }).ok).toBe(false);
    expect(brandingValido({ emailMittente: "Nome <ciao@agenzia.it>" }).ok).toBe(false);
  });

  it("restituisce solo i campi validati, non l'input intero", () => {
    const esito = brandingValido({
      coloreIdentita: "#000000",
      nomeVisualizzato: "  Agenzia  ",
      // Campo non previsto: non deve arrivare in database.
      ...({ script: "<script>alert(1)</script>" } as Record<string, string>),
    });
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(Object.keys(esito.branding).sort()).toEqual(["coloreIdentita", "nomeVisualizzato"]);
      expect(esito.branding.nomeVisualizzato).toBe("Agenzia");
    }
  });
});

describe("marchio invisibile", () => {
  it("usa il nome dell'agenzia quando c'è", () => {
    expect(nomeVisibile({ nomeVisualizzato: "Aurora" }, false, "Proemios")).toBe("Aurora");
  });

  it("con proemiosInvisibile non ripiega sul nostro nome", () => {
    // È la promessa commerciale del white label: vale anche nei posti che
    // sembrano innocui, come il titolo di una pagina.
    expect(nomeVisibile(null, true, "Proemios")).toBe("");
    expect(nomeVisibile({}, true, "Proemios")).toBe("");
  });

  it("senza white label mostra il nostro nome", () => {
    expect(nomeVisibile(null, false, "Proemios")).toBe("Proemios");
  });
});

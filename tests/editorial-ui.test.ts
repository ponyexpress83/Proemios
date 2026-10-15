// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "@/components/editorial/proemios";
import { Configuratore } from "@/components/preventivo/configuratore";
import { AuthorWorkspace } from "@/components/author/workspace";
import { DemoLogin } from "@/components/author/demo-login";
import { DEMO_SESSION_KEY } from "@/lib/author-demo";
import { BookPath } from "@/components/editorial/book-path";
import { reportDemo } from "@/lib/demo";
import { calcolaMetriche } from "@/lib/metrics";

vi.mock("next/dynamic", async () => {
  const assistantModule = await import("@/components/editorial/quote-assistant");
  return { default: () => assistantModule.default };
});
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", props),
}));
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("interazioni della homepage", () => {
  it("ricava il preventivo da un unico brief completo senza inviare dati", async () => {
    render(createElement(HomePage));
    fireEvent.click(screen.getByRole("button", {name:"Calcola il preventivo"}));
    fireEvent.change(screen.getByRole("textbox", {name:"La tua risposta"}), {target:{value:"Ho scritto un romanzo finito di 50.000 parole. Voglio editing, copertina e impaginazione."}});
    fireEvent.click(screen.getByRole("button", {name:"Conferma risposta"}));
    expect(screen.getByRole("heading", {name:"Tre percorsi, una storia."})).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText(/50.000 parole/)).toBeTruthy();
  });
  it("libro e CTA aprono lo stesso assistente, preservano le risposte e restituiscono il focus", async () => {
    render(createElement(HomePage));
    const cta = screen.getByRole("button", { name: "Calcola il preventivo" });
    fireEvent.click(cta);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await waitFor(() => expect(document.activeElement?.id).toBe("assistant-input"));
    fireEvent.click(screen.getByRole("button", { name: /Preferisco il percorso guidato/ }));
    fireEvent.click(screen.getByRole("button", { name: "Romanzo" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(cta);
    const book = screen.getByRole("button", {
      name: "Apri l’assistente per il preventivo del tuo libro",
    });
    fireEvent.click(book);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "A che punto è il testo?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Romanzo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chiudi assistente" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(book);
  });
  it("reduced motion offre sei scene statiche selezionabili senza autoplay", () => {
    const change = vi.fn();
    render(createElement(BookPath, { hovered: false, onStageChange: change }));
    expect(document.querySelector(".editorial-story")?.getAttribute("data-motion")).toBe("reduced");
    expect(screen.queryByRole("button", { name: "Pausa" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Copertina:/ }));
    expect(change).toHaveBeenLastCalledWith(3);
    expect(document.querySelector(".editorial-story")?.getAttribute("data-playback")).toBe(
      "paused",
    );
  });
});
describe("preventivatore in tre momenti", () => {
  const precompilato = {
    tipo: "romanzo" as const,
    statoTesto: "finito-da-revisionare" as const,
    parole: 50000,
    servizi: ["cover" as const],
    contesto: "Storia di lavoro",
  };
  function next() {
    fireEvent.click(screen.getByRole("button", { name: /Avanti →|Salva la modifica →/ }));
  }
  it("chiede solo i dati mancanti e arriva alla proposta senza upload né contatti inviati", () => {
    const network = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", network);
    render(createElement(Configuratore, { precompilato, demoMode: true }));
    // Tipo, testo, parole e servizi arrivano dall'assistente: resta solo la scadenza.
    expect(screen.getByRole("heading", { name: "Hai una scadenza?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Romanzo.*modifica/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /50.000 parole.*modifica/ })).toBeTruthy();
    next();
    expect(screen.getByRole("heading", { name: "La tua proposta" })).toBeTruthy();
    expect(screen.getByLabelText(/^Nome/)).toBeTruthy();
    expect(network.mock.calls.every((c) => String(c[0]).includes("/api/eventi"))).toBe(true);
    // Una risposta si modifica dai riepiloghi senza perdere le altre.
    fireEvent.click(screen.getByRole("button", { name: /Copertina.*modifica/ }));
    expect(screen.getByRole("heading", { name: "Di quali servizi hai bisogno?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copertina/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Percorso completo" }));
    fireEvent.click(screen.getByRole("button", { name: /Editing/ }));
    next();
    expect(screen.getByRole("heading", { name: "La tua proposta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copertina, Editing.*modifica/ })).toBeTruthy();
  });
  it("conta le parole dal testo incollato senza inviarlo e offre la valutazione facoltativa", () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    render(createElement(Configuratore, { precompilato: { tipo: "romanzo", statoTesto: "finito-da-revisionare" }, demoMode: true }));
    expect(screen.getByRole("heading", { name: "Quanto sarà lungo il libro?" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Incolla il testo"), { target: { value: "Una frase di prova con sette parole qui." } });
    expect((screen.getByLabelText("Oppure indica il numero preciso") as HTMLInputElement).value).toBe("8");
    expect(screen.getByRole("button", { name: "Aggiungi la valutazione facoltativa" })).toBeTruthy();
    expect(network.mock.calls.filter((c) => !String(c[0]).includes("/api/eventi"))).toHaveLength(0);
    expect(screen.queryByLabelText(/^Nome/)).toBeNull();
    next();
    expect(screen.getByRole("heading", { name: "Di quali servizi hai bisogno?" })).toBeTruthy();
  });
  it("ritorna dal report mantenendo servizi, lunghezza e contesto", async () => {
    const report = reportDemo(calcolaMetriche("La barca tornò al molo. Il vento era caduto. ".repeat(25)));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ report, demo: true }) }));
    render(createElement(Configuratore, { precompilato: { ...precompilato, parole: undefined }, demoMode: true }));
    expect(screen.getByRole("heading", { name: "Quanto sarà lungo il libro?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi la valutazione facoltativa" }));
    fireEvent.change(screen.getByLabelText("File del manoscritto"), { target: { files: [new File(["test sintetico"], "test.txt")] } });
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Autore test" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "qa@example.test" } });
    fireEvent.click(document.getElementById("an-privacy")!);
    fireEvent.click(screen.getByRole("button", { name: "Analizza il manoscritto" }));
    await screen.findByRole("button", { name: "Torna al tuo preventivo →" });
    fireEvent.click(screen.getByRole("button", { name: "Torna al tuo preventivo →" }));
    expect(screen.getByRole("heading", { name: "Hai una scadenza?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copertina.*modifica/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← Indietro" }));
    expect(screen.getByRole("heading", { name: "Di quali servizi hai bisogno?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copertina/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "← Indietro" }));
    expect(screen.getByRole("button", { name: "Torna al tuo preventivo →" })).toBeTruthy();
    expect((screen.getByLabelText("Oppure indica il numero preciso") as HTMLInputElement).value).toBe("50000");
    fireEvent.click(screen.getByRole("button", { name: /Romanzo.*modifica/ }));
    expect((screen.getByLabelText(/Descrivi il tuo progetto/) as HTMLTextAreaElement).value).toBe("Storia di lavoro");
  });
});

describe("azioni della demo autore", () => {
  it("spiega il blocco di archiviazione senza presentarlo come un ingresso riuscito", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    render(createElement(DemoLogin));
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entra con un clic →" }));
    expect(screen.getByRole("alert").textContent).toContain("Consenti l’archiviazione");
  });
  it("messaggi, file, approvazione, fase successiva, pagamenti e ripristino restano nella demo", async () => {
    sessionStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({ user: "demo-author", createdAt: Date.now() }),
    );
    render(createElement(AuthorWorkspace));
    expect(screen.getByRole("heading", { name: /La tua storia/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Messaggi" }));
    fireEvent.change(screen.getByLabelText("Prova a scrivere al team"), {
      target: { value: "Messaggio sintetico di prova." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invia nella demo" }));
    expect(screen.getByText("Messaggio sintetico di prova.")).toBeTruthy();
    expect(screen.getByText(/Risposta simulata/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "File e revisioni" }));
    const read = screen.getAllByRole("button", { name: "Leggi" })[0]!;
    fireEvent.click(read);
    expect(screen.getByRole("dialog").textContent).toContain("Documento dimostrativo");
    fireEvent.click(screen.getByRole("button", { name: "Chiudi documento" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(read);
    fireEvent.click(screen.getByRole("button", { name: /Approvazioni/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approva la revisione" }));
    fireEvent.click(screen.getByRole("button", { name: "Conferma approvazione" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Il mio libro" }));
    expect(screen.getByText("Copertina da avviare")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pagamenti" }));
    expect(screen.getByText("Pagamento simulato: nessun addebito")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prova il riepilogo pagamento →" }));
    expect(screen.getByRole("status").textContent).toContain("non si apre alcun pagamento");
    fireEvent.click(screen.getByRole("button", { name: "Consegne" }));
    expect(screen.getByText("Consegna demo approvata")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ripristina demo" }));
    expect(screen.getByText("Disponibile per la tua revisione")).toBeTruthy();
    sessionStorage.clear();
  });
});


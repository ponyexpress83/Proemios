// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "@/components/editorial/proemios";
import { Configuratore } from "@/components/preventivo/configuratore";
import { BookPath } from "@/components/editorial/book-path";
import { reportDemo } from "@/lib/demo";
import { calcolaMetriche } from "@/lib/metrics";

vi.mock("next/dynamic", async () => {
  const module = await import("@/components/editorial/quote-assistant");
  return { default: () => module.default };
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
  it("libro e CTA aprono lo stesso assistente, preservano le risposte e restituiscono il focus", async () => {
    render(createElement(HomePage));
    const cta = screen.getByRole("button", { name: "Calcola il preventivo" });
    fireEvent.click(cta);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await waitFor(() => expect(document.activeElement?.id).toBe("assistant-input"));
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
describe("analisi integrata e brief", () => {
  const precompilato = {
    tipo: "romanzo" as const,
    statoTesto: "finito-da-revisionare" as const,
    parole: 50000,
    servizi: ["cover" as const],
    contesto: "Storia di lavoro",
  };
  function next() {
    fireEvent.click(screen.getByRole("button", { name: "Avanti →" }));
  }
  it("ottiene la stima senza upload e senza contatti", () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    render(createElement(Configuratore, { precompilato, demoMode: true }));
    next();
    next();
    next();
    expect(
      screen.getByRole("heading", { name: "Vuoi una prima valutazione del manoscritto?" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Continua senza caricare un testo →",
      })[0]!,
    );
    expect(screen.getByRole("heading", { name: "Di quali servizi hai bisogno?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copertina/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(network).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });
  it("ritorna dal report mantenendo servizi, lunghezza e contesto", async () => {
    const report = reportDemo(
      calcolaMetriche("La barca tornò al molo. Il vento era caduto. ".repeat(25)),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ report, demo: true }),
        }),
    );
    render(createElement(Configuratore, { precompilato, demoMode: true }));
    next();
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi la valutazione facoltativa" }));
    fireEvent.change(screen.getByLabelText("File del manoscritto"), {
      target: { files: [new File(["test sintetico"], "test.txt")] },
    });
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Autore test" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "qa@example.test" } });
    fireEvent.click(document.getElementById("an-privacy")!);
    fireEvent.click(screen.getByRole("button", { name: "Analizza il manoscritto" }));
    await screen.findByRole("button", { name: "Torna al tuo preventivo →" });
    fireEvent.click(screen.getByRole("button", { name: "Torna al tuo preventivo →" }));
    expect(screen.getByRole("button", { name: /Copertina/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "← Indietro" }));
    expect(screen.getByRole("button", { name: "Torna al tuo preventivo →" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← Indietro" }));
    expect(
      (screen.getByLabelText("Oppure indica il numero preciso") as HTMLInputElement).value,
    ).toBe("50000");
    fireEvent.click(screen.getByRole("button", { name: "← Indietro" }));
    fireEvent.click(screen.getByRole("button", { name: "← Indietro" }));
    expect((screen.getByLabelText(/Descrivi il tuo progetto/) as HTMLTextAreaElement).value).toBe(
      "Storia di lavoro",
    );
  });
});

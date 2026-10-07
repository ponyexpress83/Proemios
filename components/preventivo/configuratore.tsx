"use client";

import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pulsante } from "@/components/sito/pulsante";
import { Campo, Input, AreaTesto, Consenso, RiepilogoErrori } from "@/components/sito/campo";
import { Filetto } from "@/components/sito/sezione";
import { cn } from "@/lib/cn";
import { RisultatoPreventivo } from "./risultato";
import { VoiceBrief } from "./voice-brief";
import {
  TIPI_PROGETTO,
  STATI_TESTO,
  QUANTITA_MATERIALE,
  PRESET_PAROLE,
  SERVIZI,
  TEMPI,
} from "./opzioni";
import {
  computeQuote,
  type ProjectType,
  type TextState,
  type ServiceKey,
  type QuoteResult,
} from "@/lib/pricing";
import type { MaterialAmount } from "@/config/pricing";
import { PREVENTIVO, UI } from "@/config/copy";
import { euro, numero } from "@/lib/format";

/*
 * Il calcolo del prezzo, la validazione e l'invio sono quelli di sempre: questo
 * file cambia solo il modo in cui le sei domande si presentano. Le scelte
 * singole portano al passo dopo da sole; l'indicatore ha i nomi dei passi e
 * si può tornare indietro cliccandoli; l'anteprima dei prezzi resta visibile
 * — di lato da `lg` in su, in una barra fissa in basso sul telefono; il
 * pulsante finale non è mai disabilitato senza spiegare perché.
 */

interface Stato {
  tipo: ProjectType | null;
  statoTesto: TextState | null;
  parole: number;
  materiale: MaterialAmount;
  servizi: ServiceKey[];
  tempi: "standard" | "prioritaria";
  nome: string;
  email: string;
  telefono: string;
  note: string;
  consensoPrivacy: boolean;
  consensoMarketing: boolean;
}

const TOTALE_PASSI = 6;
/** Dopo una scelta singola si passa oltre, ma non prima che la scelta si veda. */
const RITARDO_AVANZAMENTO = 250;

export function Configuratore({
  precompilato,
}: {
  precompilato?: {
    tipo?: ProjectType;
    servizi?: ServiceKey[];
    parole?: number;
    statoTesto?: TextState;
    tempi?: "standard" | "prioritaria";
  };
}) {
  const [passo, setPasso] = useState(0);
  const [raggiunto, setRaggiunto] = useState(0);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState("");
  const [erroriCampi, setErroriCampi] = useState<Partial<Record<"parole" | "nome" | "email" | "privacy", string>>>({});
  const [risultato, setRisultato] = useState<{ esito: QuoteResult; quoteId: string; demo: boolean } | null>(null);
  // Honeypot: un campo che una persona non vede e non compila.
  const [trappola, setTrappola] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [s, setS] = useState<Stato>({
    tipo: precompilato?.tipo ?? null,
    statoTesto:
      precompilato?.statoTesto ?? (precompilato?.tipo === "memoir" ? "solo-materiali" : null),
    parole: precompilato?.parole ?? 50_000,
    materiale: "parziale",
    servizi: precompilato?.servizi ?? [],
    tempi: precompilato?.tempi ?? "standard",
    nome: "",
    email: "",
    telefono: "",
    note: "",
    consensoPrivacy: false,
    consensoMarketing: false,
  });

  function agg<K extends keyof Stato>(k: K, v: Stato[K]) {
    setS((prec) => ({ ...prec, [k]: v }));
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function vaiA(p: number) {
    const dest = Math.max(0, Math.min(TOTALE_PASSI - 1, p));
    setPasso(dest);
    setRaggiunto((r) => Math.max(r, dest));
    setErroriCampi({});
    setErrore("");
  }

  /** Scelta singola: registra e, dopo un attimo, passa al passo successivo. */
  function scegliEAvanza(applica: () => void) {
    applica();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => vaiA(passo + 1), RITARDO_AVANZAMENTO);
  }

  const soloMateriali = s.statoTesto === "solo-materiali";
  const soloGrafica = s.tipo === "solo-grafica";

  // Anteprima calcolata in locale: stesso motore puro del server.
  const anteprima: QuoteResult | null = useMemo(() => {
    if (!s.tipo || !s.statoTesto || s.parole < 1) return null;
    try {
      return computeQuote({
        projectType: s.tipo,
        textState: s.statoTesto,
        wordCount: s.parole,
        materialAmount: soloMateriali ? s.materiale : undefined,
        requestedServices: s.servizi,
        urgency: s.tempi,
      });
    } catch {
      return null;
    }
  }, [s, soloMateriali]);

  const puoAvanzare = useMemo(() => {
    switch (passo) {
      case 0:
        return s.tipo !== null;
      case 1:
        return s.statoTesto !== null;
      case 2:
        return s.parole > 0;
      case 3:
      case 4:
        return true;
      case 5:
        return s.nome.trim().length >= 2 && /.+@.+\..+/.test(s.email) && s.consensoPrivacy;
      default:
        return false;
    }
  }, [passo, s]);

  /** Spiega cosa manca invece di spegnere il pulsante, e porta il fuoco lì. */
  function validaEMostra(): boolean {
    const e: typeof erroriCampi = {};
    if (passo === 2 && !(s.parole > 0)) e.parole = "Indica quante parole ha il testo, anche a occhio.";
    if (passo === 5) {
      if (s.nome.trim().length < 2) e.nome = "Scrivi il tuo nome.";
      if (!/.+@.+\..+/.test(s.email)) e.email = "Inserisci la tua email per ricevere il preventivo.";
      if (!s.consensoPrivacy) e.privacy = "Serve il consenso al trattamento per ricevere il preventivo.";
    }
    setErroriCampi(e);
    const primo = Object.keys(e)[0];
    if (primo) {
      const id = { parole: "pv-parole", nome: "pv-nome", email: "pv-email", privacy: "pv-privacy" }[primo as keyof typeof e];
      requestAnimationFrame(() => document.getElementById(id ?? "")?.focus());
      return false;
    }
    return true;
  }

  async function calcola() {
    if (!s.tipo || !s.statoTesto) return;
    setInvio(true);
    setErrore("");
    try {
      const res = await fetch("/api/preventivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sito: trappola,
          input: {
            projectType: s.tipo,
            textState: s.statoTesto,
            wordCount: s.parole,
            materialAmount: soloMateriali ? s.materiale : undefined,
            requestedServices: s.servizi,
            urgency: s.tempi,
          },
          contatto: {
            nome: s.nome,
            email: s.email,
            telefono: s.telefono,
            note: s.note,
            consensoPrivacy: s.consensoPrivacy,
            consensoMarketing: s.consensoMarketing,
          },
        }),
      });
      const dati = (await res.json()) as {
        quoteId?: string;
        demo?: boolean;
        preventivo?: QuoteResult;
        errore?: string;
      };
      if (!res.ok || !dati.quoteId || !dati.preventivo) {
        throw new Error(dati.errore ?? UI.erroreGenerico);
      }
      setRisultato({ esito: dati.preventivo, quoteId: dati.quoteId, demo: dati.demo === true });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    } finally {
      setInvio(false);
    }
  }

  // ── Risultato ──────────────────────────────────────────────────────────
  if (risultato) {
    return (
      <div>
        <div className="mb-10 max-w-giustezza">
          <h2 className="font-serif text-t-xl text-inchiostro">Tre modi di fare questo libro</h2>
          <p className="mt-3 text-t-md text-grafite">
            {risultato.demo
              ? "Questo è un preventivo dimostrativo: nessuna email è stata inviata e nessun pagamento viene addebitato."
              : "Te li abbiamo mandati anche via email. Se vuoi partire, l’acconto blocca la data; se prima vuoi parlarne, rispondi a quella email."}
          </p>
        </div>
        <RisultatoPreventivo esito={risultato.esito} quoteId={risultato.quoteId} />
      </div>
    );
  }

  const erroriElenco = Object.entries(erroriCampi).map(([k, messaggio]) => ({
    id: { parole: "pv-parole", nome: "pv-nome", email: "pv-email", privacy: "pv-privacy" }[k as keyof typeof erroriCampi]!,
    messaggio: messaggio!,
  }));

  // ── Wizard ─────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[1.6fr_1fr] lg:gap-12 lg:pb-0">
      <div>
        <Indicatore passo={passo} raggiunto={raggiunto} vaiA={vaiA} />

        {passo === 0 && (
          <VoiceBrief
            initialText={s.note}
            onApply={(input, text) => {
              setS((prev) => ({
                ...prev,
                tipo: input.projectType ?? prev.tipo,
                statoTesto: input.textState ?? prev.statoTesto,
                parole: input.wordCount ?? prev.parole,
                servizi: [...new Set([...prev.servizi, ...(input.requestedServices || [])])],
                note: text,
              }));
            }}
          />
        )}

        <div className="mt-8 min-h-[20rem]">
          {/* 1 — Tipo di progetto */}
          {passo === 0 && (
            <Domanda titolo="Che libro è?">
              <Griglia>
                {TIPI_PROGETTO.map((o) => (
                  <Opzione
                    key={o.valore}
                    scelta={s.tipo === o.valore}
                    label={o.label}
                    nota={o.nota}
                    onClick={() =>
                      scegliEAvanza(() => {
                        agg("tipo", o.valore);
                        if (o.valore === "memoir" && !s.statoTesto) agg("statoTesto", "solo-materiali");
                        if (o.valore === "solo-grafica") agg("statoTesto", "finito-revisionato");
                      })
                    }
                  />
                ))}
              </Griglia>
            </Domanda>
          )}

          {/* 2 — Stato del testo */}
          {passo === 1 && (
            <Domanda titolo="A che punto è il testo?">
              <Griglia>
                {STATI_TESTO.map((o) => (
                  <Opzione
                    key={o.valore}
                    scelta={s.statoTesto === o.valore}
                    label={o.label}
                    nota={o.nota}
                    onClick={() => scegliEAvanza(() => agg("statoTesto", o.valore))}
                  />
                ))}
              </Griglia>
            </Domanda>
          )}

          {/* 3 — Dimensione */}
          {passo === 2 && (
            <Domanda
              titolo={
                soloMateriali
                  ? "Quanto lungo pensi debba essere il libro finito?"
                  : "Quante parole ha il testo?"
              }
              nota={
                soloMateriali
                  ? "Una stima basta: la definiamo insieme guardando il materiale."
                  : "Il conteggio esatto lo trovi in fondo al documento Word."
              }
            >
              <div className="flex flex-wrap gap-2" role="group" aria-label="Lunghezze frequenti">
                {PRESET_PAROLE.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => agg("parole", p)}
                    aria-pressed={s.parole === p}
                    className={cn(
                      "tabellare min-h-11 rounded-campo border px-4 text-t-sm transition-colors duration-200 ease-matita",
                      s.parole === p
                        ? "border-inchiostro bg-inchiostro text-carta"
                        : "border-filetto bg-bianco text-inchiostro hover:border-grafite",
                    )}
                  >
                    {numero(p)}
                  </button>
                ))}
              </div>

              <div className="mt-5 max-w-xs">
                <Campo id="pv-parole" label="Oppure il numero preciso" errore={erroriCampi.parole}>
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={s.parole || ""}
                      onChange={(e) => agg("parole", Number(e.target.value))}
                      className="tabellare text-t-md"
                    />
                  )}
                </Campo>
              </div>

              {soloMateriali && (
                <div className="mt-8">
                  <p className="text-t-md text-inchiostro">Quanto materiale hai già?</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {QUANTITA_MATERIALE.map((o) => (
                      <Opzione
                        key={o.valore}
                        scelta={s.materiale === o.valore}
                        label={o.label}
                        nota={o.nota}
                        onClick={() => agg("materiale", o.valore)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Domanda>
          )}

          {/* 4 — Servizi */}
          {passo === 3 && (
            <Domanda
              titolo="Cosa ti serve?"
              nota={
                soloGrafica
                  ? "Per la sola grafica contano copertina, impaginazione ed EPUB."
                  : "Seleziona quello che ti serve. Se non sei sicuro, lascia stare: i tre pacchetti propongono comunque una composizione sensata."
              }
            >
              <Griglia>
                {SERVIZI.map((o) => (
                  <Opzione
                    key={o.valore}
                    scelta={s.servizi.includes(o.valore)}
                    label={o.label}
                    nota={o.nota}
                    casella
                    onClick={() =>
                      agg(
                        "servizi",
                        s.servizi.includes(o.valore)
                          ? s.servizi.filter((x) => x !== o.valore)
                          : [...s.servizi, o.valore],
                      )
                    }
                  />
                ))}
              </Griglia>
            </Domanda>
          )}

          {/* 5 — Tempi */}
          {passo === 4 && (
            <Domanda titolo="Che tempi hai?">
              <Griglia>
                {TEMPI.map((o) => (
                  <Opzione
                    key={o.valore}
                    scelta={s.tempi === o.valore}
                    label={o.label}
                    nota={o.nota}
                    onClick={() => scegliEAvanza(() => agg("tempi", o.valore))}
                  />
                ))}
              </Griglia>
            </Domanda>
          )}

          {/* 6 — Contatto */}
          {passo === 5 && (
            <Domanda
              titolo="Dove mandiamo il preventivo?"
              nota="Il preventivo compare qui e ti arriva anche via email, così lo ritrovi quando ti serve."
            >
              <div className="space-y-5">
                {erroriElenco.length > 0 && <RiepilogoErrori errori={erroriElenco} />}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Campo id="pv-nome" label="Nome" obbligatorio errore={erroriCampi.nome}>
                    {(p) => (
                      <Input
                        {...p}
                        name="nome"
                        value={s.nome}
                        onChange={(e) => agg("nome", e.target.value)}
                        autoComplete="name"
                      />
                    )}
                  </Campo>
                  <Campo id="pv-email" label="Email" obbligatorio errore={erroriCampi.email}>
                    {(p) => (
                      <Input
                        {...p}
                        name="email"
                        type="email"
                        inputMode="email"
                        value={s.email}
                        onChange={(e) => agg("email", e.target.value)}
                        autoComplete="email"
                      />
                    )}
                  </Campo>
                </div>

                <Campo id="pv-tel" label="Telefono">
                  {(p) => (
                    <Input
                      {...p}
                      name="telefono"
                      type="tel"
                      inputMode="tel"
                      value={s.telefono}
                      onChange={(e) => agg("telefono", e.target.value)}
                      autoComplete="tel"
                    />
                  )}
                </Campo>

                <Campo id="pv-note" label="Qualcosa che dovremmo sapere">
                  {(p) => (
                    <AreaTesto
                      {...p}
                      name="note"
                      rows={3}
                      value={s.note}
                      onChange={(e) => agg("note", e.target.value)}
                    />
                  )}
                </Campo>

                <Filetto />

                <div className="hidden" aria-hidden="true">
                  <label htmlFor="pv-sito">Non compilare</label>
                  <input
                    id="pv-sito"
                    name="sito"
                    tabIndex={-1}
                    autoComplete="off"
                    value={trappola}
                    onChange={(e) => setTrappola(e.target.value)}
                  />
                </div>
                <Consenso
                  id="pv-privacy"
                  name="consensoPrivacy"
                  checked={s.consensoPrivacy}
                  onChange={(v) => agg("consensoPrivacy", v)}
                  errore={erroriCampi.privacy}
                >
                  Ho letto la{" "}
                  <Link href={"/privacy" as Route} className="sottolinea-matita text-blu-matita">
                    privacy policy
                  </Link>{" "}
                  e acconsento al trattamento dei dati per ricevere il preventivo.
                </Consenso>

                <Consenso
                  id="pv-marketing"
                  name="consensoMarketing"
                  checked={s.consensoMarketing}
                  onChange={(v) => agg("consensoMarketing", v)}
                >
                  Voglio ricevere anche le guide sull&rsquo;autopubblicazione. Facoltativo, niente
                  spam.
                </Consenso>

                {errore && (
                  <p className="text-t-sm text-rosso-matita" role="alert">
                    {errore}
                  </p>
                )}
              </div>
            </Domanda>
          )}
        </div>

        {/* Navigazione */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-filetto pt-6">
          <Pulsante
            variante="testuale"
            onClick={() => vaiA(passo - 1)}
            disabled={passo === 0 || invio}
            className={passo === 0 ? "invisible" : undefined}
          >
            ← {UI.indietro}
          </Pulsante>

          {passo < TOTALE_PASSI - 1 ? (
            <Pulsante
              variante={puoAvanzare ? "primario" : "secondario"}
              freccia
              onClick={() => {
                if (!validaEMostra()) return;
                if (puoAvanzare) vaiA(passo + 1);
              }}
            >
              {UI.avanti}
            </Pulsante>
          ) : (
            <Pulsante
              variante="primario"
              onClick={() => {
                if (!validaEMostra()) return;
                void calcola();
              }}
              disabled={invio}
            >
              {invio ? UI.caricamento : "Calcola il preventivo"}
            </Pulsante>
          )}
        </div>
      </div>

      {/* Anteprima: di lato da lg, barra fissa in basso sul telefono */}
      <Anteprima anteprima={anteprima} />
    </div>
  );
}

// ── Sotto-componenti ──────────────────────────────────────────────────────

function Indicatore({
  passo,
  raggiunto,
  vaiA,
}: {
  passo: number;
  raggiunto: number;
  vaiA: (p: number) => void;
}) {
  return (
    <nav aria-label="Passi del preventivo">
      <p className="text-t-sm text-grafite">
        {UI.passo} {passo + 1} {UI.di} {TOTALE_PASSI}
        <span className="sr-only">: {PREVENTIVO.passi[passo]}</span>
      </p>
      <ol className="mt-3 grid grid-cols-6 gap-1">
        {PREVENTIVO.passi.map((nome, i) => {
          const fatto = i < passo || i <= raggiunto;
          const corrente = i === passo;
          const cliccabile = fatto && !corrente;
          const Tag = cliccabile ? "button" : "span";
          return (
            <li key={nome} className="min-w-0">
              <Tag
                type={cliccabile ? "button" : undefined}
                onClick={cliccabile ? () => vaiA(i) : undefined}
                aria-current={corrente ? "step" : undefined}
                className={cn(
                  "block w-full rounded-campo pt-2 text-left",
                  cliccabile && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "block h-1 rounded-pillola transition-colors duration-200 ease-matita",
                    corrente ? "bg-rosso-matita" : fatto ? "bg-inchiostro" : "bg-filetto",
                  )}
                />
                <span
                  className={cn(
                    "mt-2 hidden truncate text-t-xs sm:block",
                    corrente ? "font-bold text-inchiostro" : fatto ? "text-inchiostro underline-offset-2 hover:underline" : "text-grafite",
                  )}
                >
                  {nome}
                </span>
              </Tag>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-t-sm font-bold text-inchiostro sm:hidden" aria-hidden="true">
        {PREVENTIVO.passi[passo]}
      </p>
    </nav>
  );
}

function Domanda({ titolo, nota, children }: { titolo: string; nota?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="font-serif text-t-lg text-inchiostro">{titolo}</legend>
      {nota && <p className="mt-2 mb-5 max-w-giustezza text-t-sm text-grafite">{nota}</p>}
      <div className={nota ? undefined : "mt-5"}>{children}</div>
    </fieldset>
  );
}

function Griglia({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Opzione({
  scelta,
  label,
  nota,
  onClick,
  casella = false,
}: {
  scelta: boolean;
  label: string;
  nota?: string;
  onClick: () => void;
  casella?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={scelta}
      className={cn(
        "flex min-h-14 items-start gap-3 rounded-foglio border bg-bianco p-4 text-left transition-[border-color,box-shadow] duration-200 ease-matita",
        scelta ? "border-2 border-rosso-matita" : "border-filetto hover:border-grafite",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center border text-bianco",
          casella ? "rounded-campo" : "rounded-pillola",
          scelta ? "border-rosso-matita bg-rosso-matita" : "border-grafite",
        )}
        aria-hidden="true"
      >
        {scelta && (
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5.2 4 7.2l4-4.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>
        <span className="block text-t-base font-bold text-inchiostro">{label}</span>
        {nota && <span className="mt-0.5 block text-t-sm text-grafite">{nota}</span>}
      </span>
    </button>
  );
}

/** Un numero che si aggiorna con una breve transizione: la chiave cambia, l'animazione riparte. */
function Importo({ valore, className }: { valore: number; className?: string }) {
  return (
    <span key={valore} className={cn("prezzo-aggiornato tabellare inline-block", className)}>
      {euro(valore)}
    </span>
  );
}

function Anteprima({ anteprima }: { anteprima: QuoteResult | null }) {
  const [aperta, setAperta] = useState(false);
  const consigliato = anteprima?.packages.find((p) => p.recommended);
  return (
    <>
      {/* da lg: di lato, fissa allo scorrimento */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Anteprima dei prezzi">
        <div className="rounded-foglio bg-bianco p-6 shadow-foglio">
          <p className="maiuscoletto text-t-sm text-grafite">Anteprima</p>
          {anteprima ? (
            <>
              <ul className="mt-4 space-y-2" aria-live="polite">
                {anteprima.packages.map((p) => (
                  <li
                    key={p.tier}
                    className={cn(
                      "flex items-baseline justify-between gap-3 rounded-campo px-3 py-2.5",
                      p.recommended ? "bg-carta-ombra" : undefined,
                    )}
                  >
                    <span className={cn("text-t-sm", p.recommended ? "font-bold text-inchiostro" : "text-grafite")}>
                      {p.name}
                    </span>
                    <Importo valore={p.total} className="text-t-sm text-inchiostro" />
                  </li>
                ))}
              </ul>
              <Filetto className="my-4" />
              <dl className="flex justify-between text-t-sm">
                <dt className="text-grafite">Pagine stimate</dt>
                <dd className="tabellare text-inchiostro">{numero(anteprima.estimatedPages)}</dd>
              </dl>
              <p className="mt-4 text-t-xs text-grafite">
                Si aggiorna mentre rispondi. Il preventivo definitivo arriva anche via email.
              </p>
            </>
          ) : (
            <p className="mt-4 text-t-sm text-grafite">
              Rispondi alle prime due domande e qui compaiono i tre percorsi con il prezzo.
            </p>
          )}
        </div>
      </aside>

      {/* sul telefono: barra fissa in basso */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-filetto bg-bianco shadow-sollevata-sito lg:hidden"
        aria-label="Anteprima dei prezzi"
        role="region"
      >
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4"
          aria-expanded={aperta}
          aria-controls="anteprima-dettagli"
          onClick={() => setAperta((a) => !a)}
        >
          {anteprima && consigliato ? (
            <span className="flex flex-col items-start text-left">
              <span className="text-t-xs text-grafite">Consigliato</span>
              <Importo valore={consigliato.total} className="text-t-md font-bold text-inchiostro" />
            </span>
          ) : (
            <span className="text-t-sm text-grafite">Rispondi alle prime domande: il prezzo compare qui.</span>
          )}
          <span className="text-t-sm text-blu-matita">
            {aperta ? "Chiudi" : "Dettagli"}
          </span>
        </button>
        {aperta && anteprima && (
          <div id="anteprima-dettagli" className="border-t border-filetto px-4 py-3">
            <ul className="space-y-1.5">
              {anteprima.packages.map((p) => (
                <li key={p.tier} className="flex justify-between text-t-sm">
                  <span className={p.recommended ? "font-bold text-inchiostro" : "text-grafite"}>{p.name}</span>
                  <Importo valore={p.total} className="text-inchiostro" />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-t-xs text-grafite">
              {numero(anteprima.estimatedPages)} pagine stimate. Si aggiorna mentre rispondi.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

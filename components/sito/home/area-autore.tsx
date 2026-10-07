import { euro, numero } from "@/lib/format";

/**
 * L'area autore, disegnata in HTML e SVG: nitida a ogni densità, in
 * italiano, con gli importi in euro. I numeri non sono inventati: arrivano
 * dal motore dei prezzi (`computeQuote`) per un romanzo da 50 000 parole,
 * così «Dati di esempio» è vero in entrambi i sensi.
 *
 * Non è interattiva: è un'immagine fatta di testo. `aria-label` sul
 * contenitore la descrive in una frase; dentro, tutto è `aria-hidden`.
 */
export function AreaAutoreDemo({
  parole,
  totale,
  acconto,
}: {
  parole: number;
  totale: number;
  acconto: number;
}) {
  const saldo = totale - acconto;
  const fasi = [
    ["Valutazione", "fatta"],
    ["Editing", "fatta"],
    ["Revisione", "in corso"],
    ["Impaginazione", "da fare"],
    ["Pubblicazione", "da fare"],
  ] as const;
  return (
    <div
      role="img"
      aria-label={`Anteprima dell'area autore: un romanzo di ${numero(parole)} parole, fasi di lavorazione con la revisione in corso, acconto di ${euro(acconto)} pagato e saldo di ${euro(saldo)} alla consegna. Dati di esempio.`}
      className="overflow-hidden rounded-foglio border border-grafite-su-inchiostro/30 bg-carta text-inchiostro shadow-sollevata-sito"
    >
      <div aria-hidden="true">
        {/* barra del browser */}
        <div className="flex items-center gap-2 border-b border-filetto bg-carta-ombra px-4 py-2.5">
          <span className="size-2.5 rounded-pillola bg-filetto" />
          <span className="size-2.5 rounded-pillola bg-filetto" />
          <span className="size-2.5 rounded-pillola bg-filetto" />
          <span className="ml-3 rounded-campo bg-bianco px-3 py-0.5 text-t-xs text-grafite">
            proemios.it/area
          </span>
        </div>
        <div className="grid grid-cols-[7.5rem_1fr] text-t-xs md:grid-cols-[9rem_1fr]">
          {/* barra laterale */}
          <nav className="border-r border-filetto bg-carta-ombra p-3">
            <ul className="flex flex-col gap-1">
              {["Progetti", "Revisioni", "Pagamenti", "Consegne", "Profilo"].map((v, i) => (
                <li
                  key={v}
                  className={
                    i === 0
                      ? "rounded-campo bg-bianco px-2.5 py-1.5 font-bold text-inchiostro"
                      : "px-2.5 py-1.5 text-grafite"
                  }
                >
                  {v}
                </li>
              ))}
            </ul>
          </nav>
          {/* contenuto */}
          <div className="p-4 md:p-5">
            <p className="maiuscoletto text-grafite">Romanzo, {numero(parole)} parole</p>
            <p className="mt-1 font-serif text-t-md leading-tight text-inchiostro">Il ritorno</p>

            <ol className="mt-4 flex flex-col gap-2">
              {fasi.map(([nome, stato]) => (
                <li key={nome} className="flex items-center gap-2.5">
                  <span
                    className={
                      stato === "fatta"
                        ? "flex size-4 items-center justify-center rounded-pillola bg-esito-ok text-bianco"
                        : stato === "in corso"
                          ? "size-4 rounded-pillola border-2 border-rosso-matita"
                          : "size-4 rounded-pillola border border-filetto"
                    }
                  >
                    {stato === "fatta" && (
                      <svg viewBox="0 0 10 10" className="size-2.5">
                        <path d="M2 5.2 4 7.2l4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span className={stato === "da fare" ? "text-grafite" : "text-inchiostro"}>{nome}</span>
                  <span className="ml-auto text-grafite">
                    {stato === "fatta" ? "approvata" : stato === "in corso" ? "da approvare" : ""}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-campo border border-filetto bg-bianco p-3">
              <div className="flex justify-between">
                <span className="text-grafite">Acconto 40 %</span>
                <span className="tabellare font-bold text-inchiostro">{euro(acconto)}, pagato</span>
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-grafite">Saldo alla consegna</span>
                <span className="tabellare text-inchiostro">{euro(saldo)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

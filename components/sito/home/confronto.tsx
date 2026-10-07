"use client";

import { useId, useState } from "react";
import { Cancellatura, Inserimento } from "@/components/sito/segni";

/**
 * Il confronto prima/dopo: la prova del mestiere. Le differenze sono segnate
 * come su una bozza — tratto rosso sulle parole tolte, parole aggiunte in blu
 * con il segno di inserimento sotto — invece che con un evidenziatore.
 *
 * Il cursore è un `<input type="range">`: frecce, Home ed End funzionano da
 * soli, e `aria-valuenow/min/max` li dà il browser. `aria-valuetext` dice
 * cosa si sta guardando. La copia rivelata è `aria-hidden`: uno screen reader
 * legge una volta sola, e legge la versione con le correzioni spiegate.
 */
type Segmento = { t?: string; via?: string; nuovo?: string };

const PARAGRAFI: Segmento[][] = [
  [
    { t: "Quando tornò al paese, " },
    { via: "lui si accorse che tutto era cambiato, ma anche tutto era rimasto uguale." },
    { nuovo: "gli sembrò che tutto fosse diverso. Eppure riconosceva ogni angolo." },
  ],
  [
    { t: "Le case erano " },
    { via: "sempre li" },
    { nuovo: "ancora lì" },
    { t: ". " },
    { via: "E la piazza era sempre quella piazza che lui conosceva così bene." },
    { nuovo: "La piazza conservava le voci e le ombre che ricordava." },
  ],
  [
    { t: "Si fermò" },
    { via: " per un momento" },
    { t: ". " },
    { via: "Pensava che forse non avrebbe dovuto tornare, ma era tornato." },
    { nuovo: "Aveva esitato a lungo, prima di tornare. Adesso era di nuovo a casa." },
  ],
];

function Originale() {
  return (
    <>
      {PARAGRAFI.map((p, i) => (
        <p key={i}>
          {p.map((s, j) => (s.t ?? s.via ? <span key={j}>{s.t ?? s.via}</span> : null))}
        </p>
      ))}
    </>
  );
}

function Corretto() {
  return (
    <>
      {PARAGRAFI.map((p, i) => (
        <p key={i}>
          {p.map((s, j) => {
            if (s.t) return <span key={j}>{s.t}</span>;
            if (s.via)
              return (
                <span key={j} className="relative text-grafite">
                  {s.via}
                  <Cancellatura className="absolute inset-x-0 top-1/2 h-2.5 w-full -translate-y-1/2" />
                </span>
              );
            return (
              <span key={j} className="relative text-blu-matita">
                {s.nuovo}
                <Inserimento className="absolute -bottom-2 left-0 h-2.5 w-3" />
              </span>
            );
          })}
        </p>
      ))}
    </>
  );
}

export function Confronto() {
  const [v, setV] = useState(50);
  const id = useId();
  return (
    <div>
      <div className="relative overflow-hidden rounded-foglio bg-bianco shadow-foglio">
        <div className="grid grid-cols-1 grid-rows-1">
          <div className="col-start-1 row-start-1 p-6 font-serif text-t-base leading-relaxed text-inchiostro md:p-8 [&_p+p]:mt-3">
            <p className="maiuscoletto mb-3 font-sans text-t-xs text-grafite">Originale</p>
            <Originale />
          </div>
          <div
            aria-hidden="true"
            className="col-start-1 row-start-1 border-l border-filetto bg-bianco p-6 font-serif text-t-base leading-relaxed text-inchiostro md:p-8 [&_p+p]:mt-3"
            style={{ clipPath: `inset(0 0 0 ${v}%)` }}
          >
            <p className="maiuscoletto mb-3 font-sans text-t-xs text-rosso-matita">Corretto</p>
            <Corretto />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-rosso-matita"
          style={{ left: `${v}%` }}
        />
      </div>

      <div className="mt-4">
        <label htmlFor={id} className="text-t-sm text-grafite">
          Trascina il cursore per confrontare l&rsquo;originale con la versione corretta
        </label>
        <input
          id={id}
          type="range"
          min={5}
          max={95}
          step={1}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          aria-valuetext={`${v}% della pagina mostra la versione corretta`}
          className="cursore-confronto mt-2 w-full"
        />
      </div>

      {/* Per chi non vede il confronto: le correzioni, spiegate. */}
      <ul className="sr-only">
        <li>
          «lui si accorse che tutto era cambiato, ma anche tutto era rimasto uguale» diventa «gli
          sembrò che tutto fosse diverso. Eppure riconosceva ogni angolo».
        </li>
        <li>«sempre li» diventa «ancora lì», con l&rsquo;accento.</li>
        <li>
          «E la piazza era sempre quella piazza che lui conosceva così bene» diventa «La piazza
          conservava le voci e le ombre che ricordava».
        </li>
        <li>
          «Si fermò per un momento. Pensava che forse non avrebbe dovuto tornare, ma era tornato»
          diventa «Si fermò. Aveva esitato a lungo, prima di tornare. Adesso era di nuovo a casa».
        </li>
      </ul>
      <p className="mt-3 text-t-xs text-grafite">
        Testo dimostrativo, scritto per questo confronto. Una possibile revisione, da discutere con
        chi l&rsquo;ha scritto.
      </p>
    </div>
  );
}

import type { ReactNode } from "react";
import { Contenitore, Filetto } from "@/components/sito/sezione";
import { campiMancanti, daCompilare } from "@/config/legal";

export type SezioneLegale = {
  titolo: string;
  contenuto: ReactNode;
};

/**
 * Impaginato condiviso dei documenti legali, composto come un testo da
 * leggere: misura di lettura, titoli numerati perché qui l'ordine è il
 * contenuto, filetti a separare gli articoli.
 *
 * Il testo è standard e completo. Restano da compilare solo i dati
 * anagrafici del titolare, centralizzati in `config/legal.ts`: finché sono
 * segnaposto, l'avviso in testa alla pagina lo dichiara.
 */
export function DocumentoLegale({
  titolo,
  aggiornamento,
  premessa,
  sezioni,
}: {
  titolo: string;
  aggiornamento: string;
  premessa: ReactNode;
  sezioni: SezioneLegale[];
}) {
  const mancanti = campiMancanti();

  return (
    <Contenitore stretto className="py-sezione-mobile lg:py-sezione">
      <h1 className="font-serif text-t-display text-balance text-inchiostro">{titolo}</h1>
      <p className="mt-4 text-t-sm text-grafite">Ultimo aggiornamento: {aggiornamento}</p>
      <Filetto className="mt-6" />

      {mancanti > 0 && (
        <div className="mt-8 rounded-foglio border border-dashed border-rosso-matita bg-bianco p-5">
          <p className="maiuscoletto text-t-sm text-rosso-matita">Prima della pubblicazione</p>
          <p className="mt-2 text-t-sm text-grafite">
            Il testo di questo documento è completo. Restano da compilare{" "}
            <strong className="text-inchiostro">{mancanti} dati anagrafici</strong> del titolare in{" "}
            <code className="rounded-campo bg-carta-ombra px-1 text-t-xs">config/legal.ts</code>{" "}
            (compaiono nel testo come <em>DA INSERIRE</em>). Fai validare il documento definitivo a un
            professionista prima di metterlo online.
          </p>
        </div>
      )}

      <div className="documento mt-8 text-t-base text-grafite">{premessa}</div>

      <ol className="mt-12 space-y-10">
        {sezioni.map((s, i) => (
          <li key={i}>
            <h2 className="font-serif text-t-lg text-inchiostro">
              <span className="tabellare mr-3 text-rosso-matita">{i + 1}.</span>
              {s.titolo}
            </h2>
            <Filetto className="mt-3" />
            <div className="documento mt-4 text-t-base text-grafite">{s.contenuto}</div>
          </li>
        ))}
      </ol>
    </Contenitore>
  );
}

/** Rende un dato anagrafico, evidenziandolo se è ancora un segnaposto. */
export function Dato({ valore }: { valore: string | null }) {
  if (valore === null) return <>non nominato</>;
  if (!daCompilare(valore)) return <>{valore}</>;
  return (
    <mark className="rounded-campo bg-carta-ombra px-1 text-t-sm not-italic text-rosso-matita">{valore}</mark>
  );
}

import type { ReactNode } from "react";
import { Gabbia, Filetto } from "@/components/ui/primitivi";
import { campiMancanti, daCompilare } from "@/config/legal";

export type SezioneLegale = {
  titolo: string;
  contenuto: ReactNode;
};

/**
 * Impaginato condiviso dei documenti legali.
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
    <Gabbia className="py-14 sm:py-20">
      <div className="mx-auto max-w-prose">
        <h1 className="font-display text-[2.2rem] leading-[1.1] font-medium sm:text-[2.8rem]">
          {titolo}
        </h1>
        <p className="apparato text-stampa mt-4">Ultimo aggiornamento: {aggiornamento}</p>
        <Filetto className="mt-6" />

        {mancanti > 0 && (
          <div className="rounded-scheda border-ottone bg-carta-alta mt-8 border border-dashed p-5">
            <p className="apparato text-ottone">Prima della pubblicazione</p>
            <p className="prosa mt-2 text-sm">
              Il testo di questo documento è completo. Restano da compilare{" "}
              <strong>{mancanti} dati anagrafici</strong> del titolare in{" "}
              <code className="font-mono text-[0.9em]">config/legal.ts</code> (compaiono nel testo
              come <em>DA INSERIRE</em>). Fai validare il documento definitivo a un professionista
              prima di metterlo online.
            </p>
          </div>
        )}

        <div className="prosa mt-8">{premessa}</div>

        <ol className="mt-12 space-y-10">
          {sezioni.map((s, i) => (
            <li key={i}>
              <h2 className="font-display text-inchiostro text-xl font-medium">
                <span className="cifre text-ottone mr-2">{String(i + 1).padStart(2, "0")}</span>
                {s.titolo}
              </h2>
              <Filetto className="mt-3" />
              <div className="prosa mt-4">{s.contenuto}</div>
            </li>
          ))}
        </ol>
      </div>
    </Gabbia>
  );
}

/** Rende un dato anagrafico, evidenziandolo se è ancora un segnaposto. */
export function Dato({ valore }: { valore: string | null }) {
  if (valore === null) return <>non nominato</>;
  if (!daCompilare(valore)) return <>{valore}</>;
  return (
    <mark className="bg-ottone/15 text-ottone rounded-[2px] px-1 font-mono text-[0.85em] not-italic">
      {valore}
    </mark>
  );
}

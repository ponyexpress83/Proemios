import type { Metadata } from "next";
import { Titolo, Nota } from "@/components/ui/primitivi";
import { Scheda, SchedaCorpo, SchedaTestata, SchedaMetrica } from "@/components/ui/scheda";
import { Badge } from "@/components/ui/badge";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { staffPerPagina } from "@/lib/auth/sessione";
import { calibrazione } from "@/lib/dati/calibrazione";
import { CAMPIONE_MINIMO } from "@/lib/produzione/calibrazione";
import { ETICHETTA_CATEGORIA } from "@/lib/ai/livelli";

export const metadata: Metadata = {
  title: "Calibrazione",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ETICHETTA_FASCIA: Record<string, string> = {
  alta: "Confidenza alta (≥ 90%)",
  media: "Confidenza media (70–90%)",
  bassa: "Confidenza bassa (< 70%)",
};

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** Barra di accordo: piena a sinistra, sul punto al centro, respinto a destra. */
function Barra({ pieno, sulPunto }: { pieno: number; sulPunto: number }) {
  const modificato = Math.max(0, sulPunto - pieno);
  const rifiutato = Math.max(0, 1 - sulPunto);
  return (
    <div className="bg-superficie flex h-2 w-full overflow-hidden rounded" aria-hidden>
      <div className="bg-lime h-full" style={{ width: `${pieno * 100}%` }} />
      <div className="bg-viola h-full" style={{ width: `${modificato * 100}%` }} />
      <div className="bg-errore h-full" style={{ width: `${rifiutato * 100}%` }} />
    </div>
  );
}

export default async function PaginaCalibrazione() {
  const attore = await staffPerPagina("/redazione/calibrazione", "job.vedi_run_ai");
  const dati = await calibrazione(attore, 90);

  const pronte = dati.perCategoria.filter((c) => c.raccomandazione.azione === "puoi-allentare");

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello="Ultimi 90 giorni"
        sotto="Quanto il modello e i redattori sono d'accordo, per categoria. È il numero che dice quando si può allentare un controllo — senza, la decisione resta una sensazione."
      >
        Calibrazione
      </Titolo>

      {dati.decisioniTotali === 0 ? (
        <StatoVuoto
          titolo="Nessuna decisione ancora"
          descrizione="I numeri compaiono da soli man mano che i redattori lavorano: ogni intervento accettato, modificato o rifiutato è un dato di calibrazione."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SchedaMetrica
              etichetta="Decisioni misurate"
              valore={dati.decisioniTotali.toLocaleString("it-IT")}
            />
            <SchedaMetrica etichetta="Lavorazioni" valore={String(dati.jobConsiderati)} />
            <SchedaMetrica
              etichetta="Categorie pronte ad allentare"
              valore={String(pronte.length)}
              tono={pronte.length > 0 ? "positivo" : "neutro"}
            />
          </div>

          <Avviso tono="informazione" titolo="Come si legge">
            <span className="text-lime">Verde</span>: accettato senza toccare una parola.{" "}
            <span className="text-viola-chiaro">Viola</span>: il modello ha trovato il punto giusto
            e il redattore ha riscritto — è un successo parziale, non un errore.{" "}
            <span className="text-errore">Rosso</span>: proposta respinta.
          </Avviso>

          <Scheda>
            <SchedaTestata
              titolo="Per categoria"
              sotto={`Serve un campione di almeno ${CAMPIONE_MINIMO} decisioni prima che una percentuale voglia dire qualcosa.`}
            />
            <SchedaCorpo className="flex flex-col gap-5">
              {dati.perCategoria.map((c) => (
                <div key={c.categoria} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-testo text-sm font-medium">
                      {ETICHETTA_CATEGORIA[c.categoria as never] ?? c.categoria}
                    </span>
                    <span className="cifre text-testo-tenue text-xs">
                      {c.proposti} decisioni · {pct(c.accordoPieno)} pieno ·{" "}
                      {pct(c.accordoSulPunto)} sul punto
                    </span>
                  </div>

                  <Barra pieno={c.accordoPieno} sulPunto={c.accordoSulPunto} />

                  <div className="flex flex-wrap items-center gap-2">
                    {c.raccomandazione.azione === "puoi-allentare" ? (
                      <>
                        <Badge tono="lime">Si può allentare</Badge>
                        <Nota>{c.raccomandazione.motivo}</Nota>
                      </>
                    ) : c.raccomandazione.azione === "campione-insufficiente" ? (
                      <>
                        <Badge>Campione insufficiente</Badge>
                        <Nota>
                          mancano {c.raccomandazione.mancanti} decisioni prima di poterne parlare
                        </Nota>
                      </>
                    ) : (
                      <>
                        <Badge tono="attenzione">Continua a controllare</Badge>
                        <Nota>{c.raccomandazione.motivo}</Nota>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </SchedaCorpo>
          </Scheda>

          <Scheda>
            <SchedaTestata
              titolo="Per fascia di confidenza"
              sotto="Se il modello è calibrato bene, l'accordo scende insieme alla confidenza dichiarata. Se non scende, la confidenza non sta misurando niente."
            />
            <SchedaCorpo className="flex flex-col gap-5">
              {dati.perFascia.map((f) => (
                <div key={f.fascia} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-testo text-sm font-medium">
                      {ETICHETTA_FASCIA[f.fascia]}
                    </span>
                    <span className="cifre text-testo-tenue text-xs">
                      {f.proposti} decisioni · {pct(f.accordoPieno)} pieno
                    </span>
                  </div>
                  <Barra pieno={f.accordoPieno} sulPunto={f.accordoSulPunto} />
                </div>
              ))}
            </SchedaCorpo>
          </Scheda>

          <Nota>
            Questa pagina propone, non esegue: allentare un controllo resta una decisione di una
            persona, che deve poterla scrivere in un verbale. La consegna al cliente non si allenta
            mai, qualunque cosa dicano questi numeri.
          </Nota>
        </>
      )}
    </div>
  );
}

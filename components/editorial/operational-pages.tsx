import { Eyebrow } from "./proemios";
import Link from "./link";
import { Configuratore } from "@/components/preventivo/configuratore";
import { FlussoAnalisi } from "@/components/analisi/flusso";
import { ModuloContatto } from "@/components/moduli/modulo-contatto";
import { ModuloAgenzia } from "@/components/moduli/modulo-agenzia";
import type { ProjectType, ServiceKey } from "@/lib/pricing";
import { publicEnv } from "@/lib/env";
export function QuotePage({
  precompilato,
}: {
  precompilato?: { tipo?: ProjectType; servizi?: ServiceKey[]; parole?: number };
}) {
  return (
    <section className="operative">
      <div className="container">
        <div className="operative-intro">
          <Eyebrow>IL TUO LIBRO COMINCIA QUI</Eyebrow>
          <h1>
            Quanto costa
            <br />
            il tuo <em>progetto?</em>
          </h1>
          <p>
            Raccontaci a che punto sei. Il configuratore usa i prezzi del progetto per proporti tre
            percorsi, con servizi e costi leggibili. Se vuoi, li verifichiamo insieme.
          </p>
        </div>
        <div className="operative-surface">
          <Configuratore precompilato={precompilato} />
        </div>
      </div>
    </section>
  );
}
export function AnalysisPage({ retention }: { retention: number }) {
  return (
    <section className="operative">
      <div className="container">
        <div className="operative-intro">
          <Eyebrow>UN PRIMO SGUARDO SUL TESTO</Eyebrow>
          <h1>
            Il tuo manoscritto.
            <br />
            Un nuovo <em>sguardo.</em>
          </h1>
          <p>
            Carica il testo per una prima analisi di leggibilità, ritmo e ripetizioni. Il report
            automatico è un punto di partenza: la valutazione professionale completa resta un lavoro
            editoriale.
          </p>
        </div>
        <div className="operative-surface">
          <FlussoAnalisi giorniConservazione={retention} />
        </div>
      </div>
    </section>
  );
}
export function ContactPage() {
  return (
    <section className="operative">
      <div className="form-layout container">
        <div>
          <Eyebrow>PARLIAMONE</Eyebrow>
          <h1>
            Ogni libro inizia
            <br />
            con un <em>dialogo.</em>
          </h1>
          <p className="intro">
            Un’idea da mettere a fuoco, una domanda sul manoscritto o un progetto da avviare.
            Raccontaci di cosa hai bisogno.
          </p>
          {publicEnv.NEXT_PUBLIC_CALENDAR_URL && (
            <Link
              href={publicEnv.NEXT_PUBLIC_CALENDAR_URL}
              className="button secondary"
              style={{ marginTop: 25 }}
            >
              Prenota una call
            </Link>
          )}
        </div>
        <div className="form-card">
          <ModuloContatto />
        </div>
      </div>
    </section>
  );
}
export function AgencyForm() {
  return (
    <section id="richiesta" className="operative">
      <div className="form-layout container">
        <div>
          <Eyebrow>PROEMIOS PER I PARTNER</Eyebrow>
          <h2>
            Costruiamo
            <br />
            la <em>collaborazione.</em>
          </h2>
          <p className="intro">
            Raccontaci la tua agenzia, i servizi di cui hai bisogno e il volume previsto. Le
            condizioni vengono definite sul tuo modello di lavoro.
          </p>
        </div>
        <div className="form-card">
          <ModuloAgenzia />
        </div>
      </div>
    </section>
  );
}

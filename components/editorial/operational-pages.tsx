import { Eyebrow, Dashboard } from "./proemios";
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
export function AccessPage() {
  return (
    <section className="login-section">
      <div className="login-layout container">
        <div className="login-art">
          <Eyebrow>IL TUO SPAZIO PROEMIOS</Eyebrow>
          <h2>
            Un solo spazio.
            <br />
            Ogni <em>capitolo.</em>
          </h2>
          <Dashboard />
          <p className="form-note">Interfaccia di riferimento · dati dimostrativi</p>
        </div>
        <div className="login-card form-card">
          <Eyebrow>AREA RISERVATA</Eyebrow>
          <h1>
            Gestisci il
            <br />
            <em>lavoro editoriale.</em>
          </h1>
          <p>
            Il backoffice esistente raccoglie preventivi, contatti, richieste delle agenzie e
            analisi dei manoscritti.
          </p>
          <Link href="/admin" className="button">
            Accedi al backoffice
          </Link>
          <div className="login-banner" style={{ marginTop: 22 }}>
            Accesso riservato al team, con le credenziali già configurate. L’anteprima della
            dashboard mostra la direzione visiva del prodotto.
          </div>
          <Link href="/contatti" className="text-link" style={{ marginTop: 20 }}>
            Sei un autore? Parla con noi.
          </Link>
        </div>
      </div>
    </section>
  );
}

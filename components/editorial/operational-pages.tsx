import { demoAttiva } from "@/lib/demo";
import { DemoLogin } from "@/components/author/demo-login";
import type { TextState } from "@/lib/pricing";
import { Eyebrow } from "./elements";
import Link from "./link";
import { Configuratore } from "@/components/preventivo/configuratore";
import { FlussoAnalisi } from "@/components/analisi/flusso";
import { ModuloContatto } from "@/components/moduli/modulo-contatto";
import { ModuloAgenzia } from "@/components/moduli/modulo-agenzia";
import type { ProjectType, ServiceKey } from "@/lib/pricing";
import { publicEnv, env } from "@/lib/env";
export function QuotePage({
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
  return (
    <section className="operative quote-operative">
      <div className="container">
        <div className="operative-intro">
          <Eyebrow>IL TUO LIBRO COMINCIA QUI</Eyebrow>
          <h1>
            Quanto costa
            <br />
            il tuo <em>progetto?</em>
          </h1>
          <p>
            Racconta il tuo progetto, a voce o per iscritto. Confronta tre percorsi e scopri i costi
            prima di lasciare i tuoi contatti.
          </p>
        </div>
        <div className="operative-surface">
          <FormDemoNotice />
          <Configuratore precompilato={precompilato} demoMode={demoAttiva()} />
          <details className="quote-analysis-option" id="analisi-facoltativa">
            <summary>
              <span>Hai già un testo?</span>
              <strong>Aggiungi una prima analisi facoltativa</strong>
              <span className="quote-analysis-toggle" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="quote-analysis-content">
              <p>
                Un report automatico su leggibilità, ritmo e ripetizioni, con un conteggio parole
                del file. È gratuito e facoltativo: puoi calcolare il preventivo anche senza
                condividere il testo. La lettura professionale completa è un servizio distinto.
              </p>
              <div className="manuscript-privacy">
                <strong>Prima di condividere il tuo testo</strong>
                <p>
                  Il caricamento non trasferisce i tuoi diritti sull’opera. Il file non viene
                  archiviato dall’applicazione; per il report un estratto viene elaborato dal
                  servizio di analisi automatica descritto nell’informativa. Nome file, conteggio
                  parole e report sono associati a una scadenza di {env.MANUSCRIPT_RETENTION_DAYS}{" "}
                  giorni.
                </p>
                <div>
                  <Link href="/privacy" className="text-link">
                    Come trattiamo il testo
                  </Link>
                  <Link href="/termini" className="text-link">
                    Diritti e condizioni
                  </Link>
                </div>
              </div>
              <FormDemoNotice analysis />
              <FlussoAnalisi
                giorniConservazione={env.MANUSCRIPT_RETENTION_DAYS}
                demoMode={demoAttiva()}
              />
            </div>
          </details>
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
          <FormDemoNotice analysis />
          <FlussoAnalisi giorniConservazione={retention} demoMode={demoAttiva()} />
        </div>
      </div>
    </section>
  );
}
export function ContactPage({ motivo, quote }: { motivo?: string; quote?: string }) {
  return (
    <section className="operative">
      <div className="form-layout container">
        <div>
          <Eyebrow>
            {motivo === "editor"
              ? "PARLA CON UN EDITOR"
              : quote
                ? "PARLIAMO DEL TUO PREVENTIVO"
                : "PARLIAMONE"}
          </Eyebrow>
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
          <FormDemoNotice />
          <ModuloContatto motivo={motivo} quote={quote} demoMode={demoAttiva()} />
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
          <FormDemoNotice />
          <ModuloAgenzia />
        </div>
      </div>
    </section>
  );
}
export function AccessPage() {
  return <DemoLogin />;
}
export function FormDemoNotice({ analysis = false }: { analysis?: boolean }) {
  if (!demoAttiva()) return null;
  return (
    <div className="form-demo-note">
      Demo: anteprima simulata, nessuna email sarà inviata e nessun pagamento sarà addebitato.{" "}
      {analysis
        ? "Non caricare manoscritti reali: usa un testo di esempio."
        : "Usa soltanto dati di prova."}
    </div>
  );
}

import { demoAttiva } from "@/lib/demo";
import type { QuotePrefill } from "@/lib/quote-brief";
import { Eyebrow } from "./elements";
import Link from "./link";
import { Configuratore } from "@/components/preventivo/configuratore";
import { FlussoAnalisi } from "@/components/analisi/flusso";
import { ModuloContatto } from "@/components/moduli/modulo-contatto";
import { ModuloAgenzia } from "@/components/moduli/modulo-agenzia";
import { publicEnv, env } from "@/lib/env";
import { analysisConfigured } from "@/lib/platform/analysis";
export function QuotePage({ precompilato }: { precompilato?: QuotePrefill }) {
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
          <Configuratore
            precompilato={precompilato}
            demoMode={demoAttiva()}
            retention={env.MANUSCRIPT_RETENTION_DAYS}
          />
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
          {demoAttiva() || analysisConfigured() ? <FlussoAnalisi giorniConservazione={retention} demoMode={demoAttiva()} /> : <div className="platform-card"><h2>Analisi in attivazione</h2><p>Il servizio sarà disponibile dopo la verifica dei fornitori e delle condizioni sui testi. Puoi già confrontare una stima senza caricare il manoscritto.</p><Link href="/preventivo" className="button">Scopri la stima →</Link><Link href="/contatti?motivo=editor">Parla con un editor →</Link></div>}
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
